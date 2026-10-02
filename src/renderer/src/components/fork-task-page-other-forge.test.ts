import { describe, expect, it } from 'vitest'
import type { CacheEntry } from '@/store/github/cache-model'
import type { GitHubWorkItem } from '../../../shared/github/work-item-types'
import {
  buildTaskPageRepoSourceState,
  selectTaskPageUnresolvedSourceRepos
} from './task-page-cache-selectors'
import {
  selectTaskPageOtherForgeSourceRepos,
  withoutOtherForgeSourceRepos
} from './task-page-other-forge-source-repos'

describe('fork: repos hosted on other forges in the GitHub tab', () => {
  const remote = (remoteUrl: string) => ({ canonicalKey: '', remoteName: 'origin', remoteUrl })
  const repos = [
    {
      id: 'azure',
      path: '/repos/azure',
      gitRemoteIdentity: remote('https://acme@dev.azure.com/acme/Portal/_git/web')
    },
    {
      id: 'gitlab',
      path: '/repos/gitlab',
      gitRemoteIdentity: remote('git@gitlab.com:acme/api.git')
    },
    {
      id: 'github',
      path: '/repos/github',
      gitRemoteIdentity: remote('git@github.com:acme/app.git')
    }
  ]
  const sourceState = buildTaskPageRepoSourceState(
    repos,
    repos.map((): CacheEntry<GitHubWorkItem[]> => ({
      data: [],
      fetchedAt: 1,
      sources: { originCandidate: null, upstreamCandidate: null, issues: null, prs: null }
    }))
  )

  it('get a forge notice instead of a Retry banner', () => {
    expect(
      selectTaskPageOtherForgeSourceRepos(repos, sourceState).map((r) => [r.repoId, r.forge])
    ).toEqual([
      ['azure', 'azure-devops'],
      ['gitlab', 'gitlab']
    ])
    expect(
      withoutOtherForgeSourceRepos(
        selectTaskPageUnresolvedSourceRepos(repos, sourceState),
        repos
      ).map((r) => r.repoId)
    ).toEqual(['github'])
  })
})
