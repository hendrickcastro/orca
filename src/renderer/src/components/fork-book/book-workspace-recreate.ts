import { toast } from 'sonner'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { getProjectIdentityKey } from '../../../../shared/project/host-setup/project-host-setup-projection'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { BookEntry, BookRepoRef } from '../../../../shared/fork-book/book-catalog-types'
import { findBookWorktree } from './book-entry-snapshot'
import { upsertAddedRepoWithProjectHostSetup } from '@/components/sidebar/project-admission/completion/add-repo-store-upsert'
import { worktreeRefreshOptions } from '@/components/sidebar/project-admission/host-selection/add-repo-runtime-owner'

const WORKTREE_APPEAR_TIMEOUT_MS = 10_000

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

/** A workspace of the repo already on the branch, if any. */
export function existingBookCheckout(repoId: string, branch: string): Worktree | null {
  const worktrees = selectWorktreesByRepo(useAppStore.getState())[repoId] ?? []
  return (
    worktrees.find((worktree) => worktree.branch?.replace(/^refs\/heads\//, '') === branch) ?? null
  )
}

async function waitForWorktree(worktreeId: string): Promise<Worktree | null> {
  const deadline = Date.now() + WORKTREE_APPEAR_TIMEOUT_MS
  while (Date.now() < deadline) {
    const worktree = findBookWorktree(useAppStore.getState(), worktreeId)
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

/**
 * Checks the saved branch out in a new workspace: the local branch when it still exists,
 * otherwise the pushed `origin/<branch>`. Null (with a toast) when neither can be opened.
 */
export async function createBookWorkspace(args: {
  ref: BookRepoRef | undefined
  repoName?: string
  branch: string | undefined
  displayName: string
  /** Imports: when the branch never reached the remote, start it fresh from the default base. */
  allowNewBranch?: boolean
}): Promise<Worktree | null> {
  const repo = findBookRepo(useAppStore.getState().repos, args.ref, args.repoName)
  if (!repo) {
    toast.error(
      translate('forkBook.repoMissing', 'The repository is not open in Orca on this computer.'),
      { description: args.ref?.remoteUrl ?? args.repoName }
    )
    return null
  }
  if (!args.branch) {
    toast.error(translate('forkBook.branchMissing', 'This entry has no branch to check out.'))
    return null
  }
  // Git allows one checkout per branch, so a workspace already on it is the one to use.
  const existing = existingBookCheckout(repo.id, args.branch)
  if (existing) {
    return existing
  }
  let lastError = ''
  const attempts: { baseBranch?: string; intent: 'open-existing-v2' | 'create-new' }[] = [
    { baseBranch: args.branch, intent: 'open-existing-v2' },
    { baseBranch: `origin/${args.branch}`, intent: 'open-existing-v2' },
    ...(args.allowNewBranch ? [{ intent: 'create-new' as const }] : [])
  ]
  for (const attempt of attempts) {
    try {
      const result = await window.api.worktrees.create({
        repoId: repo.id,
        name: args.branch,
        branchNameOverride: args.branch,
        baseBranch: attempt.baseBranch,
        branchIntent: attempt.intent,
        displayName: args.displayName,
        displayNameKind: 'user',
        setupDecision: 'inherit',
        telemetrySource: 'sidebar'
      })
      if (attempt.intent === 'create-new') {
        toast.warning(
          translate(
            'forkBook.importNewBranch',
            'Branch {{branch}} is not on the remote, so it was started from the default branch.',
            { branch: args.branch }
          )
        )
      }
      return await waitForWorktree(result.worktree.id)
    } catch (error) {
      lastError = errorMessage(error)
    }
  }
  toast.error(
    translate('forkBook.recreateFailed', 'Could not open branch {{branch}} in a new workspace.', {
      branch: args.branch
    }),
    { description: lastError }
  )
  return null
}

/** Recreates a removed workspace for an entry and points the entry at it. */
export async function recreateBookEntryWorkspace(
  entry: BookEntry,
  commit: (update: (entry: BookEntry) => BookEntry) => void
): Promise<Worktree | null> {
  const worktree = await createBookWorkspace({
    ref: entry.repo,
    repoName: entry.repoName,
    branch: entry.branch,
    displayName: entry.workspaceName,
    allowNewBranch: Boolean(entry.importedContext)
  })
  if (worktree) {
    commit((current) => ({
      ...current,
      workspaceId: worktree.id,
      path: worktree.path,
      updatedAt: Date.now()
    }))
  }
  return worktree
}

/**
 * Brings the entry's repository into Orca on this computer: the user's existing clone, or a fresh
 * clone of its remote into a folder they pick. Null when they cancel or it fails (with a toast).
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
