import type { Worktree } from '../worktree/types'
import type { WorktreeOccurrencePlan } from '../worktree-occurrence-plan'
import { getPinnedTaskOpenKey } from './pinned-favorites'
import { PINNED_GROUP_KEY } from './group-keys'
import type { PinnedFolderWorkspaceSection } from './pinned-folder-workspaces'
import { appendWorktreeRows, buildFolderWorkspaceRow } from './row-builders'
import type { RepoOfWorktree, Row } from './row-types'

/** One grouped-card step: Pinned and Favorites rows sit under their header like project children. */
export const PINNED_SECTION_ITEM_INDENT = 14

/**
 * Seats every workspace row emitted from `fromIndex` under the section header above it. Why the
 * Pinned section key: Favorites and task rows are pinned rows to pin, drag and reveal logic.
 */
export function seatPinnedSectionRows(result: Row[], fromIndex: number): void {
  for (let index = fromIndex; index < result.length; index++) {
    const row = result[index]
    if (row?.type === 'item' || row?.type === 'folder-workspace') {
      result[index] = {
        ...row,
        sectionKey: PINNED_GROUP_KEY,
        sectionIndent: PINNED_SECTION_ITEM_INDENT
      }
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
  repoOf: RepoOfWorktree,
  occurrencePlan: WorktreeOccurrencePlan<Worktree>,
  options: {
    collapsedGroups: Set<string>
    hostContextLabelByWorktreeIdentity?: ReadonlyMap<string, string>
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
    appendWorktreeRows(result, repoOf, occurrencePlan, {
      ...options,
      groupDepth: 1,
      sectionKey: section.sectionKey
    })
    for (let index = firstMemberIndex; index < result.length; index++) {
      const row = result[index]
      if (row?.type !== 'item') {
        continue
      }
      const repoName = row.repo?.displayName
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
