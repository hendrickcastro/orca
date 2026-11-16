/** Header of the sidebar section that lists favourite pinned workspaces above Pinned. */
export const PINNED_FAVORITES_GROUP_KEY = 'pinned-favorites'

const EMPTY_FAVORITES: ReadonlySet<string> = new Set()

/** Favourite workspace ids (worktree ids or `folder:<id>` keys); only pinned ones are shown. */
export function getPinnedFavoriteIds(
  settings: { pinnedFavoriteWorkspaceIds?: readonly string[] } | null | undefined
): ReadonlySet<string> {
  const ids = settings?.pinnedFavoriteWorkspaceIds
  return ids && ids.length > 0 ? new Set(ids) : EMPTY_FAVORITES
}
