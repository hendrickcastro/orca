import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type {
  AzureDevOpsPullRequestFilter,
  AzureDevOpsWorkItemFilter
} from '../../../../../shared/azure-devops-tasks'

export type AzureDevOpsTaskView = 'work-items' | 'pull-requests'

// Why a local store: the filter chrome and the list render in separate Task page slots, and
// keeping this state out of the 39-stage page pipeline keeps the fork's upstream merges small.
type AzureDevOpsTaskViewState = {
  view: AzureDevOpsTaskView
  workItemFilter: AzureDevOpsWorkItemFilter
  pullRequestFilter: AzureDevOpsPullRequestFilter
  refreshNonce: number
  loading: boolean
}

const azureDevOpsTaskViewStore = createStore<AzureDevOpsTaskViewState>(() => ({
  view: 'work-items',
  workItemFilter: 'assigned-to-me',
  pullRequestFilter: 'active',
  refreshNonce: 0,
  loading: false
}))

export function useAzureDevOpsTaskView(): AzureDevOpsTaskViewState {
  return useStore(azureDevOpsTaskViewStore, (state) => state)
}

export function setAzureDevOpsTaskView(view: AzureDevOpsTaskView): void {
  azureDevOpsTaskViewStore.setState({ view })
}

export function setAzureDevOpsWorkItemFilter(workItemFilter: AzureDevOpsWorkItemFilter): void {
  azureDevOpsTaskViewStore.setState({ workItemFilter })
}

export function setAzureDevOpsPullRequestFilter(
  pullRequestFilter: AzureDevOpsPullRequestFilter
): void {
  azureDevOpsTaskViewStore.setState({ pullRequestFilter })
}

export function refreshAzureDevOpsTasks(): void {
  azureDevOpsTaskViewStore.setState((state) => ({ refreshNonce: state.refreshNonce + 1 }))
}

export function setAzureDevOpsTasksLoading(loading: boolean): void {
  azureDevOpsTaskViewStore.setState({ loading })
}
