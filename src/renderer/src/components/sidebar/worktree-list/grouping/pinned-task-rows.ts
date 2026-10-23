import type { Repo } from '../../../../../../shared/repo-types'
import type { WorktreeLineage } from '../../../../../../shared/worktree/lineage-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { getPinnedTaskOpenKey } from '../../pinned-favorites/pinned-favorites'
import { PINNED_GROUP_KEY } from './group-keys'
import type { PinnedFolderWorkspaceSection } from './pinned-folder-workspaces'
import { appendWorktreeRows, buildFolderWorkspaceRow } from './row-builders'
import type { Row } from './row-types'

/** One grouped-card step: Pinned and Favorites rows sit under their header like project children. */
export const PINNED_SECTION_ITEM_INDENT = 14

/** Seats every workspace row emitted from `fromIndex` under the section header above it. */
export function indentPinnedSectionRows(result: Row[], fromIndex: number): void {
  for (let index = fromIndex; index < result.length; index++) {
    const row = result[index]
    if (row?.type === 'item' || row?.type === 'folder-workspace') {
      result[index] = { ...row, sectionIndent: PINNED_SECTION_ITEM_INDENT }
    }
  }
}

/**
 * Each pinned task as a foldable group: the task row carries a disclosure for its repos, which
 * start folded. Why the repo name as their title: a task's worktrees share its name, so in the
 * group they read as identical empty copies of the task.
 */
export function appendPinnedTaskRows(
  result: Row[],
  sections: readonly PinnedFolderWorkspaceSection[],
  repoMap: Map<string, Repo>,
  lineageById: Record<string, WorktreeLineage>,
  worktreeMap: Map<string, Worktree>,
  options: {
    nestLineage: boolean
    collapsedGroups: Set<string>
    hostContextLabelByWorktreeIdentity?: ReadonlyMap<string, string>
    cyclicLineageIds: ReadonlySet<string>
  }
): void {
  for (const section of sections) {
    const openKey = getPinnedTaskOpenKey(section.pair.folderWorkspace.id)
    const folded = !options.collapsedGroups.has(openKey)
    result.push({
      ...buildFolderWorkspaceRow(section.pair, 0),
      sectionKey: PINNED_GROUP_KEY,
      lineageChildCount: section.members.length,
      lineageCollapsed: folded,
      lineageGroupKey: openKey
    })
    if (folded) {
      continue
    }
    const firstMemberIndex = result.length
    appendWorktreeRows(result, section.members, repoMap, lineageById, worktreeMap, {
      ...options,
      groupDepth: 1,
      sectionKey: PINNED_GROUP_KEY
    })
    for (let index = firstMemberIndex; index < result.length; index++) {
      const row = result[index]
      if (row?.type !== 'item') {
        continue
      }
      const repoName = repoMap.get(row.worktree.repoId)?.displayName
      // Why one tree step deeper: groupDepth alone does not indent in flat mode, and in grouped
      // mode it only lines the member up with the task's title, so it did not read as a child.
      result[index] = {
        ...row,
        depth: row.depth + 1,
        ...(repoName ? { titleOverride: repoName } : {})
      }
    }
  }
}
