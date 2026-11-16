import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import type { BookEntry } from '../../../../shared/fork-book/book-catalog-types'
import { findBookWorktree } from './book-entry-snapshot'

/** True while the saved workspace still exists, so the row can offer to open it. */
export function isBookEntryWorkspaceLive(entry: BookEntry): boolean {
  return findBookWorktree(useAppStore.getState(), entry.workspaceId) !== null
}

/**
 * Opens the saved workspace and scrolls the sidebar to it. A workspace removed since it was
 * saved can't be reopened; the toast names its branch so it can be recreated from there.
 */
export function openBookEntry(entry: BookEntry): boolean {
  const worktree = findBookWorktree(useAppStore.getState(), entry.workspaceId)
  if (!worktree) {
    toast.error(translate('forkBook.workspaceGone', 'This workspace no longer exists.'), {
      description: [entry.repoName, entry.branch].filter(Boolean).join(' · ') || undefined
    })
    return false
  }
  return activateAndRevealWorkspace(worktree.id) !== false
}
