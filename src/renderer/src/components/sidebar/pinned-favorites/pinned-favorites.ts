import { Star } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { Worktree } from '../../../../../shared/worktree/types'
import { folderWorkspaceKey } from '../../../../../shared/workspace-scope'

/** Header of the sidebar section that lists favourite pinned workspaces above Pinned. */
export const PINNED_FAVORITES_GROUP_KEY = 'pinned-favorites'

export const PINNED_FAVORITES_GROUP_META = {
  get label() {
    return translate('pinnedFavorites.section', 'Favorites')
  },
  tone: 'text-foreground',
  icon: Star
} as const

const EMPTY_FAVORITES: ReadonlySet<string> = new Set()

/** Favourite workspace ids (worktree ids or `folder:<id>` keys); only pinned ones are shown. */
export function getPinnedFavoriteIds(
  settings: { pinnedFavoriteWorkspaceIds?: readonly string[] } | null | undefined
): ReadonlySet<string> {
  const ids = settings?.pinnedFavoriteWorkspaceIds
  return ids && ids.length > 0 ? new Set(ids) : EMPTY_FAVORITES
}

export function togglePinnedFavoriteId(ids: readonly string[] | undefined, id: string): string[] {
  const current = ids ?? []
  return current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
}

/**
 * Why an "open" key: a pinned task starts folded so its repos do not crowd the section, and
 * the shared collapse toggle flips a key's presence, so presence here means unfolded.
 */
export function getPinnedTaskOpenKey(folderWorkspaceId: string): string {
  return `pinned-task-open:${folderWorkspaceId}`
}

/** Splits what the Pinned section would list into the favourites and the rest, keeping order. */
export function splitPinnedFavorites<Section extends { pair: { folderWorkspace: { id: string } } }>(
  favoriteIds: ReadonlySet<string>,
  worktrees: readonly Worktree[],
  tasks: readonly Section[]
): {
  favorites: { worktrees: Worktree[]; tasks: Section[] }
  rest: { worktrees: Worktree[]; tasks: Section[] }
} {
  const isFavoriteTask = (task: Section): boolean =>
    favoriteIds.has(folderWorkspaceKey(task.pair.folderWorkspace.id))
  return {
    favorites: {
      worktrees: worktrees.filter((worktree) => favoriteIds.has(worktree.id)),
      tasks: tasks.filter(isFavoriteTask)
    },
    rest: {
      worktrees: worktrees.filter((worktree) => !favoriteIds.has(worktree.id)),
      tasks: tasks.filter((task) => !isFavoriteTask(task))
    }
  }
}
