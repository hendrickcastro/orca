import { create } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import {
  EMPTY_BOOK_CATALOG,
  type BookCatalog,
  type BookConversation,
  type BookEntry
} from '../../../../shared/fork-book/book-catalog-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { draftBookEntryText } from '../../../../shared/fork-book/book-entry-text'
import {
  findBookWorktree,
  snapshotBookWorkspace,
  type BookWorkspaceSnapshot
} from './book-entry-snapshot'
import type { AgentSessionContinuationRequest } from '@/lib/agent-session/context/agent-session-continuation'

/** Selection value that lists every entry; folder ids are UUIDs, so it cannot collide. */
export const BOOK_ALL_ENTRIES = '__all__'

/** A folder id, `null` for the root folder, or BOOK_ALL_ENTRIES. */
export type BookFolderSelection = string | null

export type BookEditorState = {
  /** Null while creating a new entry. */
  entryId: string | null
  snapshot: BookWorkspaceSnapshot | null
  title: string
  description: string
  folderId: string | null
  /** The conversation 'Open agent' returns to; undefined saves the workspace only. */
  conversation: BookConversation | undefined
}

/** A pending hand-off of a saved conversation to a new agent; null request while it loads. */
export type BookContinuationState = {
  entryId: string
  request: AgentSessionContinuationRequest | null
  sourceWorkingDirectory?: string
}

/** A saved entry whose workspace was removed, waiting for the user to recreate it. */
/** Choose the entry's repositories and checkouts, then open its agent, hand it off, or just save. */
export type BookWorkspacePrompt = { entryId: string; next: 'open' | 'handoff' | 'save' }

type BookStore = {
  catalog: BookCatalog
  loadState: 'idle' | 'loading' | 'ready' | 'error'
  selectedFolder: BookFolderSelection
  query: string
  editor: BookEditorState | null
  continuation: BookContinuationState | null
  setContinuation: (continuation: BookContinuationState | null) => void
  workspacePrompt: BookWorkspacePrompt | null
  setWorkspacePrompt: (prompt: BookWorkspacePrompt | null) => void
  ensureLoaded: () => Promise<void>
  commit: (update: (catalog: BookCatalog) => BookCatalog) => void
  setSelectedFolder: (folder: BookFolderSelection) => void
  setQuery: (query: string) => void
  openEditorForWorkspace: (worktree: Worktree) => void
  openEditorForEntry: (entry: BookEntry) => void
  updateEditor: (patch: Partial<BookEditorState>) => void
  closeEditor: () => void
}

let saveChain: Promise<unknown> = Promise.resolve()

// Why: saves are serialized so a slow write can never land after a newer catalog.
function persist(catalog: BookCatalog): void {
  saveChain = saveChain
    .then(() => window.api.forkBook.save(catalog))
    .catch(() => {
      toast.error(translate('forkBook.saveFailed', 'Book could not be saved.'))
    })
}

export const useBookStore = create<BookStore>((set, get) => ({
  catalog: EMPTY_BOOK_CATALOG,
  loadState: 'idle',
  selectedFolder: BOOK_ALL_ENTRIES,
  query: '',
  editor: null,
  continuation: null,
  setContinuation: (continuation) => set({ continuation }),
  workspacePrompt: null,
  setWorkspacePrompt: (workspacePrompt) => set({ workspacePrompt }),
  ensureLoaded: async () => {
    if (get().loadState === 'loading' || get().loadState === 'ready') {
      return
    }
    set({ loadState: 'loading' })
    try {
      const catalog = await window.api.forkBook.load()
      set({ catalog, loadState: 'ready' })
    } catch {
      set({ loadState: 'error' })
    }
  },
  commit: (update) => {
    const next = update(get().catalog)
    if (next === get().catalog) {
      return
    }
    set({ catalog: next })
    persist(next)
  },
  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),
  setQuery: (query) => set({ query }),
  openEditorForWorkspace: (worktree) => {
    void get().ensureLoaded()
    const snapshot = snapshotBookWorkspace(useAppStore.getState(), worktree)
    const draft = draftBookEntryText(snapshot.context)
    const selected = get().selectedFolder
    set({
      editor: {
        entryId: null,
        snapshot,
        title: draft.title,
        description: draft.description,
        folderId: selected === BOOK_ALL_ENTRIES ? null : selected,
        conversation: snapshot.conversations[0]?.conversation
      }
    })
  },
  openEditorForEntry: (entry) => {
    // A live workspace lets the user re-pick which of its conversations the entry opens.
    const state = useAppStore.getState()
    const worktree = findBookWorktree(state, entry.workspaceId)
    set({
      editor: {
        entryId: entry.id,
        snapshot: worktree ? snapshotBookWorkspace(state, worktree) : null,
        title: entry.title,
        description: entry.description,
        folderId: entry.folderId,
        conversation: entry.conversation
      }
    })
  },
  updateEditor: (patch) => {
    const editor = get().editor
    if (editor) {
      set({ editor: { ...editor, ...patch } })
    }
  },
  closeEditor: () => set({ editor: null })
}))
