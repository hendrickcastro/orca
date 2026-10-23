import type { Repo } from '../../../../../../shared/repo-types'
import type { WorktreeLineage } from '../../../../../../shared/worktree/lineage-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import type { ExecutionHostId } from '../../../../../../shared/execution-host'
import { PINNED_GROUP_KEY, PINNED_GROUP_META } from './group-keys'
import { appendWorktreeRows, buildImportedWorktreesCardRow } from './row-builders'
import { appendPinnedTaskRows, indentPinnedSectionRows } from './pinned-task-rows'
import { getLaneHostWorktreeCounts, getLaneHostWorktreeIds } from './host-labels'
import type { NoticeHostContext } from './host-labels'
import type { PinnedFolderWorkspaceSection } from './pinned-folder-workspaces'
import type { GroupHeaderRow, ImportedWorktreesCardCandidate, Row } from './row-types'

/**
 * The Pinned section's rows.
 *
 * Split out of row-builders to keep that file under the line cap; pinned
 * emission has its own ordering and imported-fallback placement rules.
 */
export function emitPinnedGroup(
  pinnedSectionWorktrees: Worktree[],
  repoMap: Map<string, Repo>,
  defaultHostId: ExecutionHostId,
  collapsedGroups: Set<string>,
  renderedNaturalAnchorRepoIds: ReadonlySet<string>,
  importedWorktreesByRepo: ReadonlyMap<string, ImportedWorktreesCardCandidate>,
  allowImportedFallback: boolean,
  result: Row[],
  lineageById: Record<string, WorktreeLineage>,
  worktreeMap: Map<string, Worktree>,
  nestLineage: boolean,
  cyclicLineageIds: ReadonlySet<string>,
  noticeHostContextLabelByRepoId?: ReadonlyMap<string, NoticeHostContext>,
  hostContextLabelByWorktreeIdentity?: ReadonlyMap<string, string>,
  pinnedFolderWorkspaces: readonly PinnedFolderWorkspaceSection[] = [],
  // Why a header override: Favorites reuses this emitter; its rows stay pinned rows.
  header: { key: string; label: string; tone: string; icon: GroupHeaderRow['icon'] } = {
    key: PINNED_GROUP_KEY,
    label: PINNED_GROUP_META.label,
    tone: PINNED_GROUP_META.tone,
    icon: PINNED_GROUP_META.icon
  }
): void {
  if (pinnedSectionWorktrees.length === 0 && pinnedFolderWorkspaces.length === 0) {
    return
  }
  const pinnedFolderMembers = pinnedFolderWorkspaces.flatMap((section) => section.members)
  const sectionWorktrees = [...pinnedFolderMembers, ...pinnedSectionWorktrees]
  const pinnedFolderPairs = pinnedFolderWorkspaces.map((section) => section.pair)
  const pinnedRepoOrder: string[] = []
  const seenPinnedRepoIds = new Set<string>()
  for (const worktree of sectionWorktrees) {
    if (!seenPinnedRepoIds.has(worktree.repoId)) {
      pinnedRepoOrder.push(worktree.repoId)
      seenPinnedRepoIds.add(worktree.repoId)
    }
  }

  result.push({
    type: 'header',
    key: header.key,
    label: header.label,
    count: sectionWorktrees.length + pinnedFolderPairs.length,
    tone: header.tone,
    icon: header.icon,
    hostWorktreeCounts: getLaneHostWorktreeCounts(
      sectionWorktrees,
      pinnedFolderPairs,
      repoMap,
      defaultHostId
    ),
    hostWorktreeIds: getLaneHostWorktreeIds(
      sectionWorktrees,
      pinnedFolderPairs,
      repoMap,
      defaultHostId
    ),
    worktreeIds: sectionWorktrees.map((worktree) => worktree.id)
  })
  if (collapsedGroups.has(header.key)) {
    for (const repoId of pinnedRepoOrder) {
      const candidate = importedWorktreesByRepo.get(repoId)
      if (allowImportedFallback && candidate && !renderedNaturalAnchorRepoIds.has(repoId)) {
        result.push(
          buildImportedWorktreesCardRow(
            candidate,
            'pinned-fallback',
            noticeHostContextLabelByRepoId?.get(repoId)
          )
        )
      }
    }
    return
  }

  const firstItemIndex = result.length
  // Why first: a task reads as the coordinator of the member rows indented beneath it.
  appendPinnedTaskRows(result, pinnedFolderWorkspaces, repoMap, lineageById, worktreeMap, {
    nestLineage,
    collapsedGroups,
    hostContextLabelByWorktreeIdentity,
    cyclicLineageIds
  })
  appendWorktreeRows(result, pinnedSectionWorktrees, repoMap, lineageById, worktreeMap, {
    nestLineage,
    collapsedGroups,
    groupDepth: 0,
    sectionKey: PINNED_GROUP_KEY,
    hostContextLabelByWorktreeIdentity,
    cyclicLineageIds
  })
  indentPinnedSectionRows(result, firstItemIndex)
  if (!allowImportedFallback) {
    return
  }
  // Why: imported fallback sits after the last row of that repo; splice from the
  // end so earlier inserts do not shift later targets.
  const lastResultIndexByRepoId = new Map<string, number>()
  for (let index = firstItemIndex; index < result.length; index++) {
    const row = result[index]
    if (row?.type === 'item') {
      lastResultIndexByRepoId.set(row.worktree.repoId, index)
    }
  }
  const inserts = [...lastResultIndexByRepoId.entries()].sort((left, right) => right[1] - left[1])
  for (const [repoId, index] of inserts) {
    const candidate = importedWorktreesByRepo.get(repoId)
    if (candidate && !renderedNaturalAnchorRepoIds.has(repoId)) {
      result.splice(
        index + 1,
        0,
        buildImportedWorktreesCardRow(
          candidate,
          'pinned-fallback',
          noticeHostContextLabelByRepoId?.get(repoId)
        )
      )
    }
  }
}
