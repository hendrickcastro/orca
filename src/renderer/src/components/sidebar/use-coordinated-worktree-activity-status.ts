import { useCallback, useSyncExternalStore } from 'react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { AppState } from '@/store/types'
import type { WorktreeStatus } from '@/lib/worktree-status'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import { useWorktreeActivityStatus } from './use-worktree-activity-status'
import { selectWorktreeActivityStatus } from './worktree-activity-status-selector'
import { resolveCoordinatedWorktreeStatus, selectWorktreeCoordinator } from './worktree-coordinator'

type CoordinatorEntry = { name: string; status: WorktreeStatus }

// Why one shared app-store subscription: every sidebar card reads this, and zustand visits every
// listener on each change, so a per-card subscription multiplied work by the workspace count.
let entries = new Map<string, CoordinatorEntry>()
let entriesState: AppState | null = null
const listenersByWorktree = new Map<string, Set<() => void>>()
let stopWatching: (() => void) | null = null

function computeEntries(
  state: AppState,
  previous: ReadonlyMap<string, CoordinatorEntry>
): Map<string, CoordinatorEntry> {
  const next = new Map<string, CoordinatorEntry>()
  const statusByCoordinator = new Map<string, WorktreeStatus>()
  for (const childKey of Object.keys(state.workspaceLineageByChildKey ?? {})) {
    const child = parseWorkspaceKey(childKey)
    if (child?.type !== 'worktree') {
      continue
    }
    const coordinator = selectWorktreeCoordinator(state, child.worktreeId)
    if (!coordinator) {
      continue
    }
    let status = statusByCoordinator.get(coordinator.key)
    if (status === undefined) {
      status = selectWorktreeActivityStatus(state, coordinator.key)
      statusByCoordinator.set(coordinator.key, status)
    }
    const kept = previous.get(child.worktreeId)
    // Why reuse: an unchanged entry must keep its identity, or every card would re-render.
    next.set(
      child.worktreeId,
      kept?.name === coordinator.name && kept.status === status
        ? kept
        : { name: coordinator.name, status }
    )
  }
  return next
}

/** Entries for the store's current state, computed once per state. */
function currentEntries(): ReadonlyMap<string, CoordinatorEntry> {
  const state = useAppStore.getState()
  if (state !== entriesState) {
    entries = computeEntries(state, entries)
    entriesState = state
  }
  return entries
}

function refresh(): void {
  const previous = entries
  currentEntries()
  for (const [worktreeId, listeners] of listenersByWorktree) {
    const before = previous.get(worktreeId)
    const after = entries.get(worktreeId)
    if (before?.name !== after?.name || before?.status !== after?.status) {
      listeners.forEach((listener) => listener())
    }
  }
}

function subscribeToWorktree(worktreeId: string, listener: () => void): () => void {
  if (!stopWatching) {
    stopWatching = useAppStore.subscribe(refresh)
  }
  const listeners = listenersByWorktree.get(worktreeId) ?? new Set()
  listeners.add(listener)
  listenersByWorktree.set(worktreeId, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      listenersByWorktree.delete(worktreeId)
    }
    if (listenersByWorktree.size === 0) {
      stopWatching?.()
      stopWatching = null
    }
  }
}

/** The worktree's status, borrowed from its coordinator's agent when it has none of its own. */
export function useCoordinatedWorktreeActivityStatus(worktreeId: string): {
  status: WorktreeStatus
  coordinatorName: string | null
} {
  const ownStatus = useWorktreeActivityStatus(worktreeId)
  const subscribe = useCallback(
    (listener: () => void) => subscribeToWorktree(worktreeId, listener),
    [worktreeId]
  )
  const getEntry = (): CoordinatorEntry | undefined => currentEntries().get(worktreeId)
  const coordinator = useSyncExternalStore(subscribe, getEntry, getEntry)
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
