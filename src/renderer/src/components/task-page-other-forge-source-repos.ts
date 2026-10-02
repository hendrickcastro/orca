import type { GitRemoteIdentity } from '../../../shared/git-remote-identity'
import {
  parseRemoteRepo,
  type ManualReviewProvider
} from './right-sidebar/source-control/review/remote-repo'
import {
  selectTaskPageUnresolvedSourceRepos,
  type TaskPageRepoSourceState,
  type TaskPageUnresolvedSourceRepo
} from './task-page-cache-selectors'

export type TaskPageOtherForge = Exclude<ManualReviewProvider, 'github'>
export type TaskPageOtherForgeSourceRepo = TaskPageUnresolvedSourceRepo & {
  forge: TaskPageOtherForge
}
type TaskPageRepoWithRemote = {
  id: string
  displayName?: string
  path: string
  gitRemoteIdentity?: GitRemoteIdentity | null
}

function otherForgeOf(repo: TaskPageRepoWithRemote | undefined): TaskPageOtherForge | null {
  const remoteUrl = repo?.gitRemoteIdentity?.remoteUrl
  const provider = remoteUrl ? parseRemoteRepo(remoteUrl)?.provider : null
  return provider && provider !== 'github' ? provider : null
}

/** Repos with no GitHub source because their remote is on another forge, so Retry could never help. */
export function selectTaskPageOtherForgeSourceRepos(
  repos: readonly TaskPageRepoWithRemote[],
  sourceState: readonly TaskPageRepoSourceState[]
): TaskPageOtherForgeSourceRepo[] {
  const repoById = new Map(repos.map((repo) => [repo.id, repo]))
  return selectTaskPageUnresolvedSourceRepos(repos, sourceState).flatMap((unresolved) => {
    const forge = otherForgeOf(repoById.get(unresolved.repoId))
    return forge ? [{ ...unresolved, forge }] : []
  })
}

export function withoutOtherForgeSourceRepos(
  unresolved: TaskPageUnresolvedSourceRepo[],
  repos: readonly TaskPageRepoWithRemote[]
): TaskPageUnresolvedSourceRepo[] {
  const repoById = new Map(repos.map((repo) => [repo.id, repo]))
  return unresolved.filter((entry) => !otherForgeOf(repoById.get(entry.repoId)))
}
