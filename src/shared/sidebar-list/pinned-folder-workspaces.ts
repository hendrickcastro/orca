import type { Worktree } from '../worktree/types'
import { getWorktreeHostIdentity } from '../worktree/host-qualified-identity'
import type { WorktreeOccurrenceSection } from './lineage/worktree-occurrence-plan'
import type { RenderableFolderWorkspace } from './folders/folder-workspace-lanes'
import type { WorktreeGroupEntry } from './sections/worktree-group-entry'
import { PINNED_GROUP_KEY } from './sections/group-keys'
import { PINNED_FAVORITES_GROUP_KEY } from './pinned-favorites'
import type { PinnedWorktreeDisplayPolicy } from './row-types'

export { emitPinnedSections } from './pinned-section-rows'

// Fork: a pinned folder workspace (a multi-repository task) moves to Pinned like a pinned worktree;
// upstream's lineage nesting brings its member worktrees along under it.

type PlannedSection = WorktreeOccurrenceSection<Worktree> & { group: WorktreeGroupEntry }

/** Folder workspaces that still render in their lanes. */
export function naturalFolders(
  folderWorkspaces: RenderableFolderWorkspace[],
  policy: PinnedWorktreeDisplayPolicy
): RenderableFolderWorkspace[] {
  return policy === 'duplicate-in-groups'
    ? folderWorkspaces
    : folderWorkspaces.filter((pair) => !pair.folderWorkspace.isPinned)
}

/** Every pinned row with the descendants it carries, starting from the favourite roots. */
function collectFavoriteRows(
  pinned: readonly Worktree[],
  favoriteIds: ReadonlySet<string>,
  childrenByParentIdentity: ReadonlyMap<string, readonly Worktree[]>
): Set<Worktree> {
  const pinnedByIdentity = new Map(pinned.map((row) => [getWorktreeHostIdentity(row), row]))
  const favorites = new Set<Worktree>()
  const pending = pinned.filter((row) => favoriteIds.has(row.id))
  for (let row = pending.pop(); row; row = pending.pop()) {
    if (favorites.has(row)) {
      continue
    }
    favorites.add(row)
    for (const child of childrenByParentIdentity.get(getWorktreeHostIdentity(row)) ?? []) {
      const listed = pinnedByIdentity.get(getWorktreeHostIdentity(child))
      if (listed) {
        pending.push(listed)
      }
    }
  }
  return favorites
}

/**
 * Splits favourite pinned workspaces into their own section above Pinned and drops pinned folder
 * workspaces from the lanes they would otherwise still list.
 */
export function pinnedSections(
  sections: readonly PlannedSection[],
  pinned: readonly Worktree[],
  childrenByParentIdentity: ReadonlyMap<string, readonly Worktree[]>,
  inputs: {
    pinnedFavoriteIds?: ReadonlySet<string>
    pinnedDisplayPolicy: PinnedWorktreeDisplayPolicy
  }
): PlannedSection[] {
  const pinnedRows = new Set(pinned)
  const dropPinnedFolders =
    inputs.pinnedDisplayPolicy !== 'duplicate-in-groups' && pinnedRows.size > 0
  const favoriteIds = inputs.pinnedFavoriteIds
  const favorites =
    favoriteIds && favoriteIds.size > 0
      ? collectFavoriteRows(pinned, favoriteIds, childrenByParentIdentity)
      : new Set<Worktree>()
  const result: PlannedSection[] = []
  for (const section of sections) {
    if (section.key === PINNED_GROUP_KEY) {
      if (favorites.size > 0) {
        const items = section.items.filter((row) => favorites.has(row))
        result.push({
          key: PINNED_FAVORITES_GROUP_KEY,
          group: { label: '', items, repoIds: new Set() },
          placement: 'pinned',
          items,
          revealPath: { key: PINNED_FAVORITES_GROUP_KEY }
        })
        const rest = section.items.filter((row) => !favorites.has(row))
        result.push({ ...section, group: { ...section.group, items: rest }, items: rest })
      } else {
        result.push(section)
      }
      continue
    }
    result.push(
      dropPinnedFolders && section.placement !== 'pinned'
        ? { ...section, items: section.items.filter((row) => !pinnedRows.has(row)) }
        : section
    )
  }
  return result
}
