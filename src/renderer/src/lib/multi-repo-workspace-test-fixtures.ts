import { vi } from 'vitest'
import type { FolderWorkspace } from '../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../shared/project-group-types'
import type { Repo } from '../../../shared/repo-types'
import type { CreateWorktreeArgs } from '../../../shared/worktree/create-types'
import type { Worktree } from '../../../shared/worktree/types'

export function repo(id: string, path: string): Repo {
  return { id, path, displayName: id, badgeColor: '', addedAt: 0, worktreeBaseRef: 'main' }
}

export function worktree(args: CreateWorktreeArgs, path = `/worktrees/${args.repoId}`): Worktree {
  return {
    id: `${args.repoId}::${path}`,
    repoId: args.repoId,
    path,
    head: 'abc',
    branch: args.branchNameOverride ?? args.name,
    isBare: false,
    isMainWorktree: false,
    displayName: args.displayName ?? args.name,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    linkedGitLabMR: null,
    linkedGitLabIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0
  }
}

export function fixture() {
  const group: ProjectGroup = {
    id: 'group',
    name: 'Search',
    parentPath: 'D:\\front',
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 0,
    updatedAt: 0
  }
  let workspace: FolderWorkspace = {
    id: 'feature',
    projectGroupId: group.id,
    name: group.name,
    folderPath: 'D:\\front',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0
  }
  return {
    projectGroups: { create: vi.fn(async () => group) },
    folderWorkspaces: {
      create: vi.fn(async () => workspace),
      update: vi.fn(async (args: { updates: Partial<FolderWorkspace> }) => {
        workspace = { ...workspace, ...args.updates }
        return workspace
      })
    },
    worktrees: { create: vi.fn(async (args: CreateWorktreeArgs) => ({ worktree: worktree(args) })) }
  }
}
