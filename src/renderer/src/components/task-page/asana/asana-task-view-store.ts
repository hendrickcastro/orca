import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type {
  AsanaConnectionStatus,
  AsanaProject,
  AsanaTaskScope,
  AsanaTaskStatusFilter
} from '../../../../../shared/asana-types'

const WORKSPACE_STORAGE_KEY = 'orca.asana.workspaceGid'

// Why a local store: the filter chrome and the list render in separate Task page slots, and
// keeping this state out of the 39-stage page pipeline keeps the fork's upstream merges small.
type AsanaTaskViewState = {
  status: AsanaConnectionStatus | null
  statusLoading: boolean
  workspaceGid: string | null
  scope: AsanaTaskScope
  projectGid: string | null
  projects: AsanaProject[]
  statusFilter: AsanaTaskStatusFilter
  refreshNonce: number
  loading: boolean
  createOpen: boolean
}

function readStoredWorkspaceGid(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return null
  }
}

const asanaTaskViewStore = createStore<AsanaTaskViewState>(() => ({
  status: null,
  statusLoading: false,
  workspaceGid: null,
  scope: 'my-tasks',
  projectGid: null,
  projects: [],
  statusFilter: 'all',
  refreshNonce: 0,
  loading: false,
  createOpen: false
}))

export function useAsanaTaskView(): AsanaTaskViewState {
  return useStore(asanaTaskViewStore, (state) => state)
}

export function getAsanaTaskViewState(): AsanaTaskViewState {
  return asanaTaskViewStore.getState()
}

export function patchAsanaTaskView(patch: Partial<AsanaTaskViewState>): void {
  asanaTaskViewStore.setState(patch)
}

export function refreshAsanaTasks(): void {
  asanaTaskViewStore.setState((state) => ({ refreshNonce: state.refreshNonce + 1 }))
}

export function selectAsanaWorkspace(workspaceGid: string): void {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceGid)
  } catch {
    // Remembering the workspace is a convenience; the picker still works without storage.
  }
  asanaTaskViewStore.setState({ workspaceGid, projectGid: null, projects: [], scope: 'my-tasks' })
}

/** Applies a fresh status and keeps the selected workspace when it still exists. */
export function applyAsanaStatus(status: AsanaConnectionStatus): void {
  const { workspaceGid } = asanaTaskViewStore.getState()
  const preferred = workspaceGid ?? readStoredWorkspaceGid()
  const next = status.workspaces.some((workspace) => workspace.gid === preferred)
    ? preferred
    : (status.workspaces[0]?.gid ?? null)
  asanaTaskViewStore.setState({
    status,
    statusLoading: false,
    workspaceGid: next,
    ...(next === workspaceGid ? {} : { projectGid: null, projects: [] })
  })
}
