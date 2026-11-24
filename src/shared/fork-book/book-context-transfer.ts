import type { BookLinkedTask, BookRepoRef, BookWorkspaceMember } from './book-catalog-types'
import type { BookContextManifest, BookPendingWork } from './book-context-manifest'

/** Placeholder for the repository checkout, so exported paths work on any computer. */
export const BOOK_REPO_ROOT_TOKEN = '<REPO_ROOT>'
export const BOOK_HOME_TOKEN = '<HOME>'

export type BookTranscriptBlock =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; name: string; input: unknown }
  | { type: 'tool-result'; output: string; isError?: boolean }
  | { type: 'other' }

export type BookTranscriptMessage = {
  role: string
  timestamp: number | null
  blocks: BookTranscriptBlock[]
}

const TOOL_INPUT_LIMIT = 600
const TOOL_OUTPUT_LIMIT = 2000

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function clip(text: string, limit: number): string {
  return text.length > limit
    ? `${text.slice(0, limit)}\n… (${text.length - limit} more characters)`
    : text
}

function fence(text: string): string {
  const longest = (text.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0)
  const ticks = '`'.repeat(Math.max(3, longest + 1))
  return `${ticks}\n${text}\n${ticks}`
}

/**
 * Every spelling a path can take in a transcript: as written, with the other slash style,
 * and JSON-escaped. Windows paths also match any drive-letter case.
 */
function pathSpellings(path: string): RegExp[] {
  const trimmed = path.replace(/[\\/]+$/, '')
  if (!trimmed) {
    return []
  }
  const forward = trimmed.replace(/\\/g, '/')
  const backward = trimmed.replace(/\//g, '\\')
  const escaped = backward.replace(/\\/g, '\\\\')
  const windows = /^[a-z]:/i.test(trimmed)
  return [...new Set([escaped, backward, forward])].map(
    (spelling) => new RegExp(escapeRegExp(spelling), windows ? 'gi' : 'g')
  )
}

/** Replaces the checkout roots and the home folder with placeholders; longest roots first. */
export function relativizeBookPaths(text: string, roots: readonly string[], home?: string): string {
  let result = text
  const ordered = [...new Set(roots.filter(Boolean))].sort(
    (left, right) => right.length - left.length
  )
  for (const root of ordered) {
    for (const pattern of pathSpellings(root)) {
      result = result.replace(pattern, BOOK_REPO_ROOT_TOKEN)
    }
  }
  if (home) {
    for (const pattern of pathSpellings(home)) {
      result = result.replace(pattern, BOOK_HOME_TOKEN)
    }
  }
  return result
}

/** Puts the new checkout back in place of the placeholder, with this computer's separators. */
export function restoreBookPaths(text: string, root: string, separator: '/' | '\\'): string {
  const base = root.replace(/[\\/]+$/, '').replace(/[\\/]/g, separator)
  return text.replace(
    /<REPO_ROOT>((?:[\\/][^\s"'`<>|)\]]*)?)/g,
    (_match, tail: string) => `${base}${tail.replace(/\\\\|[\\/]/g, separator)}`
  )
}

function renderBlock(block: BookTranscriptBlock): string | null {
  if (block.type === 'text') {
    return block.text.trim() || null
  }
  if (block.type === 'tool-call') {
    const input =
      typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 1)
    return `**Tool call · ${block.name}**\n\n${fence(clip(input ?? '', TOOL_INPUT_LIMIT))}`
  }
  if (block.type === 'tool-result') {
    const label = block.isError ? 'Tool error' : 'Tool result'
    return `**${label}**\n\n${fence(clip(block.output, TOOL_OUTPUT_LIMIT))}`
  }
  return null
}

/** The whole conversation as readable Markdown; tool payloads are clipped, text never is. */
export function renderBookTranscript(
  messages: readonly BookTranscriptMessage[],
  heading: string
): string {
  const parts: string[] = [`# ${heading}`]
  for (const message of messages) {
    const body = message.blocks
      .map(renderBlock)
      .filter((part): part is string => part !== null)
      .join('\n\n')
    if (!body) {
      continue
    }
    const when = message.timestamp ? ` · ${new Date(message.timestamp).toISOString()}` : ''
    const who =
      message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : message.role
    parts.push(`## ${who}${when}\n\n${body}`)
  }
  return `${parts.join('\n\n')}\n`
}

/** Keeps the opening request and the most recent work, which is what a summary needs. */
export function boundedBookTranscript(markdown: string, limit: number): string {
  if (markdown.length <= limit) {
    return markdown
  }
  const head = Math.floor(limit * 0.3)
  return `${markdown.slice(0, head)}\n\n… (middle of the conversation omitted) …\n\n${markdown.slice(markdown.length - (limit - head))}`
}

export function buildBookSummaryPrompt(input: {
  manifest: Pick<
    BookContextManifest,
    'title' | 'description' | 'linkedTask' | 'repoName' | 'branch'
  >
  transcript: string
  gitLog: string[]
  language: string
}): string {
  const { manifest } = input
  const facts = [
    `Title: ${manifest.title}`,
    manifest.description ? `Saved description:\n${manifest.description}` : '',
    manifest.linkedTask
      ? `Linked task: ${manifest.linkedTask.label}${manifest.linkedTask.title ? ` — ${manifest.linkedTask.title}` : ''}`
      : '',
    `Repository: ${manifest.repoName ?? ''} · branch ${manifest.branch}`,
    input.gitLog.length > 0
      ? `Commits on the branch (newest first):\n${input.gitLog.join('\n')}`
      : ''
  ].filter(Boolean)
  return [
    'You write hand-off notes so another developer, or an AI agent on another computer, can continue this task.',
    `Write in the language with BCP 47 tag "${input.language}", as Markdown, with these sections:`,
    'Goal; Current state; Done so far; Next steps; Decisions and constraints; Relevant files; How to continue.',
    `Paths are relative to the repository: keep them written as ${BOOK_REPO_ROOT_TOKEN}/... and never invent absolute paths.`,
    'Be specific and faithful to the conversation. Do not invent facts. Answer with the Markdown only.',
    '',
    facts.join('\n\n'),
    '',
    'Conversation:',
    input.transcript
  ].join('\n')
}

export function bookContextFileStem(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'orca-book-context'
}

export type BookContextExportRequest = {
  title: string
  description: string
  linkedTask?: BookLinkedTask
  repo?: BookRepoRef
  repoName?: string
  members?: BookWorkspaceMember[]
  /** The local checkout; git and the export run here. */
  workspacePath: string
  /** Paths written as `<REPO_ROOT>` in the files: the checkout and where the agent ran. */
  roots: string[]
  conversation?: { agent: string; sessionId: string; filePath?: string; title?: string }
  language: string
}

export type BookContextExportResult =
  | {
      status: 'exported'
      summaryPath: string
      conversationPath: string
      pendingWork: BookPendingWork
    }
  | { status: 'canceled' }
  | { status: 'no-conversation' }
  | { status: 'failed'; error: string }

export type BookContextImportPick =
  | {
      status: 'picked'
      manifest: BookContextManifest
      summaryPath: string
      conversationPath?: string
    }
  | { status: 'canceled' }
  | { status: 'invalid'; error: string }

export type BookContextMaterializeRequest = {
  summaryPath: string
  conversationPath?: string
  /** The checkout on this computer that replaces `<REPO_ROOT>`. */
  worktreePath: string
  folderName: string
}

export type BookContextMaterializeResult = {
  summaryPath: string
  conversationPath?: string
  summaryText: string
}
