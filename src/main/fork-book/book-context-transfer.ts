import os from 'node:os'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron'
import { gitExecFileAsync } from '../git/command-runner/git-exec-file'
import { readNativeChatTranscript } from '../native-chat/transcript-reader'
import type { NativeChatBlock, NativeChatMessage } from '../../shared/native-chat/native-chat-types'
import {
  bookContextFileStem,
  boundedBookTranscript,
  buildBookSummaryPrompt,
  relativizeBookPaths,
  renderBookTranscript,
  restoreBookPaths,
  type BookContextExportRequest,
  type BookContextExportResult,
  type BookContextImportPick,
  type BookContextMaterializeRequest,
  type BookContextMaterializeResult,
  type BookTranscriptBlock,
  type BookTranscriptMessage
} from '../../shared/fork-book/book-context-transfer'
import {
  embedBookContextManifest,
  readBookContextManifest,
  renderBookPendingWork,
  stripBookContextManifest,
  type BookContextManifest,
  type BookPendingWork
} from '../../shared/fork-book/book-context-manifest'
import { bookCatalogPath } from './book-catalog-store'
import {
  bookPathExists,
  readRecentCommitSubjects,
  runBookAgentText,
  type BookEntryGenerationHost
} from './book-entry-generation'

const GIT_TIMEOUT_MS = 10_000
// Keeps the summary prompt well inside the agent's context; the full file carries the rest.
const SUMMARY_TRANSCRIPT_LIMIT = 60_000
const SUMMARY_SUFFIX = '.summary.md'
const CONVERSATION_SUFFIX = '.conversation.md'

async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await gitExecFileAsync(args, { cwd, timeout: GIT_TIMEOUT_MS })
    return String(stdout).trim()
  } catch {
    return null
  }
}

const UNCOMMITTED_FILE_LIMIT = 200

type GitState = { branch: string; headCommit: string; pendingWork: BookPendingWork }

/** Never blocks the export: what is not on the remote is listed in the summary instead. */
async function readGitState(cwd: string): Promise<GitState> {
  const head = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = head && head !== 'HEAD' ? head : ''
  const headCommit = (await git(cwd, ['rev-parse', 'HEAD'])) ?? ''
  const status = (await git(cwd, ['status', '--porcelain'])) ?? ''
  const uncommittedFiles = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .slice(0, UNCOMMITTED_FILE_LIMIT)
  const onRemote = branch
    ? (await git(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])) !== null ||
      (await git(cwd, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`])) !==
        null
    : false
  const unpushed =
    Number(await git(cwd, ['rev-list', '--count', 'HEAD', '--not', '--remotes'])) || 0
  return {
    branch,
    headCommit,
    pendingWork: { uncommittedFiles, unpushedCommits: unpushed, branchOnRemote: onRemote }
  }
}

function toTranscriptBlock(block: NativeChatBlock): BookTranscriptBlock {
  if (block.type === 'text') {
    return { type: 'text', text: block.text }
  }
  if (block.type === 'tool-call') {
    return { type: 'tool-call', name: block.name, input: block.input }
  }
  if (block.type === 'tool-result') {
    return { type: 'tool-result', output: block.output, isError: block.isError }
  }
  return { type: 'other' }
}

function toTranscriptMessage(message: NativeChatMessage): BookTranscriptMessage {
  return {
    role: message.role,
    timestamp: message.timestamp,
    blocks: message.blocks.map(toTranscriptBlock)
  }
}

async function readConversationMarkdown(request: BookContextExportRequest): Promise<string | null> {
  const conversation = request.conversation
  if (!conversation) {
    return null
  }
  const read = await readNativeChatTranscript(conversation.agent, conversation.sessionId, {
    filePath: conversation.filePath
  })
  if ('error' in read) {
    return null
  }
  return renderBookTranscript(
    read.messages.map(toTranscriptMessage),
    conversation.title ?? request.title
  )
}

async function pickFolder(window: BrowserWindow | null, title: string): Promise<string | null> {
  const options: OpenDialogOptions = { title, properties: ['openDirectory', 'createDirectory'] }
  const picked = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  return picked.canceled ? null : (picked.filePaths[0] ?? null)
}

/**
 * Always writes both `<name>.summary.md` (AI hand-off notes plus a manifest) and
 * `<name>.conversation.md` (the whole conversation). Paths inside the checkout become `<REPO_ROOT>`.
 */
export async function exportBookContext(
  host: BookEntryGenerationHost,
  window: BrowserWindow | null,
  request: BookContextExportRequest
): Promise<BookContextExportResult> {
  if (!(await bookPathExists(request.workspacePath))) {
    return { status: 'failed', error: 'The workspace folder is not on this computer.' }
  }
  const home = os.homedir()
  const transcript = await readConversationMarkdown(request)
  if (!transcript) {
    return { status: 'no-conversation' }
  }
  const conversationMarkdown = relativizeBookPaths(transcript, request.roots, home)
  const folder = await pickFolder(window, request.title)
  if (!folder) {
    return { status: 'canceled' }
  }
  const gitState = await readGitState(request.workspacePath)
  const gitLog = await readRecentCommitSubjects(request.workspacePath)
  const summary = await runBookAgentText(
    host,
    buildBookSummaryPrompt({
      manifest: { ...request, branch: gitState.branch },
      transcript: boundedBookTranscript(conversationMarkdown, SUMMARY_TRANSCRIPT_LIMIT),
      gitLog,
      language: request.language
    })
  )
  if (!summary.success) {
    return { status: 'failed', error: summary.error }
  }
  const stem = bookContextFileStem(request.title)
  const conversationFile = `${stem}${CONVERSATION_SUFFIX}`
  const manifest: BookContextManifest = {
    format: 'orca-book-context',
    version: 1,
    title: request.title,
    description: request.description,
    linkedTask: request.linkedTask,
    repo: request.repo,
    repoName: request.repoName,
    branch: gitState.branch,
    headCommit: gitState.headCommit,
    agent: request.conversation?.agent,
    conversationTitle: request.conversation?.title,
    exportedAt: new Date().toISOString(),
    sourcePlatform: process.platform,
    conversationFile,
    pendingWork: gitState.pendingWork
  }
  const summaryPath = join(folder, `${stem}${SUMMARY_SUFFIX}`)
  await writeFile(
    summaryPath,
    embedBookContextManifest(
      [
        relativizeBookPaths(summary.text, request.roots, home),
        renderBookPendingWork(gitState.pendingWork)
      ]
        .filter(Boolean)
        .join('\n\n'),
      manifest
    )
  )
  const conversationPath = join(folder, conversationFile)
  await writeFile(conversationPath, conversationMarkdown)
  return { status: 'exported', summaryPath, conversationPath, pendingWork: gitState.pendingWork }
}

/** Accepts either exported file and finds its sibling. */
export async function pickBookContextImport(
  window: BrowserWindow | null
): Promise<BookContextImportPick> {
  const options: OpenDialogOptions = {
    properties: ['openFile'],
    filters: [{ name: 'Orca Book context', extensions: ['md'] }]
  }
  const picked = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  const file = picked.filePaths[0]
  if (picked.canceled || !file) {
    return { status: 'canceled' }
  }
  const summaryPath = file.endsWith(CONVERSATION_SUFFIX)
    ? join(dirname(file), `${basename(file, CONVERSATION_SUFFIX)}${SUMMARY_SUFFIX}`)
    : file
  if (!(await bookPathExists(summaryPath))) {
    return { status: 'invalid', error: `Missing ${basename(summaryPath)} next to the file.` }
  }
  const manifest = readBookContextManifest(await readFile(summaryPath, 'utf-8'))
  if (!manifest) {
    return { status: 'invalid', error: 'This file is not an exported Orca Book context.' }
  }
  const pickedConversation = manifest.conversationFile
    ? join(dirname(summaryPath), manifest.conversationFile)
    : undefined
  // Copies outlive a USB stick or a cleaned Downloads folder; the entry keeps pointing at them.
  const staged = join(
    dirname(bookCatalogPath()),
    'book-imports',
    `${bookContextFileStem(manifest.title)}-${Date.now()}`,
    'source'
  )
  await mkdir(staged, { recursive: true })
  const stagedSummary = join(staged, basename(summaryPath))
  await copyFile(summaryPath, stagedSummary)
  let stagedConversation: string | undefined
  if (pickedConversation && (await bookPathExists(pickedConversation))) {
    stagedConversation = join(staged, basename(pickedConversation))
    await copyFile(pickedConversation, stagedConversation)
  }
  return {
    status: 'picked',
    manifest,
    summaryPath: stagedSummary,
    conversationPath: stagedConversation
  }
}

/** Copies an imported context next to the Book catalog with `<REPO_ROOT>` set to this checkout. */
export async function materializeBookContextImport(
  request: BookContextMaterializeRequest
): Promise<BookContextMaterializeResult> {
  const separator = process.platform === 'win32' ? '\\' : '/'
  const folder = join(
    dirname(bookCatalogPath()),
    'book-imports',
    bookContextFileStem(request.folderName)
  )
  await mkdir(folder, { recursive: true })
  const summaryText = restoreBookPaths(
    stripBookContextManifest(await readFile(request.summaryPath, 'utf-8')),
    request.worktreePath,
    separator
  )
  let conversationPath: string | undefined
  if (request.conversationPath && (await bookPathExists(request.conversationPath))) {
    conversationPath = join(folder, basename(request.conversationPath))
    await writeFile(
      conversationPath,
      restoreBookPaths(
        await readFile(request.conversationPath, 'utf-8'),
        request.worktreePath,
        separator
      )
    )
  }
  // The new agent is handed the summary file; it points on to the full conversation.
  const handoffText = conversationPath
    ? `${summaryText}\n\n---\n\nFull conversation (read the parts you need): ${conversationPath}\n`
    : summaryText
  const summaryPath = join(folder, basename(request.summaryPath))
  await writeFile(summaryPath, handoffText)
  return { summaryPath, conversationPath, summaryText: handoffText }
}
