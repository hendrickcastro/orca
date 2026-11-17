import os from 'node:os'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron'
import { gitExecFileAsync } from '../git/command-runner/git-exec-file'
import { readNativeChatTranscript } from '../native-chat/transcript-reader'
import type { NativeChatBlock, NativeChatMessage } from '../../shared/native-chat/native-chat-types'
import {
  bookContextFileStem,
  boundedBookTranscript,
  buildBookSummaryPrompt,
  embedBookContextManifest,
  readBookContextManifest,
  relativizeBookPaths,
  renderBookTranscript,
  restoreBookPaths,
  stripBookContextManifest,
  type BookContextExportRequest,
  type BookContextExportResult,
  type BookContextImportPick,
  type BookContextManifest,
  type BookContextMaterializeRequest,
  type BookContextMaterializeResult,
  type BookTranscriptBlock,
  type BookTranscriptMessage
} from '../../shared/fork-book/book-context-transfer'
import { bookCatalogPath } from './book-catalog-store'
import {
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

type PushState =
  | { pushed: true; branch: string; headCommit: string }
  | Extract<BookContextExportResult, { status: 'not-pushed' }>

/** The export only references git, so everything it needs must already be on the remote. */
async function readPushState(cwd: string): Promise<PushState> {
  const branch = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const headCommit = (await git(cwd, ['rev-parse', 'HEAD'])) ?? ''
  const status = (await git(cwd, ['status', '--porcelain'])) ?? ''
  const dirtyFiles = status ? status.split(/\r?\n/).filter(Boolean).length : 0
  const upstream = await git(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
  const ahead = upstream ? Number(await git(cwd, ['rev-list', '--count', '@{u}..HEAD'])) || 0 : 0
  if (!branch || branch === 'HEAD' || dirtyFiles > 0 || !upstream || ahead > 0) {
    return {
      status: 'not-pushed',
      branch: branch && branch !== 'HEAD' ? branch : undefined,
      dirtyFiles,
      unpushedCommits: ahead,
      noUpstream: !upstream
    }
  }
  return { pushed: true, branch, headCommit }
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
 * Writes `<name>.summary.md` (AI hand-off notes plus a manifest) and `<name>.conversation.md`
 * (the whole conversation). Paths inside the checkout become `<REPO_ROOT>`.
 */
export async function exportBookContext(
  host: BookEntryGenerationHost,
  window: BrowserWindow | null,
  request: BookContextExportRequest
): Promise<BookContextExportResult> {
  if (!existsSync(request.workspacePath)) {
    return { status: 'failed', error: 'The workspace folder is not on this computer.' }
  }
  const push = await readPushState(request.workspacePath)
  if (!('pushed' in push)) {
    return push
  }
  const home = os.homedir()
  const transcript = await readConversationMarkdown(request)
  const conversationMarkdown = transcript
    ? relativizeBookPaths(transcript, request.roots, home)
    : null
  const gitLog = await readRecentCommitSubjects(request.workspacePath)
  const summary = await runBookAgentText(
    host,
    buildBookSummaryPrompt({
      manifest: { ...request, branch: push.branch },
      transcript: boundedBookTranscript(
        conversationMarkdown ?? request.description,
        SUMMARY_TRANSCRIPT_LIMIT
      ),
      gitLog,
      language: request.language
    })
  )
  if (!summary.success) {
    return { status: 'failed', error: summary.error }
  }
  const folder = await pickFolder(window, request.title)
  if (!folder) {
    return { status: 'canceled' }
  }
  const stem = bookContextFileStem(request.title)
  const conversationFile = conversationMarkdown ? `${stem}${CONVERSATION_SUFFIX}` : undefined
  const manifest: BookContextManifest = {
    format: 'orca-book-context',
    version: 1,
    title: request.title,
    description: request.description,
    linkedTask: request.linkedTask,
    repo: request.repo,
    repoName: request.repoName,
    branch: push.branch,
    headCommit: push.headCommit,
    agent: request.conversation?.agent,
    conversationTitle: request.conversation?.title,
    exportedAt: new Date().toISOString(),
    sourcePlatform: process.platform,
    conversationFile
  }
  const summaryPath = join(folder, `${stem}${SUMMARY_SUFFIX}`)
  writeFileSync(
    summaryPath,
    embedBookContextManifest(relativizeBookPaths(summary.text, request.roots, home), manifest)
  )
  let conversationPath: string | undefined
  if (conversationMarkdown && conversationFile) {
    conversationPath = join(folder, conversationFile)
    writeFileSync(conversationPath, conversationMarkdown)
  }
  return { status: 'exported', summaryPath, conversationPath }
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
  if (!existsSync(summaryPath)) {
    return { status: 'invalid', error: `Missing ${basename(summaryPath)} next to the file.` }
  }
  const manifest = readBookContextManifest(readFileSync(summaryPath, 'utf-8'))
  if (!manifest) {
    return { status: 'invalid', error: 'This file is not an exported Orca Book context.' }
  }
  const conversationPath = manifest.conversationFile
    ? join(dirname(summaryPath), manifest.conversationFile)
    : undefined
  return {
    status: 'picked',
    manifest,
    summaryPath,
    conversationPath:
      conversationPath && existsSync(conversationPath) ? conversationPath : undefined
  }
}

/** Copies an imported context next to the Book catalog with `<REPO_ROOT>` set to this checkout. */
export function materializeBookContextImport(
  request: BookContextMaterializeRequest
): BookContextMaterializeResult {
  const separator = process.platform === 'win32' ? '\\' : '/'
  const folder = join(
    dirname(bookCatalogPath()),
    'book-imports',
    bookContextFileStem(request.folderName)
  )
  mkdirSync(folder, { recursive: true })
  const summaryText = restoreBookPaths(
    stripBookContextManifest(readFileSync(request.summaryPath, 'utf-8')),
    request.worktreePath,
    separator
  )
  let conversationPath: string | undefined
  if (request.conversationPath && existsSync(request.conversationPath)) {
    conversationPath = join(folder, basename(request.conversationPath))
    writeFileSync(
      conversationPath,
      restoreBookPaths(
        readFileSync(request.conversationPath, 'utf-8'),
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
  writeFileSync(summaryPath, handoffText)
  return { summaryPath, conversationPath, summaryText: handoffText }
}
