import { describe, expect, it } from 'vitest'
import {
  ALL_GROUP_KEY,
  PINNED_GROUP_KEY,
  getWorktreeLineageGroupKey
} from '../../../../../../shared/sidebar-list/sections/group-keys'
import type {
  PinnedWorktreeDisplayPolicy,
  Row
} from '../../../../../../shared/sidebar-list/row-types'
import { planSidebarRows } from '../../../../../../shared/sidebar-list/sidebar-row-plan'
import { repo, worktree } from './worktree-list-groups-test-fixtures'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspaces/folder-workspace-types'
import {
  getFolderWorkspaceHostIdentity,
  getFolderWorkspaceWorktree
} from '../../../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { ProjectGroup } from '../../../../../../shared/project/groups/project-group-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../../../shared/worktree/host-qualified-identity'
import { folderWorkspaceKey } from '../../../../../../shared/workspace/identity/workspace-scope'
import { cloneDefaultWorkspaceStatuses } from '../../../../../../shared/workspace/status/workspace-statuses'
import { PINNED_FAVORITES_GROUP_KEY } from '../../../../../../shared/sidebar-list/pinned-favorites'

const GROUP: ProjectGroup = {
  id: 'group-1',
  name: 'Checkout task',
  parentPath: '/tmp/parent',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

const TASK: FolderWorkspace = {
  id: 'fw-task',
  projectGroupId: GROUP.id,
  name: 'Checkout task',
  folderPath: '/tmp/orca-feature',
  linkedTask: null,
  comment: '',
  isArchived: false,
  isUnread: false,
  isPinned: true,
  sortOrder: 1,
  lastActivityAt: 1,
  createdAt: 1,
  updatedAt: 1,
  workspaceStatus: 'in-progress'
}

const member = { ...worktree, id: 'wt-member', displayName: 'checkout (orca)' }
const other = { ...worktree, id: 'wt-other', displayName: 'unrelated' }

function buildRows(options: {
  worktrees?: Worktree[]
  task?: FolderWorkspace
  policy?: PinnedWorktreeDisplayPolicy
  collapsed?: Set<string>
  favorites?: string[]
}): Row[] {
  const worktrees = options.worktrees ?? [other, member]
  const task = options.task ?? TASK
  return planSidebarRows({
    groupBy: 'none',
    sortBy: 'manual',
    worktrees,
    repoMap: new Map([[repo.id, repo]]),
    prGroupOf: () => 'in-progress',
    workspaceStatuses: cloneDefaultWorkspaceStatuses(),
    projectOrderBy: 'manual',
    lineageById: {},
    // The multi-repository task coordinates its member worktree.
    lineageParentIdentities: new Map([
      [getWorktreeHostIdentity(member), getFolderWorkspaceHostIdentity(task)]
    ]),
    worktreeMap: new Map(worktrees.map((entry) => [entry.id, entry])),
    nestLineage: true,
    projectGroups: [GROUP],
    placeholderRepoIds: new Set(),
    importedWorktreesByRepo: new Map(),
    newExternalWorktreesInboxByRepo: new Map(),
    pendingCreations: [],
    folderWorkspaces: [task],
    defaultHostId: 'local',
    pinnedDisplayPolicy: options.policy ?? 'single-location',
    filterRepoIds: [],
    pinnedFavoriteIds: new Set(options.favorites)
  }).render(options.collapsed ?? new Set())
}

function describeRows(rows: Row[]): string[] {
  return rows.map((row) => {
    switch (row.type) {
      case 'header':
        return `header:${row.key}:${row.count}`
      case 'item':
        return `item:${row.worktree.id}:${row.sectionKey}${row.titleOverride ? `:${row.titleOverride}` : ''}`
      case 'folder-workspace':
        return `folder:${row.folderWorkspace.id}:${row.sectionKey ?? 'lane'}${row.lineageCollapsed ? ':folded' : ''}`
      default:
        return row.type
    }
  })
}

const TASK_LINEAGE_KEY = getWorktreeLineageGroupKey(getFolderWorkspaceWorktree(TASK))

describe('fork: a pinned multi-repository task in the sidebar', () => {
  it('moves under Pinned with its members, each titled by its repo', () => {
    expect(describeRows(buildRows({}))).toEqual([
      `header:${PINNED_GROUP_KEY}:2`,
      `folder:${TASK.id}:${PINNED_GROUP_KEY}`,
      `item:${member.id}:${PINNED_GROUP_KEY}:${repo.displayName}`,
      `header:${ALL_GROUP_KEY}:1`,
      `item:${other.id}:${ALL_GROUP_KEY}`
    ])
  })

  it('folds its members away with its lineage key', () => {
    expect(describeRows(buildRows({ collapsed: new Set([TASK_LINEAGE_KEY]) }))).toEqual([
      `header:${PINNED_GROUP_KEY}:2`,
      `folder:${TASK.id}:${PINNED_GROUP_KEY}:folded`,
      `header:${ALL_GROUP_KEY}:1`,
      `item:${other.id}:${ALL_GROUP_KEY}`
    ])
  })

  it('lists favourite pinned workspaces in a Favorites section above Pinned', () => {
    const pinnedOther = { ...other, isPinned: true }
    expect(
      describeRows(
        buildRows({ worktrees: [pinnedOther, member], favorites: [folderWorkspaceKey(TASK.id)] })
      )
    ).toEqual([
      `header:${PINNED_FAVORITES_GROUP_KEY}:2`,
      `folder:${TASK.id}:${PINNED_GROUP_KEY}`,
      `item:${member.id}:${PINNED_GROUP_KEY}:${repo.displayName}`,
      `header:${PINNED_GROUP_KEY}:1`,
      `item:${pinnedOther.id}:${PINNED_GROUP_KEY}`
    ])
  })

  it('stays in its lane while unpinned', () => {
    expect(describeRows(buildRows({ task: { ...TASK, isPinned: false } }))).toEqual([
      `header:${ALL_GROUP_KEY}:3`,
      `item:${other.id}:${ALL_GROUP_KEY}`,
      `folder:${TASK.id}:lane`,
      `item:${member.id}:${ALL_GROUP_KEY}`
    ])
  })

  it('also stays in its lane under the duplicate policy', () => {
    const rows = describeRows(buildRows({ policy: 'duplicate-in-groups' }))
    expect(rows.slice(0, 3)).toEqual([
      `header:${PINNED_GROUP_KEY}:2`,
      `folder:${TASK.id}:${PINNED_GROUP_KEY}`,
      `item:${member.id}:${PINNED_GROUP_KEY}:${repo.displayName}`
    ])
    expect(rows).toContain(`folder:${TASK.id}:lane`)
  })

  it('counts the task and its member on the Pinned header host', () => {
    const header = buildRows({})[0]
    expect(header.type === 'header' && header.hostWorktreeCounts?.get('local')).toBe(2)
    expect(header.type === 'header' && header.worktreeIds).toEqual([member.id])
  })
})
