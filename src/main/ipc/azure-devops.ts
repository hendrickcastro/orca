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
import { listAzureDevOpsPullRequests, listAzureDevOpsWorkItems } from '../azure-devops/task-queries'
import type {
  AzureDevOpsPullRequestFilter,
  AzureDevOpsTaskListArgs,
  AzureDevOpsTaskListResult,
  AzureDevOpsWorkItemFilter
} from '../../shared/azure-devops-tasks'

const WORK_ITEM_FILTERS: readonly AzureDevOpsWorkItemFilter[] = ['assigned-to-me', 'all-open']
const PULL_REQUEST_FILTERS: readonly AzureDevOpsPullRequestFilter[] = [
  'active',
  'created-by-me',
  'review-requested'
]

function normalizeTaskListInput<F extends string>(
  value: unknown,
  filters: readonly F[]
): (AzureDevOpsTaskListArgs & { filter: F }) | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('repoId' in value) ||
    !('remoteUrl' in value) ||
    !('filter' in value) ||
    typeof value.repoId !== 'string' ||
    typeof value.remoteUrl !== 'string'
  ) {
    return null
  }
  const filter = filters.find((entry) => entry === value.filter)
  return filter ? { repoId: value.repoId, remoteUrl: value.remoteUrl, filter } : null
}

const invalidTaskListInput: AzureDevOpsTaskListResult = {
  items: [],
  error: { type: 'request', message: 'Invalid Azure DevOps task list request' }
}

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

  ipcMain.handle(
    'azureDevOps:listWorkItems',
    async (_event, args: unknown): Promise<AzureDevOpsTaskListResult> => {
      const input = normalizeTaskListInput(args, WORK_ITEM_FILTERS)
      return input ? listAzureDevOpsWorkItems(input) : invalidTaskListInput
    }
  )

  ipcMain.handle(
    'azureDevOps:listPullRequests',
    async (_event, args: unknown): Promise<AzureDevOpsTaskListResult> => {
      const input = normalizeTaskListInput(args, PULL_REQUEST_FILTERS)
      return input ? listAzureDevOpsPullRequests(input) : invalidTaskListInput
    }
  )
}
