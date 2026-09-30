import { ipcMain } from 'electron'
import {
  connectAzureDevOps,
  disconnectAzureDevOps,
  getAzureDevOpsConnectionStatus
} from '../azure-devops/credential-connection'
import type {
  AzureDevOpsConnectArgs,
  AzureDevOpsConnectResult,
  AzureDevOpsConnectionStatus
} from '../../shared/azure-devops-credentials'
import { _resetPreflightCache } from './preflight'

function normalizeConnectInput(value: unknown): AzureDevOpsConnectArgs | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('organizationUrl' in value) ||
    !('pat' in value) ||
    typeof value.organizationUrl !== 'string' ||
    typeof value.pat !== 'string'
  ) {
    return null
  }
  const username = 'username' in value && typeof value.username === 'string' ? value.username : null
  return { organizationUrl: value.organizationUrl, pat: value.pat, username }
}

export function registerAzureDevOpsHandlers(): void {
  ipcMain.handle(
    'azureDevOps:connect',
    async (_event, args: unknown): Promise<AzureDevOpsConnectResult> => {
      const input = normalizeConnectInput(args)
      if (!input) {
        return { ok: false, error: 'Invalid Azure DevOps credentials' }
      }
      const result = await connectAzureDevOps(input)
      if (result.ok) {
        // Preflight caches source-control status per session; reset so the card updates without a relaunch.
        _resetPreflightCache()
      }
      return result
    }
  )

  ipcMain.handle(
    'azureDevOps:disconnect',
    async (_event, organizationUrl: unknown): Promise<void> => {
      if (typeof organizationUrl !== 'string' || !organizationUrl) {
        throw new Error('Invalid Azure DevOps organization')
      }
      disconnectAzureDevOps(organizationUrl)
      _resetPreflightCache()
    }
  )

  ipcMain.handle('azureDevOps:status', async (): Promise<AzureDevOpsConnectionStatus> => {
    return getAzureDevOpsConnectionStatus()
  })
}
