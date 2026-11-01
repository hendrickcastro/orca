import { describe, expect, it } from 'vitest'
import { ALL_GROUP_KEY, PINNED_GROUP_KEY } from '../../../../../../shared/sidebar-list/group-keys'
import type {
  PinnedWorktreeDisplayPolicy,
  Row
} from '../../../../../../shared/sidebar-list/row-types'
import { planSidebarRows } from '../../../../../../shared/sidebar-list/sidebar-row-plan'
import { repo, worktree } from '../../worktree-list-groups-test-fixtures'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../../../shared/project-group-types'
import type { WorkspaceLineage } from '../../../../../../shared/worktree/lineage-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../../../../../../shared/workspace-scope'
import { cloneDefaultWorkspaceStatuses } from '../../../../../../shared/workspace-statuses'
import {
  getPinnedTaskOpenKey,
  PINNED_FAVORITES_GROUP_KEY
} from '../../../../../../shared/sidebar-list/pinned-favorites'

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

const lineage: Record<string, WorkspaceLineage> = {
  [worktreeWorkspaceKey(member.id)]: {
    childWorkspaceKey: worktreeWorkspaceKey(member.id),
    parentWorkspaceKey: folderWorkspaceKey(TASK.id),
    origin: 'manual',
    capture: { source: 'manual-action', confidence: 'explicit' },
    createdAt: 1
  }
}

function buildRows(options: {
  worktrees: Worktree[]
  task: FolderWorkspace
  policy: PinnedWorktreeDisplayPolicy
  collapsed?: Set<string>
  favorites?: string[]
}): Row[] {
  return planSidebarRows({
    groupBy: 'none',
    worktrees: options.worktrees,
    repoMap: new Map([[repo.id, repo]]),
    prGroupOf: () => 'in-progress',
    workspaceStatuses: cloneDefaultWorkspaceStatuses(),
    projectOrderBy: 'manual',
    lineageById: {},
    worktreeMap: new Map(options.worktrees.map((entry) => [entry.id, entry])),
    nestLineage: true,
    projectGroups: [GROUP],
    placeholderRepoIds: new Set(),
    importedWorktreesByRepo: new Map(),
    newExternalWorktreesInboxByRepo: new Map(),
    pendingCreations: [],
    folderWorkspaces: [options.task],
    defaultHostId: 'local',
    pinnedDisplayPolicy: options.policy,
    filterRepoIds: [],
    workspaceLineageByChildKey: lineage,
    pinnedFavoriteIds: new Set(options.favorites)
  }).render(options.collapsed ?? new Set())
}

function rowsFor(options: {
  task?: FolderWorkspace
  showPinnedInGroups?: boolean
  collapsed?: Set<string>
  favorites?: string[]
}): Row[] {
  return buildRows({
    worktrees: [other, member],
    task: options.task ?? TASK,
    policy: options.showPinnedInGroups ? 'duplicate-in-groups' : 'single-location',
    collapsed: options.collapsed,
    favorites: options.favorites
  })
}

function describeRows(rows: Row[]): string[] {
  return rows.map((row) => {
    switch (row.type) {
      case 'header':
        return `header:${row.key}:${row.count}`
      case 'item':
        return `item:${row.worktree.id}:${row.sectionKey}:${row.groupDepth}${row.titleOverride ? `:${row.titleOverride}` : ''}`
      case 'folder-workspace':
        return `folder:${row.folderWorkspace.id}${row.lineageGroupKey ? `:${row.lineageChildCount}:${row.lineageCollapsed ? 'folded' : 'open'}` : ''}`
      case 'imported-worktrees-card':
      case 'new-external-worktrees-inbox':
      case 'pending-creation':
        return row.type
    }
  })
}

describe('planSidebarRows with a pinned folder workspace', () => {
  it('lists the pinned task folded under Pinned, its members out of their lanes', () => {
    expect(describeRows(rowsFor({}))).toEqual([
      `header:${PINNED_GROUP_KEY}:2`,
      `folder:${TASK.id}:1:folded`,
      `header:${ALL_GROUP_KEY}:1`,
      `item:${other.id}:${ALL_GROUP_KEY}:0`
    ])
  })

  it('unfolds the task to its members, each titled by its repo', () => {
    expect(describeRows(rowsFor({ collapsed: new Set([getPinnedTaskOpenKey(TASK.id)]) }))).toEqual([
      `header:${PINNED_GROUP_KEY}:2`,
      `folder:${TASK.id}:1:open`,
      `item:${member.id}:${PINNED_GROUP_KEY}:1:${repo.displayName}`,
      `header:${ALL_GROUP_KEY}:1`,
      `item:${other.id}:${ALL_GROUP_KEY}:0`
    ])
  })

  it('moves favourite pinned workspaces into a Favorites section above Pinned', () => {
    const pinnedOther = { ...other, isPinned: true }
    const rows = buildRows({
      worktrees: [pinnedOther, member],
      task: TASK,
      policy: 'single-location',
      favorites: [folderWorkspaceKey(TASK.id)]
    })
    expect(describeRows(rows)).toEqual([
      `header:${PINNED_FAVORITES_GROUP_KEY}:2`,
      `folder:${TASK.id}:1:folded`,
      `header:${PINNED_GROUP_KEY}:1`,
      `item:${pinnedOther.id}:${PINNED_GROUP_KEY}:0`
    ])
  })

  it('keeps an unpinned task in its lane', () => {
    expect(describeRows(rowsFor({ task: { ...TASK, isPinned: false } }))).toEqual([
      `header:${ALL_GROUP_KEY}:3`,
      `item:${other.id}:${ALL_GROUP_KEY}:0`,
      `item:${member.id}:${ALL_GROUP_KEY}:0`,
      `folder:${TASK.id}`
    ])
  })

  it('also shows the task and its members in their lanes under the duplicate policy', () => {
    expect(describeRows(rowsFor({ showPinnedInGroups: true }))).toEqual([
      `header:${PINNED_GROUP_KEY}:2`,
      `folder:${TASK.id}:1:folded`,
      `header:${ALL_GROUP_KEY}:3`,
      `item:${other.id}:${ALL_GROUP_KEY}:0`,
      `item:${member.id}:${ALL_GROUP_KEY}:0`,
      `folder:${TASK.id}`
    ])
  })

  it('hides the task rows while the Pinned section is collapsed', () => {
    expect(describeRows(rowsFor({ collapsed: new Set([PINNED_GROUP_KEY]) }))).toEqual([
      `header:${PINNED_GROUP_KEY}:2`,
      `header:${ALL_GROUP_KEY}:1`,
      `item:${other.id}:${ALL_GROUP_KEY}:0`
    ])
  })

  it('counts the pinned task on its host', () => {
    const header = rowsFor({})[0]
    expect(header.type === 'header' && header.hostWorktreeCounts?.get('local')).toBe(2)
    expect(header.type === 'header' && header.worktreeIds).toEqual([member.id])
  })
})
