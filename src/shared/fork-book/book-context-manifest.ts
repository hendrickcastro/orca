import type { BookLinkedTask, BookRepoRef, BookWorkspaceMember } from './book-catalog-types'
import { normalizeBookMembers } from './book-catalog-normalization'

const MANIFEST_OPEN = '<!-- orca-book-context'
const MANIFEST_CLOSE = '-->'

/** Work that existed only on the exporting computer; it does not travel with the files. */
export type BookPendingWork = {
  uncommittedFiles: string[]
  unpushedCommits: number
  branchOnRemote: boolean
}

export function hasBookPendingWork(pending: BookPendingWork | undefined): boolean {
  return Boolean(
    pending &&
    (pending.uncommittedFiles.length > 0 || pending.unpushedCommits > 0 || !pending.branchOnRemote)
  )
}

/** Appended to the summary so whoever continues knows what was left on the other computer. */
export function renderBookPendingWork(pending: BookPendingWork): string {
  if (!hasBookPendingWork(pending)) {
    return ''
  }
  const lines = ['## Pending work when exported', '']
  if (!pending.branchOnRemote) {
    lines.push('- The branch was not on the remote; the code must be pushed or redone.')
  }
  if (pending.unpushedCommits > 0) {
    lines.push(`- ${pending.unpushedCommits} commit(s) were not pushed.`)
  }
  if (pending.uncommittedFiles.length > 0) {
    lines.push('- Uncommitted changes (not included in these files):')
    lines.push(...pending.uncommittedFiles.map((file) => `  - ${file}`))
  }
  return lines.join('\n')
}

/** What an exported context carries besides its two Markdown files. */
export type BookContextManifest = {
  format: 'orca-book-context'
  version: 1
  title: string
  description: string
  linkedTask?: BookLinkedTask
  repo?: BookRepoRef
  repoName?: string
  branch: string
  headCommit: string
  agent?: string
  conversationTitle?: string
  exportedAt: string
  sourcePlatform: string
  /** File names, relative to the summary file. */
  conversationFile?: string
  pendingWork?: BookPendingWork
  /** Every repository of a multi-repo export, so the importer can preselect them. */
  members?: BookWorkspaceMember[]
}

export function embedBookContextManifest(markdown: string, manifest: BookContextManifest): string {
  return `${MANIFEST_OPEN}\n${JSON.stringify(manifest, null, 2)}\n${MANIFEST_CLOSE}\n\n${markdown}`
}

/** Reads the manifest an export put at the top of its summary file; null for any other file. */
export function readBookContextManifest(markdown: string): BookContextManifest | null {
  const start = markdown.indexOf(MANIFEST_OPEN)
  if (start !== 0 && markdown.slice(0, start).trim() !== '') {
    return null
  }
  const end = markdown.indexOf(MANIFEST_CLOSE, start + MANIFEST_OPEN.length)
  if (start === -1 || end === -1) {
    return null
  }
  let value: unknown
  try {
    value = JSON.parse(markdown.slice(start + MANIFEST_OPEN.length, end))
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const raw = new Map(Object.entries(value))
  const text = (key: string): string | undefined => {
    const field = raw.get(key)
    return typeof field === 'string' && field ? field : undefined
  }
  const branch = text('branch') ?? ''
  const title = text('title')
  if (raw.get('format') !== 'orca-book-context' || !title) {
    return null
  }
  const linkedTask = raw.get('linkedTask')
  const repo = raw.get('repo')
  return {
    format: 'orca-book-context',
    version: 1,
    title,
    description: text('description') ?? '',
    linkedTask: readLinkedTask(linkedTask),
    repo: readRepoRef(repo),
    repoName: text('repoName'),
    branch,
    headCommit: text('headCommit') ?? '',
    agent: text('agent'),
    conversationTitle: text('conversationTitle'),
    exportedAt: text('exportedAt') ?? '',
    sourcePlatform: text('sourcePlatform') ?? '',
    conversationFile: text('conversationFile'),
    pendingWork: readPendingWork(raw.get('pendingWork')),
    members: normalizeBookMembers(raw.get('members'))
  }
}

function readPendingWork(value: unknown): BookPendingWork | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const raw = new Map(Object.entries(value))
  const files = raw.get('uncommittedFiles')
  const unpushed = raw.get('unpushedCommits')
  return {
    uncommittedFiles: Array.isArray(files)
      ? files.filter((file): file is string => typeof file === 'string')
      : [],
    unpushedCommits: typeof unpushed === 'number' ? unpushed : 0,
    branchOnRemote: raw.get('branchOnRemote') !== false
  }
}

function readStringField(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const field = new Map(Object.entries(value)).get(key)
  return typeof field === 'string' && field ? field : undefined
}

function readLinkedTask(value: unknown): BookLinkedTask | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const provider = readStringField(value, 'provider')
  const label = readStringField(value, 'label')
  return provider && label
    ? {
        provider,
        label,
        title: readStringField(value, 'title'),
        url: readStringField(value, 'url')
      }
    : undefined
}

function readRepoRef(value: unknown): BookRepoRef | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  return {
    repoId: readStringField(value, 'repoId'),
    projectId: readStringField(value, 'projectId'),
    remoteUrl: readStringField(value, 'remoteUrl')
  }
}

/** The summary file's Markdown without the manifest comment, for the continuation prompt. */
export function stripBookContextManifest(markdown: string): string {
  const end = markdown.startsWith(MANIFEST_OPEN) ? markdown.indexOf(MANIFEST_CLOSE) : -1
  return end < 0 ? markdown : markdown.slice(end + MANIFEST_CLOSE.length).trimStart()
}
