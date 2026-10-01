import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../../../shared/repo-types'
import type { AzureDevOpsTaskItem } from '../../../../../shared/azure-devops-tasks'
import {
  mergeAzureDevOpsTaskResults,
  selectAzureDevOpsTaskRepos
} from './use-azure-devops-task-items'

function item(id: number, repoId: string, updatedAt: string): AzureDevOpsTaskItem {
  return {
    kind: 'work-item',
    id,
    title: `Item ${id}`,
    typeLabel: 'Bug',
    state: 'Active',
    person: null,
    updatedAt,
    url: `https://dev.azure.com/acme/Portal/_workitems/edit/${id}`,
    projectKey: 'https://dev.azure.com/acme|portal',
    repoId
  }
}

function repo(id: string, remoteUrl: string | null): Repo {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only id and gitRemoteIdentity are read by the selector under test.
  return {
    id,
    gitRemoteIdentity: remoteUrl ? { canonicalKey: '', remoteName: 'origin', remoteUrl } : null
  } as Repo
}

describe('Azure DevOps task items', () => {
  it('keeps only repos with an Azure DevOps remote', () => {
    const repos = [
      repo('azure', 'https://dev.azure.com/acme/Portal/_git/web'),
      repo('legacy', 'https://acme.visualstudio.com/Portal/_git/api'),
      repo('github', 'git@github.com:acme/app.git'),
      repo('folder', null)
    ]
    expect(selectAzureDevOpsTaskRepos(repos).map((entry) => entry.repo.id)).toEqual([
      'azure',
      'legacy'
    ])
  })

  it('dedupes work items shared by repos of one project and sorts newest first', () => {
    const merged = mergeAzureDevOpsTaskResults([
      { items: [item(1, 'web', '2026-01-01'), item(2, 'web', '2026-03-01')] },
      { items: [item(1, 'api', '2026-01-01')] }
    ])
    expect(merged.items.map((entry) => [entry.id, entry.repoId])).toEqual([
      [2, 'web'],
      [1, 'web']
    ])
    expect(merged.error).toBeNull()
  })

  it('shows an error only when no repo returned any item', () => {
    const failed = { items: [], error: { type: 'auth' as const, message: 'Bad PAT' } }
    expect(mergeAzureDevOpsTaskResults([failed]).error).toBe('Bad PAT')
    expect(
      mergeAzureDevOpsTaskResults([failed, { items: [item(1, 'web', '2026-01-01')] }]).error
    ).toBeNull()
    expect(
      mergeAzureDevOpsTaskResults([
        { items: [], error: { type: 'not_azure_devops', message: 'Not Azure' } }
      ]).error
    ).toBeNull()
  })
})
