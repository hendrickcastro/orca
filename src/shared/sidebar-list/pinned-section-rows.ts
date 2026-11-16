import type { Worktree } from '../worktree/types'
import type { ExecutionHostId } from '../execution-host/execution-host'
import { getWorktreeHostIdentity } from '../worktree/host-qualified-identity'
import type { WorktreeOccurrencePlan } from './lineage/worktree-occurrence-plan'
import type { RenderableFolderWorkspace } from './folders/folder-workspace-lanes'
import { getLaneHostWorktreeCounts, getLaneHostWorktreeIds } from './hosts/host-labels'
import { PINNED_GROUP_KEY } from './sections/group-keys'
import { appendWorktreeRows } from './sections/row-builders'
import { PINNED_FAVORITES_GROUP_KEY } from './pinned-favorites'
import type { GroupHeaderRow, RepoOfWorktree, Row } from './row-types'

/** One grouped-card step: Pinned and Favorites rows sit under their header like project children. */
export const PINNED_SECTION_ITEM_INDENT = 14

const PINNED_SECTION_HEADERS: readonly Pick<GroupHeaderRow, 'key' | 'icon'>[] = [
  { key: PINNED_FAVORITES_GROUP_KEY, icon: { kind: 'pinned', favorites: true } },
  { key: PINNED_GROUP_KEY, icon: { kind: 'pinned' } }
]

/**
 * Seats rows under their header. Why the Pinned section key on Favorites rows too: pin, drag and
 * reveal logic treats both as pinned rows. A pinned task's members show their repository as title,
 * since they share the task's name.
 */
function seatPinnedSectionRows(
  result: Row[],
  fromIndex: number,
  folderPairByIdentity: ReadonlyMap<string, RenderableFolderWorkspace>
): void {
  for (let index = fromIndex; index < result.length; index++) {
    const row = result[index]
    if (row?.type === 'folder-workspace') {
      result[index] = {
        ...row,
        sectionKey: PINNED_GROUP_KEY,
        sectionIndent: PINNED_SECTION_ITEM_INDENT
      }
    } else if (row?.type === 'item') {
      const parent = row.occurrence?.parent?.row
      const repoName =
        parent && folderPairByIdentity.has(getWorktreeHostIdentity(parent))
          ? row.repo?.displayName
          : undefined
      result[index] = {
        ...row,
        sectionKey: PINNED_GROUP_KEY,
        sectionIndent: PINNED_SECTION_ITEM_INDENT,
        ...(repoName ? { titleOverride: repoName, showProjectName: false } : {})
      }
    }
  }
}

/** Fork twin of upstream's emitPinnedGroup: Favorites above Pinned, folder workspaces as folder rows. */
export function emitPinnedSections(
  sections: readonly { key: string; group: { items: readonly Worktree[] } }[],
  repoOf: RepoOfWorktree,
  defaultHostId: ExecutionHostId,
  collapsedGroups: Set<string>,
  result: Row[],
  occurrencePlan: WorktreeOccurrencePlan<Worktree>,
  hostContextLabelByWorktreeIdentity: ReadonlyMap<string, string> | undefined,
  folderPairByIdentity: ReadonlyMap<string, RenderableFolderWorkspace>
): void {
  for (const header of PINNED_SECTION_HEADERS) {
    const rows = sections.find((section) => section.key === header.key)?.group.items ?? []
    if (rows.length === 0) {
      continue
    }
    const worktrees: Worktree[] = []
    const folderPairs: RenderableFolderWorkspace[] = []
    for (const row of rows) {
      const pair = folderPairByIdentity.get(getWorktreeHostIdentity(row))
      if (pair) {
        folderPairs.push(pair)
      } else {
        worktrees.push(row)
      }
    }
    result.push({
      type: 'header',
      key: header.key,
      count: rows.length,
      icon: header.icon,
      hostWorktreeCounts: getLaneHostWorktreeCounts(worktrees, folderPairs, repoOf, defaultHostId),
      hostWorktreeIds: getLaneHostWorktreeIds(worktrees, folderPairs, repoOf, defaultHostId),
      worktreeIds: worktrees.map((worktree) => worktree.id)
    })
    if (collapsedGroups.has(header.key)) {
      continue
    }
    const firstRowIndex = result.length
    appendWorktreeRows(result, repoOf, occurrencePlan, {
      collapsedGroups,
      groupDepth: 0,
      sectionKey: header.key,
      hostContextLabelByWorktreeIdentity,
      folderPairByIdentity
    })
    seatPinnedSectionRows(result, firstRowIndex, folderPairByIdentity)
  }
}
