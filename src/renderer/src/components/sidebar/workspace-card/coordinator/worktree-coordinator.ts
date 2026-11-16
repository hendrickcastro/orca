import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store/index'
import type { AppState } from '@/store/types'
import type { WorktreeStatus } from '../../../../../../shared/worktree/row-display/worktree-status-rollup'
import {
  parseWorkspaceKey,
  worktreeWorkspaceKey,
  type WorkspaceKey
} from '../../../../../../shared/workspace/identity/workspace-scope'

export type WorktreeCoordinator = { key: WorkspaceKey; name: string }

// Partial: card tests and detached surfaces render with store fixtures that omit lineage.
type CoordinatorInput = Partial<Pick<AppState, 'workspaceLineageByChildKey' | 'folderWorkspaces'>>

/** The folder workspace whose agent works in this worktree (e.g. a multi-repository task), if any. */
export function selectWorktreeCoordinator(
  state: CoordinatorInput,
  worktreeId: string
): WorktreeCoordinator | null {
  if (parseWorkspaceKey(worktreeId)) {
    return null
  }
  const parentKey =
    state.workspaceLineageByChildKey?.[worktreeWorkspaceKey(worktreeId)]?.parentWorkspaceKey
  const parent = parentKey ? parseWorkspaceKey(parentKey) : null
  if (!parentKey || parent?.type !== 'folder') {
    return null
  }
  const folderWorkspace = state.folderWorkspaces?.find(
    (workspace) => workspace.id === parent.folderWorkspaceId && !workspace.isArchived
  )
  return folderWorkspace ? { key: parentKey, name: folderWorkspace.name } : null
}

export function useWorktreeCoordinator(worktreeId: string): WorktreeCoordinator | null {
  // One subscription per card: sidebar cards mount by the hundreds.
  const { key, name } = useAppStore(
    useShallow((s) => {
      const coordinator = selectWorktreeCoordinator(s, worktreeId)
      return { key: coordinator?.key ?? null, name: coordinator?.name ?? null }
    })
  )
  return key && name !== null ? { key, name } : null
}

// Only agent-derived states travel down; an idle open terminal in the coordinator says nothing about this worktree.
const COORDINATOR_STATUSES = new Set<WorktreeStatus>([
  'working',
  'monitoring',
  'permission',
  'failed',
  'interrupted',
  'done'
])

/** Presentation policy: a worktree with no activity of its own shows what its coordinator's agent is doing. */
export function resolveCoordinatedWorktreeStatus(
  own: WorktreeStatus,
  coordinator: WorktreeStatus | null
): { status: WorktreeStatus; fromCoordinator: boolean } {
  if (own === 'inactive' && coordinator !== null && COORDINATOR_STATUSES.has(coordinator)) {
    return { status: coordinator, fromCoordinator: true }
  }
  return { status: own, fromCoordinator: false }
}
