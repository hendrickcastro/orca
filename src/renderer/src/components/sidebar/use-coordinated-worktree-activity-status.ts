import { useShallow } from 'zustand/react/shallow'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { WorktreeStatus } from '@/lib/worktree-status'
import { useWorktreeActivityStatus } from './use-worktree-activity-status'
import { selectWorktreeActivityStatus } from './worktree-activity-status-selector'
import { resolveCoordinatedWorktreeStatus, selectWorktreeCoordinator } from './worktree-coordinator'

/** The worktree's status, borrowed from its coordinator's agent when it has none of its own. */
export function useCoordinatedWorktreeActivityStatus(worktreeId: string): {
  status: WorktreeStatus
  coordinatorName: string | null
} {
  const ownStatus = useWorktreeActivityStatus(worktreeId)
  // Why: one subscription per card; every sidebar card mounts this and zustand visits each listener.
  const coordinator = useAppStore(
    useShallow((s) => {
      const found = selectWorktreeCoordinator(s, worktreeId)
      return found ? { name: found.name, status: selectWorktreeActivityStatus(s, found.key) } : null
    })
  )
  const { status, fromCoordinator } = resolveCoordinatedWorktreeStatus(
    ownStatus,
    coordinator?.status ?? null
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
