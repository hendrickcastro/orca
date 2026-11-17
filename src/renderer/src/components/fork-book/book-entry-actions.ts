import { useAppStore } from '@/store/index'
import { upsertBookEntry } from '../../../../shared/fork-book/book-catalog-operations'
import type { BookEntry } from '../../../../shared/fork-book/book-catalog-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { useBookStore } from './book-store'
import { findBookWorktree } from './book-entry-snapshot'
import { openBookEntry } from './book-conversation-open'
import { handOffBookEntry } from './book-handoff'
import { recreateBookEntryWorkspace } from './book-workspace-recreate'

function latestEntry(entryId: string): BookEntry | undefined {
  return useBookStore.getState().catalog.entries.find((entry) => entry.id === entryId)
}

function commitEntry(entryId: string, update: (entry: BookEntry) => BookEntry): void {
  useBookStore.getState().commit((catalog) => {
    const entry = catalog.entries.find((candidate) => candidate.id === entryId)
    return entry ? upsertBookEntry(catalog, update(entry)) : catalog
  })
}

/** "Open agent": the saved conversation, or the recreate prompt when the workspace is gone. */
export async function openBookEntryAction(entry: BookEntry): Promise<void> {
  if ((await openBookEntry(entry)) === 'workspace-gone') {
    useBookStore.getState().setRecreatePrompt({ entryId: entry.id, next: 'open' })
  }
}

/** "Hand off to a new agent", into the live workspace or one recreated on the saved branch. */
export function handOffBookEntryAction(entry: BookEntry): void {
  const worktree = findBookWorktree(useAppStore.getState(), entry.workspaceId)
  if (worktree) {
    void handOffBookEntry(entry, worktree)
    return
  }
  useBookStore.getState().setRecreatePrompt({ entryId: entry.id, next: 'handoff' })
}

/**
 * Recreates the removed workspace, then reopens the conversation. A terminal agent resumes only
 * when the new checkout sits where it ran before; anywhere else it continues in a new agent.
 */
export async function recreateAndContinueBookEntry(
  entryId: string,
  next: 'open' | 'handoff'
): Promise<boolean> {
  const entry = latestEntry(entryId)
  if (!entry) {
    return false
  }
  const worktree = await recreateBookEntryWorkspace(entry, (update) => commitEntry(entryId, update))
  if (!worktree) {
    return false
  }
  const updated = latestEntry(entryId) ?? {
    ...entry,
    workspaceId: worktree.id,
    path: worktree.path
  }
  await (next === 'open' && resumesInPlace(updated, worktree)
    ? openBookEntry(updated)
    : handOffBookEntry(updated, worktree))
  return true
}

function resumesInPlace(entry: BookEntry, worktree: Worktree): boolean {
  const conversation = entry.conversation
  if (!conversation || conversation.chatSessionId) {
    return !conversation
  }
  const normalize = (path: string | undefined): string =>
    (path ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return normalize(conversation.cwd ?? entry.path) === normalize(worktree.path)
}
