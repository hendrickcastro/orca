import {
  EMPTY_BOOK_CATALOG,
  type BookCatalog,
  type BookConversation,
  type BookEntry,
  type BookFolder,
  type BookImportedContext,
  type BookLinkedTask,
  type BookRepoRef,
  type BookWorkspaceMember
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

export function normalizeBookMembers(value: unknown): BookWorkspaceMember[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }
  const members = value.flatMap((item): BookWorkspaceMember[] => {
    const repo = isObject(item) ? normalizeRepoRef(item.repo) : undefined
    return repo && isObject(item)
      ? [{ repo, repoName: optionalString(item.repoName), branch: optionalString(item.branch) }]
      : []
  })
  return members.length > 0 ? members : undefined
}

/** The repositories an entry spans: its members, or its single repo on its branch. */
export function bookEntryMembers(entry: BookEntry): BookWorkspaceMember[] {
  if (entry.members && entry.members.length > 0) {
    return entry.members
  }
  return entry.repo ? [{ repo: entry.repo, repoName: entry.repoName, branch: entry.branch }] : []
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
    members: normalizeBookMembers(value.members),
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
