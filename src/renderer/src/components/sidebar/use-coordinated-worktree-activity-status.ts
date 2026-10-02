import { translate } from '@/i18n/i18n'
import type { WorktreeStatus } from '@/lib/worktree-status'
import { useWorktreeActivityStatus } from './use-worktree-activity-status'
import { resolveCoordinatedWorktreeStatus, useWorktreeCoordinator } from './worktree-coordinator'

/** The worktree's status, borrowed from its coordinator's agent when it has none of its own. */
export function useCoordinatedWorktreeActivityStatus(worktreeId: string): {
  status: WorktreeStatus
  coordinatorName: string | null
} {
  const ownStatus = useWorktreeActivityStatus(worktreeId)
  const coordinator = useWorktreeCoordinator(worktreeId)
  // Why: hooks cannot be conditional; an unknown key resolves to 'inactive' and is ignored.
  const coordinatorStatus = useWorktreeActivityStatus(coordinator?.key ?? '')
  const { status, fromCoordinator } = resolveCoordinatedWorktreeStatus(
    ownStatus,
    coordinator ? coordinatorStatus : null
  )
  return { status, coordinatorName: fromCoordinator && coordinator ? coordinator.name : null }
}

export function withCoordinatorName(statusLabel: string, coordinatorName: string | null): string {
  return coordinatorName
    ? translate('sidebar.worktreeCoordinator.statusLabel', '{{value0}} · coordinator {{value1}}', {
        value0: statusLabel,
        value1: coordinatorName
      })
    : statusLabel
}
