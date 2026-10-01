import { ipcRenderer } from 'electron'
import type {
  AzureDevOpsConnectArgs,
  AzureDevOpsConnectResult,
  AzureDevOpsConnectionStatus
} from '../../shared/azure-devops-credentials'
import type {
  AzureDevOpsPullRequestListArgs,
  AzureDevOpsTaskListResult,
  AzureDevOpsWorkItemListArgs
} from '../../shared/azure-devops-tasks'
import type { PreloadApi } from '../api-types'

export const azureDevOpsApi = {
  connect: (args: AzureDevOpsConnectArgs): Promise<AzureDevOpsConnectResult> =>
    ipcRenderer.invoke('azureDevOps:connect', args),
  disconnect: (organizationUrl: string): Promise<void> =>
    ipcRenderer.invoke('azureDevOps:disconnect', organizationUrl),
  status: (): Promise<AzureDevOpsConnectionStatus> => ipcRenderer.invoke('azureDevOps:status'),
  listWorkItems: (args: AzureDevOpsWorkItemListArgs): Promise<AzureDevOpsTaskListResult> =>
    ipcRenderer.invoke('azureDevOps:listWorkItems', args),
  listPullRequests: (args: AzureDevOpsPullRequestListArgs): Promise<AzureDevOpsTaskListResult> =>
    ipcRenderer.invoke('azureDevOps:listPullRequests', args)
} satisfies PreloadApi['azureDevOps']
