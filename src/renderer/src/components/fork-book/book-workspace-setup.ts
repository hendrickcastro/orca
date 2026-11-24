import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { buildMultiRepoCoordinatorPrompt } from '@/lib/multi-repo/multi-repo-workspace-creation'
import { slugifyForWorkspaceName } from '../../../../shared/workspace/naming/workspace-name'
import {
  folderWorkspaceKey,
  parseWorkspaceKey
} from '../../../../shared/workspace/identity/workspace-scope'
import { getProjectIdentityKey } from '../../../../shared/project/host-setup/project-host-setup-projection'
import { upsertBookEntry } from '../../../../shared/fork-book/book-catalog-operations'
import { bookEntryMembers } from '../../../../shared/fork-book/book-catalog-normalization'
import type { Repo } from '../../../../shared/repository/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type {
  BookEntry,
  BookWorkspaceMember
} from '../../../../shared/fork-book/book-catalog-types'
import { useBookStore } from './book-store'
import { findBookWorktree } from './book-entry-snapshot'
import {
  bookBranchName,
  existingBookCheckout,
  findBookRepo,
  openBookMemberWorktree,
  waitForBookWorkspace,
  type BookMemberTarget
} from './book-member-worktrees'

export type BookMemberChoice = { repo: Repo; target: BookMemberTarget }

type OpenedMember = { repo: Repo; worktree: Worktree }

/** The branch a new checkout starts when the entry names none. */
function fallbackBranch(entry: BookEntry): string {
  return slugifyForWorkspaceName(entry.title) || 'book-task'
}

/** Where a repository goes by default: the entry's own checkout, one on its branch, or the branch. */
export function defaultBookMemberTarget(
  entry: BookEntry,
  repo: Repo,
  branch: string | undefined
): BookMemberTarget {
  const live = findBookWorktree(useAppStore.getState(), entry.workspaceId)
  if (live && live.repoId === repo.id) {
    return { kind: 'worktree', worktreeId: live.id }
  }
  const name = bookBranchName(branch)
  if (!name) {
    return { kind: 'new-branch', branch: fallbackBranch(entry) }
  }
  const checkout = existingBookCheckout(repo.id, name)
  return checkout ? { kind: 'worktree', worktreeId: checkout.id } : { kind: 'branch', branch: name }
}

/** The entry's repositories found on this computer, and the ones that still need locating. */
export function defaultBookMemberChoices(
  entry: BookEntry,
  repos: readonly Repo[]
): { choices: BookMemberChoice[]; missing: BookWorkspaceMember[] } {
  const choices: BookMemberChoice[] = []
  const missing: BookWorkspaceMember[] = []
  for (const member of bookEntryMembers(entry)) {
    const repo = findBookRepo(repos, member.repo, member.repoName)
    if (!repo) {
      missing.push(member)
    } else if (!choices.some((choice) => choice.repo.id === repo.id)) {
      choices.push({ repo, target: defaultBookMemberTarget(entry, repo, member.branch) })
    }
  }
  return { choices, missing }
}

function memberOf(opened: OpenedMember): BookWorkspaceMember {
  return {
    repo: {
      repoId: opened.repo.id,
      projectId: getProjectIdentityKey(opened.repo),
      remoteUrl: opened.repo.gitRemoteIdentity?.remoteUrl
    },
    repoName: opened.repo.displayName,
    branch: bookBranchName(opened.worktree.branch) || undefined
  }
}

/**
 * One workspace for several checkouts, like a multi-repo task: the entry's folder workspace when it
 * already has one, otherwise a new one. Each checkout is attached to it as a member.
 */
async function assembleMultiRepoWorkspace(
  entry: BookEntry,
  members: OpenedMember[]
): Promise<Worktree | null> {
  const name = entry.workspaceName || entry.title
  let folderKey =
    parseWorkspaceKey(entry.workspaceId)?.type === 'folder' &&
    findBookWorktree(useAppStore.getState(), entry.workspaceId)
      ? entry.workspaceId
      : null
  if (!folderKey) {
    const group = await window.api.projectGroups.create({
      name,
      parentPath: members[0].repo.path,
      createdFrom: 'manual'
    })
    const created = await window.api.folderWorkspaces.create({
      projectGroupId: group.id,
      name,
      folderPath: members[0].worktree.path,
      createdWithAgent: 'claude'
    })
    folderKey = folderWorkspaceKey(created.folderWorkspace.id)
  }
  const folderId = parseWorkspaceKey(folderKey)
  if (folderId?.type === 'folder') {
    await window.api.folderWorkspaces.update({
      folderWorkspaceId: folderId.folderWorkspaceId,
      updates: { comment: buildMultiRepoCoordinatorPrompt(name, members, entry.description) }
    })
  }
  const { assignWorktreeParent } = useAppStore.getState()
  for (const member of members) {
    await assignWorktreeParent(member.worktree.id, { parentWorktreeId: folderKey })
  }
  return waitForBookWorkspace(folderKey)
}

/**
 * Opens every chosen checkout, joins them in one workspace when there are several, and points the
 * entry at it with its repositories and branches. Null (with a toast) when any step fails.
 */
export async function applyBookWorkspaceSetup(
  entry: BookEntry,
  choices: readonly BookMemberChoice[]
): Promise<Worktree | null> {
  const opened: OpenedMember[] = []
  for (const choice of choices) {
    const worktree = await openBookMemberWorktree(
      choice.repo,
      choice.target,
      entry.workspaceName || entry.title
    )
    if (!worktree) {
      return null
    }
    opened.push({ repo: choice.repo, worktree })
  }
  if (opened.length === 0) {
    return null
  }
  let workspace: Worktree | null
  try {
    workspace =
      opened.length === 1 ? opened[0].worktree : await assembleMultiRepoWorkspace(entry, opened)
  } catch (error) {
    toast.error(
      translate('forkBook.multiRepoFailed', 'Could not join the repositories in one workspace.'),
      {
        description: error instanceof Error ? error.message : String(error)
      }
    )
    return null
  }
  if (!workspace) {
    return null
  }
  const members = opened.map(memberOf)
  const target = workspace
  useBookStore.getState().commit((catalog) => {
    const current = catalog.entries.find((candidate) => candidate.id === entry.id)
    return current
      ? upsertBookEntry(catalog, {
          ...current,
          workspaceId: target.id,
          path: target.path,
          repo: members[0].repo,
          repoName: members[0].repoName,
          branch: members[0].branch,
          members: members.length > 1 ? members : undefined,
          updatedAt: Date.now()
        })
      : catalog
  })
  return workspace
}
