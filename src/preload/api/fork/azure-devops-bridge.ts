import { ipcRenderer } from 'electron'
import type {
  AzureDevOpsConnectArgs,
  AzureDevOpsConnectResult,
  AzureDevOpsConnectionStatus
} from '../../../shared/azure-devops-credentials'
import type {
  AzureDevOpsPullRequestListArgs,
  AzureDevOpsTaskListResult,
  AzureDevOpsWorkItemListArgs
} from '../../../shared/azure-devops-tasks'

export type AzureDevOpsApi = {
  connect: (args: AzureDevOpsConnectArgs) => Promise<AzureDevOpsConnectResult>
  disconnect: (organizationUrl: string) => Promise<void>
  status: () => Promise<AzureDevOpsConnectionStatus>
  listWorkItems: (args: AzureDevOpsWorkItemListArgs) => Promise<AzureDevOpsTaskListResult>
  listPullRequests: (args: AzureDevOpsPullRequestListArgs) => Promise<AzureDevOpsTaskListResult>
}

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
} satisfies AzureDevOpsApi
