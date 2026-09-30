import { ipcRenderer } from 'electron'
import type {
  AzureDevOpsConnectArgs,
  AzureDevOpsConnectResult,
  AzureDevOpsConnectionStatus
} from '../../shared/azure-devops-credentials'
import type { PreloadApi } from '../api-types'

export const azureDevOpsApi = {
  connect: (args: AzureDevOpsConnectArgs): Promise<AzureDevOpsConnectResult> =>
    ipcRenderer.invoke('azureDevOps:connect', args),
  disconnect: (organizationUrl: string): Promise<void> =>
    ipcRenderer.invoke('azureDevOps:disconnect', organizationUrl),
  status: (): Promise<AzureDevOpsConnectionStatus> => ipcRenderer.invoke('azureDevOps:status')
} satisfies PreloadApi['azureDevOps']
