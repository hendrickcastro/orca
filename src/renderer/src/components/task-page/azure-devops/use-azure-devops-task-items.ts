import { useEffect, useMemo, useState } from 'react'
import type { Repo } from '../../../../../shared/repo-types'
import type {
  AzureDevOpsTaskItem,
  AzureDevOpsTaskListResult
} from '../../../../../shared/azure-devops-tasks'
import { translate } from '@/i18n/i18n'
import { parseRemoteRepo } from '../../right-sidebar/source-control/review/remote-repo'
import { setAzureDevOpsTasksLoading, useAzureDevOpsTaskView } from './azure-devops-task-view-store'

export type AzureDevOpsTaskRepo = { repo: Repo; remoteUrl: string }

export function selectAzureDevOpsTaskRepos(repos: readonly Repo[]): AzureDevOpsTaskRepo[] {
  const result: AzureDevOpsTaskRepo[] = []
  for (const repo of repos) {
    const remoteUrl = repo.gitRemoteIdentity?.remoteUrl
    if (remoteUrl && parseRemoteRepo(remoteUrl)?.provider === 'azure-devops') {
      result.push({ repo, remoteUrl })
    }
  }
  return result
}

/** Merges per-repo results: repos of one project return the same work items, so keep the first. */
export function mergeAzureDevOpsTaskResults(results: readonly AzureDevOpsTaskListResult[]): {
  items: AzureDevOpsTaskItem[]
  error: string | null
} {
  const seen = new Set<string>()
  const items: AzureDevOpsTaskItem[] = []
  const errors: string[] = []
  for (const result of results) {
    for (const item of result.items) {
      const key = `${item.kind}|${item.projectKey}|${item.id}`
      if (!seen.has(key)) {
        seen.add(key)
        items.push(item)
      }
    }
    if (result.error && result.error.type !== 'not_azure_devops') {
      errors.push(result.error.message)
    }
  }
  items.sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
  // Why: a partial failure still shows the rows that loaded; banner only when nothing came back.
  return { items, error: errors.length > 0 && items.length === 0 ? errors[0] : null }
}

function unavailable(): AzureDevOpsTaskListResult {
  return {
    items: [],
    error: {
      type: 'request',
      message: translate(
        'auto.components.TaskPage.azureUnavailable',
        'Azure DevOps is not available in this client.'
      )
    }
  }
}

export function useAzureDevOpsTaskItems(selectedRepos: readonly Repo[]): {
  azureRepos: AzureDevOpsTaskRepo[]
  items: AzureDevOpsTaskItem[]
  error: string | null
  loading: boolean
} {
  const { view, workItemFilter, pullRequestFilter, refreshNonce, loading } =
    useAzureDevOpsTaskView()
  const azureRepos = useMemo(() => selectAzureDevOpsTaskRepos(selectedRepos), [selectedRepos])
  const reposKey = azureRepos.map(({ repo, remoteUrl }) => `${repo.id}\u0000${remoteUrl}`).join('|')
  const [items, setItems] = useState<AzureDevOpsTaskItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (azureRepos.length === 0) {
      setItems([])
      setError(null)
      setAzureDevOpsTasksLoading(false)
      return
    }
    let stale = false
    setAzureDevOpsTasksLoading(true)
    setError(null)
    const api = window.api.azureDevOps
    const requests = azureRepos.map(({ repo, remoteUrl }) => {
      if (view === 'work-items') {
        return api?.listWorkItems
          ? api.listWorkItems({ repoId: repo.id, remoteUrl, filter: workItemFilter })
          : Promise.resolve(unavailable())
      }
      return api?.listPullRequests
        ? api.listPullRequests({ repoId: repo.id, remoteUrl, filter: pullRequestFilter })
        : Promise.resolve(unavailable())
    })
    void Promise.allSettled(requests)
      .then((settled) => {
        if (stale) {
          return
        }
        const merged = mergeAzureDevOpsTaskResults(
          settled.map((entry) =>
            entry.status === 'fulfilled'
              ? entry.value
              : {
                  items: [],
                  error: {
                    type: 'request' as const,
                    message:
                      entry.reason instanceof Error ? entry.reason.message : String(entry.reason)
                  }
                }
          )
        )
        setItems(merged.items)
        setError(merged.error)
      })
      .finally(() => {
        if (!stale) {
          setAzureDevOpsTasksLoading(false)
        }
      })
    return () => {
      stale = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- reposKey covers every azureRepos field read above.
  }, [reposKey, view, workItemFilter, pullRequestFilter, refreshNonce])

  return { azureRepos, items, error, loading }
}
