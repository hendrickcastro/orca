import type { WorktreeOccurrencePlan } from '../worktree-occurrence-plan'
import type { Worktree } from '../worktree/types'
import { getWorktreeExecutionHostId } from '../execution-host'
import type { ExecutionHostId } from '../execution-host'
import { getFolderWorkspaceHostId } from './folder-workspace-host-id'
import { PINNED_GROUP_KEY } from './group-keys'
import { PINNED_FAVORITES_GROUP_KEY } from './pinned-favorites'
import { appendWorktreeRows, buildImportedWorktreesCardRow } from './row-builders'
import { appendPinnedTaskRows, seatPinnedSectionRows } from './pinned-task-rows'
import type { NoticeHostContext } from './host-labels'
import type { PinnedFolderWorkspaceSection, PinnedGroupExtras } from './pinned-folder-workspaces'
import type {
  GroupHeaderRow,
  ImportedWorktreesCardCandidate,
  RepoOfWorktree,
  Row
} from './row-types'

/** Which header the pinned rows sit under; its key is also their occurrence-plan section. */
type PinnedGroupHeader = Pick<GroupHeaderRow, 'key' | 'icon'>

const PINNED_GROUP_HEADER: PinnedGroupHeader = { key: PINNED_GROUP_KEY, icon: { kind: 'pinned' } }
const PINNED_FAVORITES_GROUP_HEADER: PinnedGroupHeader = {
  key: PINNED_FAVORITES_GROUP_KEY,
  icon: { kind: 'pinned', favorites: true }
}

export function emitPinnedGroup(
  pinnedSectionWorktrees: Worktree[],
  repoOf: RepoOfWorktree,
  defaultHostId: ExecutionHostId,
  collapsedGroups: Set<string>,
  renderedNaturalAnchorRepoIds: ReadonlySet<string>,
  importedWorktreesByRepo: ReadonlyMap<string, ImportedWorktreesCardCandidate>,
  allowImportedFallback: boolean,
  result: Row[],
  occurrencePlan: WorktreeOccurrencePlan<Worktree>,
  noticeHostContextLabelByRepoId?: ReadonlyMap<string, NoticeHostContext>,
  hostContextLabelByWorktreeIdentity?: ReadonlyMap<string, string>,
  extras?: PinnedGroupExtras
): void {
  const emit = (
    worktrees: Worktree[],
    tasks: readonly PinnedFolderWorkspaceSection[],
    header: PinnedGroupHeader,
    allowFallback: boolean
  ): void =>
    emitPinnedSection(
      worktrees,
      repoOf,
      defaultHostId,
      collapsedGroups,
      renderedNaturalAnchorRepoIds,
      importedWorktreesByRepo,
      allowFallback,
      result,
      occurrencePlan,
      noticeHostContextLabelByRepoId,
      hostContextLabelByWorktreeIdentity,
      tasks,
      header
    )
  // Why: favourite pinned workspaces get their own section above Pinned.
  if (extras) {
    emit(extras.favoriteWorktrees, extras.favoriteTasks, PINNED_FAVORITES_GROUP_HEADER, false)
  }
  emit(pinnedSectionWorktrees, extras?.restTasks ?? [], PINNED_GROUP_HEADER, allowImportedFallback)
}

function emitPinnedSection(
  pinnedSectionWorktrees: Worktree[],
  repoOf: RepoOfWorktree,
  defaultHostId: ExecutionHostId,
  collapsedGroups: Set<string>,
  renderedNaturalAnchorRepoIds: ReadonlySet<string>,
  importedWorktreesByRepo: ReadonlyMap<string, ImportedWorktreesCardCandidate>,
  allowImportedFallback: boolean,
  result: Row[],
  occurrencePlan: WorktreeOccurrencePlan<Worktree>,
  noticeHostContextLabelByRepoId: ReadonlyMap<string, NoticeHostContext> | undefined,
  hostContextLabelByWorktreeIdentity: ReadonlyMap<string, string> | undefined,
  pinnedFolderWorkspaces: readonly PinnedFolderWorkspaceSection[],
  header: PinnedGroupHeader
): void {
  if (pinnedSectionWorktrees.length === 0 && pinnedFolderWorkspaces.length === 0) {
    return
  }
  const sectionWorktrees = [
    ...pinnedFolderWorkspaces.flatMap((section) => section.members),
    ...pinnedSectionWorktrees
  ]
  const hostWorktreeCounts = new Map<ExecutionHostId, number>()
  const hostWorktreeIds = new Map<ExecutionHostId, string[]>()
  const pinnedRepoOrder: string[] = []
  const seenPinnedRepoIds = new Set<string>()
  for (const worktree of sectionWorktrees) {
    const hostId = getWorktreeExecutionHostId(worktree, repoOf(worktree), defaultHostId)
    hostWorktreeCounts.set(hostId, (hostWorktreeCounts.get(hostId) ?? 0) + 1)
    const hostIds = hostWorktreeIds.get(hostId) ?? []
    hostIds.push(worktree.id)
    hostWorktreeIds.set(hostId, hostIds)
    if (!seenPinnedRepoIds.has(worktree.repoId)) {
      pinnedRepoOrder.push(worktree.repoId)
      seenPinnedRepoIds.add(worktree.repoId)
    }
  }
  for (const { pair } of pinnedFolderWorkspaces) {
    const hostId = getFolderWorkspaceHostId(pair.folderWorkspace, pair.projectGroup, defaultHostId)
    hostWorktreeCounts.set(hostId, (hostWorktreeCounts.get(hostId) ?? 0) + 1)
    // Why: a missing host key makes host sections fall back to global ids.
    hostWorktreeIds.set(hostId, hostWorktreeIds.get(hostId) ?? [])
  }

  result.push({
    type: 'header',
    key: header.key,
    count: sectionWorktrees.length + pinnedFolderWorkspaces.length,
    icon: header.icon,
    hostWorktreeCounts,
    hostWorktreeIds,
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
  appendPinnedTaskRows(result, pinnedFolderWorkspaces, repoOf, occurrencePlan, {
    collapsedGroups,
    hostContextLabelByWorktreeIdentity
  })
  appendWorktreeRows(result, repoOf, occurrencePlan, {
    collapsedGroups,
    groupDepth: 0,
    sectionKey: header.key,
    hostContextLabelByWorktreeIdentity
  })
  seatPinnedSectionRows(result, firstItemIndex)
  if (!allowImportedFallback) {
    return
  }
  // Insert imported fallbacks after the repo’s last row, backwards to avoid shifting later targets.
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
