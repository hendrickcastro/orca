import {
  EMPTY_BOOK_CATALOG,
  type BookCatalog,
  type BookEntry,
  type BookConversation,
  type BookFolder,
  type BookImportedContext,
  type BookLinkedTask,
  type BookRepoRef
} from './book-catalog-types'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeFolder(value: unknown): BookFolder | null {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    return null
  }
  return {
    id: value.id,
    name: value.name,
    parentId: typeof value.parentId === 'string' ? value.parentId : null,
    createdAt: finiteNumber(value.createdAt, 0)
  }
}

function normalizeLinkedTask(value: unknown): BookLinkedTask | undefined {
  if (!isObject(value) || typeof value.provider !== 'string' || typeof value.label !== 'string') {
    return undefined
  }
  return {
    provider: value.provider,
    label: value.label,
    title: optionalString(value.title),
    url: optionalString(value.url)
  }
}

function normalizeConversation(value: unknown): BookConversation | undefined {
  if (!isObject(value) || typeof value.agent !== 'string') {
    return undefined
  }
  const conversation: BookConversation = {
    agent: value.agent,
    providerSessionId: optionalString(value.providerSessionId),
    chatSessionId: optionalString(value.chatSessionId),
    paneKey: optionalString(value.paneKey),
    title: optionalString(value.title),
    cwd: optionalString(value.cwd),
    transcriptPath: optionalString(value.transcriptPath)
  }
  return conversation.providerSessionId || conversation.chatSessionId ? conversation : undefined
}

function normalizeRepoRef(value: unknown): BookRepoRef | undefined {
  if (!isObject(value)) {
    return undefined
  }
  const repo: BookRepoRef = {
    repoId: optionalString(value.repoId),
    projectId: optionalString(value.projectId),
    remoteUrl: optionalString(value.remoteUrl)
  }
  return repo.repoId || repo.projectId || repo.remoteUrl ? repo : undefined
}

function normalizeImportedContext(value: unknown): BookImportedContext | undefined {
  if (!isObject(value) || typeof value.summaryPath !== 'string' || !value.summaryPath) {
    return undefined
  }
  return {
    summaryPath: value.summaryPath,
    conversationPath: optionalString(value.conversationPath),
    agent: optionalString(value.agent)
  }
}

function normalizeEntry(value: unknown): BookEntry | null {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    typeof value.workspaceId !== 'string' ||
    typeof value.title !== 'string'
  ) {
    return null
  }
  const createdAt = finiteNumber(value.createdAt, 0)
  return {
    id: value.id,
    folderId: typeof value.folderId === 'string' ? value.folderId : null,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    workspaceId: value.workspaceId,
    workspaceName: typeof value.workspaceName === 'string' ? value.workspaceName : value.title,
    repoName: optionalString(value.repoName),
    branch: optionalString(value.branch),
    path: optionalString(value.path),
    linkedTask: normalizeLinkedTask(value.linkedTask),
    conversation: normalizeConversation(value.conversation),
    repo: normalizeRepoRef(value.repo),
    importedContext: normalizeImportedContext(value.importedContext),
    createdAt,
    updatedAt: finiteNumber(value.updatedAt, createdAt)
  }
}

/** Reads a catalog from disk or IPC; drops malformed rows and re-roots orphans instead of failing. */
export function normalizeBookCatalog(value: unknown): BookCatalog {
  if (!isObject(value)) {
    return EMPTY_BOOK_CATALOG
  }
  const folders = (Array.isArray(value.folders) ? value.folders : [])
    .map(normalizeFolder)
    .filter((folder): folder is BookFolder => folder !== null)
  const folderIds = new Set(folders.map((folder) => folder.id))
  const rootedFolders = folders.map((folder) =>
    folder.parentId && !folderIds.has(folder.parentId) ? { ...folder, parentId: null } : folder
  )
  const entries = (Array.isArray(value.entries) ? value.entries : [])
    .map(normalizeEntry)
    .filter((entry): entry is BookEntry => entry !== null)
    .map((entry) =>
      entry.folderId && !folderIds.has(entry.folderId) ? { ...entry, folderId: null } : entry
    )
  return { version: 1, folders: breakFolderCycles(rootedFolders), entries }
}

function breakFolderCycles(folders: BookFolder[]): BookFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  return folders.map((folder) => {
    const seen = new Set<string>([folder.id])
    let parentId = folder.parentId
    while (parentId) {
      if (seen.has(parentId)) {
        return { ...folder, parentId: null }
      }
      seen.add(parentId)
      parentId = byId.get(parentId)?.parentId ?? null
    }
    return folder
  })
}

export function childFolders(catalog: BookCatalog, parentId: string | null): BookFolder[] {
  return catalog.folders
    .filter((folder) => folder.parentId === parentId)
    .sort((left, right) => left.name.localeCompare(right.name))
}

/** The folder and every folder nested under it. */
export function folderSubtreeIds(catalog: BookCatalog, folderId: string): Set<string> {
  const ids = new Set<string>([folderId])
  let added = true
  while (added) {
    added = false
    for (const folder of catalog.folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id)
        added = true
      }
    }
  }
  return ids
}

/** Root-to-folder chain, for breadcrumbs and the folder picker labels. */
export function folderPath(catalog: BookCatalog, folderId: string | null): BookFolder[] {
  const byId = new Map(catalog.folders.map((folder) => [folder.id, folder]))
  const path: BookFolder[] = []
  let current = folderId ? byId.get(folderId) : undefined
  while (current && path.length <= catalog.folders.length) {
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

export function addBookFolder(
  catalog: BookCatalog,
  folder: { id: string; name: string; parentId: string | null; createdAt: number }
): BookCatalog {
  const name = folder.name.trim()
  if (!name) {
    return catalog
  }
  return { ...catalog, folders: [...catalog.folders, { ...folder, name }] }
}

export function renameBookFolder(
  catalog: BookCatalog,
  folderId: string,
  name: string
): BookCatalog {
  const trimmed = name.trim()
  if (!trimmed) {
    return catalog
  }
  return {
    ...catalog,
    folders: catalog.folders.map((folder) =>
      folder.id === folderId ? { ...folder, name: trimmed } : folder
    )
  }
}

/** Moving a folder into itself or a descendant is refused so the tree can't become a cycle. */
export function moveBookFolder(
  catalog: BookCatalog,
  folderId: string,
  parentId: string | null
): BookCatalog {
  if (parentId && folderSubtreeIds(catalog, folderId).has(parentId)) {
    return catalog
  }
  return {
    ...catalog,
    folders: catalog.folders.map((folder) =>
      folder.id === folderId ? { ...folder, parentId } : folder
    )
  }
}

/** Deleting a folder keeps its contents: sub-folders and entries move up to its parent. */
export function deleteBookFolder(catalog: BookCatalog, folderId: string): BookCatalog {
  const target = catalog.folders.find((folder) => folder.id === folderId)
  if (!target) {
    return catalog
  }
  return {
    ...catalog,
    folders: catalog.folders
      .filter((folder) => folder.id !== folderId)
      .map((folder) =>
        folder.parentId === folderId ? { ...folder, parentId: target.parentId } : folder
      ),
    entries: catalog.entries.map((entry) =>
      entry.folderId === folderId ? { ...entry, folderId: target.parentId } : entry
    )
  }
}

export function upsertBookEntry(catalog: BookCatalog, entry: BookEntry): BookCatalog {
  const exists = catalog.entries.some((candidate) => candidate.id === entry.id)
  return {
    ...catalog,
    entries: exists
      ? catalog.entries.map((candidate) => (candidate.id === entry.id ? entry : candidate))
      : [entry, ...catalog.entries]
  }
}

export function moveBookEntry(
  catalog: BookCatalog,
  entryId: string,
  folderId: string | null,
  now: number
): BookCatalog {
  return {
    ...catalog,
    entries: catalog.entries.map((entry) =>
      entry.id === entryId ? { ...entry, folderId, updatedAt: now } : entry
    )
  }
}

export function removeBookEntry(catalog: BookCatalog, entryId: string): BookCatalog {
  return { ...catalog, entries: catalog.entries.filter((entry) => entry.id !== entryId) }
}

/** Case- and accent-insensitive match over everything a user might remember about the work. */
export function bookEntryMatchesQuery(entry: BookEntry, query: string): boolean {
  const needle = foldSearchText(query.trim())
  if (!needle) {
    return true
  }
  const haystack = foldSearchText(
    [
      entry.title,
      entry.description,
      entry.workspaceName,
      entry.repoName,
      entry.branch,
      entry.linkedTask?.label,
      entry.linkedTask?.title
    ]
      .filter(Boolean)
      .join('\n')
  )
  return needle.split(/\s+/).every((word) => haystack.includes(word))
}

function foldSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
