import type { BookCatalog, BookConversation, BookEntry, BookFolder } from './book-catalog-types'

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

/** One key per conversation: chat sessions by id, terminal agents by agent and provider session. */
export function bookConversationKey(conversation: BookConversation | undefined): string {
  if (!conversation) {
    return ''
  }
  return conversation.chatSessionId
    ? `chat:${conversation.chatSessionId}`
    : `cli:${conversation.agent}:${conversation.providerSessionId ?? ''}`
}

/** The entry that already holds this conversation, other than `exceptEntryId`. */
export function findBookEntryForConversation(
  catalog: BookCatalog,
  conversation: BookConversation | undefined,
  exceptEntryId: string | null
): BookEntry | undefined {
  // A terminal conversation without a provider id cannot be told apart from others of its agent.
  if (!conversation || (!conversation.chatSessionId && !conversation.providerSessionId)) {
    return undefined
  }
  const key = bookConversationKey(conversation)
  return catalog.entries.find(
    (entry) => entry.id !== exceptEntryId && bookConversationKey(entry.conversation) === key
  )
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
