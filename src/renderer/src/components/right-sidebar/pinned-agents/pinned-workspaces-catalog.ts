import type { AppState } from '@/store/types'
import type { ExecutionHostId } from '../../../../../shared/execution-host'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../../../../../shared/workspace-scope'

export type PinnedWorkspaceEntry = {
  /** Worktree id, or the `folder:<id>` key of a folder workspace. */
  id: string
  kind: 'worktree' | 'folder'
  name: string
  projectName: string
  path: string
  hostId: ExecutionHostId | null
  /** Worktrees a pinned folder workspace's agent works in (a multi-repository task's members). */
  members: PinnedWorkspaceEntry[]
}

export type PinnedWorkspaceCatalogState = Pick<
  AppState,
  'repos' | 'worktreesByRepo' | 'folderWorkspaces' | 'projectGroups' | 'workspaceLineageByChildKey'
>

/** Every pinned workspace Orca knows, tasks first with their members nested, then pinned worktrees. */
export function selectPinnedWorkspaceCatalog(
  state: PinnedWorkspaceCatalogState
): PinnedWorkspaceEntry[] {
  const projectGroupsById = new Map((state.projectGroups ?? []).map((group) => [group.id, group]))
  const pinnedFolders = (state.folderWorkspaces ?? []).filter(
    (workspace) => workspace.isPinned && !workspace.isArchived
  )
  const membersByFolderKey = new Map<string, PinnedWorkspaceEntry[]>()
  const pinnedFolderKeys = new Set(
    pinnedFolders.map((workspace) => folderWorkspaceKey(workspace.id))
  )
  const worktreeEntries: PinnedWorkspaceEntry[] = []
  for (const repo of state.repos ?? []) {
    for (const worktree of state.worktreesByRepo?.[repo.id] ?? []) {
      if (worktree.isArchived) {
        continue
      }
      const entry: PinnedWorkspaceEntry = {
        id: worktree.id,
        kind: 'worktree',
        name: worktree.displayName,
        projectName: repo.displayName,
        path: worktree.path,
        hostId: worktree.hostId ?? repo.executionHostId ?? null,
        members: []
      }
      const parentKey =
        state.workspaceLineageByChildKey?.[worktreeWorkspaceKey(worktree.id)]?.parentWorkspaceKey
      if (parentKey && pinnedFolderKeys.has(parentKey)) {
        const members = membersByFolderKey.get(parentKey) ?? []
        members.push(entry)
        membersByFolderKey.set(parentKey, members)
      } else if (worktree.isPinned) {
        worktreeEntries.push(entry)
      }
    }
  }
  const folderEntries = pinnedFolders.map((workspace): PinnedWorkspaceEntry => {
    const key = folderWorkspaceKey(workspace.id)
    return {
      id: key,
      kind: 'folder',
      name: workspace.name,
      projectName: projectGroupsById.get(workspace.projectGroupId)?.name ?? workspace.name,
      path: workspace.folderPath,
      hostId: workspace.executionHostId ?? null,
      members: membersByFolderKey.get(key) ?? []
    }
  })
  return [...folderEntries, ...worktreeEntries]
}
