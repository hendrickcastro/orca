/** A folder in the Book catalog; `parentId` null means it sits at the root. */
export type BookFolder = {
  id: string
  name: string
  parentId: string | null
  createdAt: number
}

/** The task a saved workspace was linked to, frozen at save time. */
export type BookLinkedTask = {
  provider: string
  label: string
  title?: string
  url?: string
}

/**
 * One saved piece of agent work. The workspace fields are a snapshot so the entry stays
 * readable (and findable) after the workspace itself is renamed, archived or deleted.
 */
export type BookEntry = {
  id: string
  folderId: string | null
  title: string
  description: string
  /** Worktree id, or `folder:<id>` for folder and multi-repo workspaces. */
  workspaceId: string
  workspaceName: string
  repoName?: string
  branch?: string
  path?: string
  linkedTask?: BookLinkedTask
  createdAt: number
  updatedAt: number
}

export type BookCatalog = {
  version: 1
  folders: BookFolder[]
  entries: BookEntry[]
}

export const EMPTY_BOOK_CATALOG: BookCatalog = { version: 1, folders: [], entries: [] }

/** Workspace facts used to prefill and to AI-generate an entry's title and description. */
export type BookEntryContext = {
  workspaceName: string
  repoName?: string
  branch?: string
  path?: string
  comment?: string
  linkedTask?: BookLinkedTask
  agentTitles: string[]
  memberWorkspaces: { name: string; repoName?: string; branch?: string }[]
}

export type BookEntryGenerationRequest = {
  context: BookEntryContext
  /** Recent commit subjects on the workspace branch, read by main from `path`. */
  includeGitLog: boolean
  /** BCP 47 tag of the UI language the text should be written in. */
  language: string
}

export type BookEntryGenerationResult =
  | { success: true; title: string; description: string; agentLabel?: string }
  | { success: false; error: string; canceled?: boolean }
