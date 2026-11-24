import { toast } from 'sonner'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { upsertAddedRepoWithProjectHostSetup } from '@/components/sidebar/project-admission/completion/add-repo-store-upsert'
import { worktreeRefreshOptions } from '@/components/sidebar/project-admission/host-selection/add-repo-runtime-owner'
import { getProjectIdentityKey } from '../../../../shared/project/host-setup/project-host-setup-projection'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { BookRepoRef } from '../../../../shared/fork-book/book-catalog-types'
import { findBookWorktree } from './book-entry-snapshot'

const WORKTREE_APPEAR_TIMEOUT_MS = 10_000

/** Where one repository of an entry is worked on: a checkout that exists, or one to create. */
export type BookMemberTarget =
  | { kind: 'worktree'; worktreeId: string }
  | { kind: 'branch'; branch: string }
  | { kind: 'new-branch'; branch: string }

/** The local repo for a saved entry: same id here, or the clone of the same remote elsewhere. */
export function findBookRepo(
  repos: readonly Repo[],
  ref: BookRepoRef | undefined,
  repoName?: string
): Repo | null {
  if (!ref) {
    return null
  }
  return (
    repos.find((repo) => repo.id === ref.repoId) ??
    repos.find((repo) => ref.projectId && getProjectIdentityKey(repo) === ref.projectId) ??
    repos.find((repo) => repoName && repo.displayName === repoName) ??
    null
  )
}

export function bookBranchName(branch: string | undefined): string {
  return (branch ?? '').replace(/^refs\/heads\//, '')
}

/** A workspace of the repo already on the branch, if any. */
export function existingBookCheckout(repoId: string, branch: string): Worktree | null {
  const worktrees = selectWorktreesByRepo(useAppStore.getState())[repoId] ?? []
  return worktrees.find((worktree) => bookBranchName(worktree.branch) === branch) ?? null
}

export async function waitForBookWorkspace(workspaceId: string): Promise<Worktree | null> {
  const deadline = Date.now() + WORKTREE_APPEAR_TIMEOUT_MS
  while (Date.now() < deadline) {
    const worktree = findBookWorktree(useAppStore.getState(), workspaceId)
    if (worktree) {
      return worktree
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function createWorktree(
  repo: Repo,
  branch: string,
  displayName: string,
  attempt: { baseBranch?: string; intent: 'open-existing-v2' | 'create-new' }
): Promise<Worktree | null> {
  const result = await window.api.worktrees.create({
    repoId: repo.id,
    name: branch,
    branchNameOverride: branch,
    baseBranch: attempt.baseBranch,
    branchIntent: attempt.intent,
    displayName,
    displayNameKind: 'user',
    setupDecision: 'inherit',
    telemetrySource: 'sidebar'
  })
  return waitForBookWorkspace(result.worktree.id)
}

/**
 * The checkout for one repository: the chosen worktree, a new one on an existing branch (local,
 * else `origin/`), or a new branch from the default base. Null (with a toast) when it fails.
 */
export async function openBookMemberWorktree(
  repo: Repo,
  target: BookMemberTarget,
  displayName: string
): Promise<Worktree | null> {
  if (target.kind === 'worktree') {
    return findBookWorktree(useAppStore.getState(), target.worktreeId)
  }
  const branch = bookBranchName(target.branch)
  // Git allows one checkout per branch, so a workspace already on it is the one to use.
  const existing = existingBookCheckout(repo.id, branch)
  if (existing) {
    return existing
  }
  const attempts =
    target.kind === 'branch'
      ? [
          { baseBranch: branch, intent: 'open-existing-v2' as const },
          { baseBranch: `origin/${branch}`, intent: 'open-existing-v2' as const }
        ]
      : [{ intent: 'create-new' as const }]
  let lastError = ''
  for (const attempt of attempts) {
    try {
      const worktree = await createWorktree(repo, branch, displayName, attempt)
      if (worktree) {
        return worktree
      }
    } catch (error) {
      lastError = errorMessage(error)
    }
  }
  toast.error(
    translate('forkBook.recreateFailed', 'Could not open branch {{branch}} in a new workspace.', {
      branch
    }),
    { description: `${repo.displayName}: ${lastError}` }
  )
  return null
}

/**
 * Brings a repository into Orca on this computer: the user's existing clone, or a fresh clone of
 * its remote into a folder they pick. Null when they cancel or it fails (with a toast).
 */
export async function locateBookRepo(
  ref: BookRepoRef | undefined,
  how: 'folder' | 'clone'
): Promise<Repo | null> {
  if (how === 'folder') {
    return useAppStore.getState().addRepo()
  }
  if (!ref?.remoteUrl) {
    return null
  }
  const destination = await window.api.repos.pickDirectory()
  if (!destination) {
    return null
  }
  const toastId = toast.loading(translate('forkBook.cloning', 'Cloning the repository…'))
  try {
    const cloned = await window.api.repos.clone({ url: ref.remoteUrl, destination })
    const { repo } = upsertAddedRepoWithProjectHostSetup(cloned, { runtimeEnvironmentId: null })
    await useAppStore.getState().fetchWorktrees(repo.id, worktreeRefreshOptions(null))
    toast.success(translate('forkBook.cloned', 'Repository cloned.'), {
      id: toastId,
      description: repo.displayName
    })
    return repo
  } catch (error) {
    toast.error(translate('forkBook.cloneFailed', 'Could not clone the repository.'), {
      id: toastId,
      description: errorMessage(error)
    })
    return null
  }
}
