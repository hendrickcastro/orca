import { describe, expect, it } from 'vitest'
import { buildRows } from './build-rows'
import { ALL_GROUP_KEY, PINNED_GROUP_KEY } from './group-keys'
import type { Row } from './row-types'
import { repo, worktree } from '../../worktree-list-groups-test-fixtures'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../../../shared/project-group-types'
import type { WorkspaceLineage } from '../../../../../../shared/worktree/lineage-types'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../../../../../../shared/workspace-scope'

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

function rowsFor(options: {
  task?: FolderWorkspace
  showPinnedInGroups?: boolean
  collapsed?: Set<string>
}): Row[] {
  const task = options.task ?? TASK
  return buildRows(
    'none',
    [other, member],
    new Map([[repo.id, repo]]),
    null,
    options.collapsed ?? new Set(),
    undefined,
    undefined,
    undefined,
    {},
    new Map([
      [other.id, other],
      [member.id, member]
    ]),
    true,
    undefined,
    [GROUP],
    new Set(),
    new Map(),
    new Map(),
    [],
    undefined,
    [task],
    undefined,
    'local',
    options.showPinnedInGroups ? 'duplicate-in-groups' : 'single-location',
    lineage
  )
}

function describeRows(rows: Row[]): string[] {
  return rows.map((row) => {
    switch (row.type) {
      case 'header':
        return `header:${row.key}:${row.count}`
      case 'item':
        return `item:${row.worktree.id}:${row.sectionKey}:${row.groupDepth}`
      case 'folder-workspace':
        return `folder:${row.folderWorkspace.id}`
      case 'imported-worktrees-card':
      case 'new-external-worktrees-inbox':
      case 'pending-creation':
        return row.type
    }
  })
}

describe('buildRows with a pinned folder workspace', () => {
  it('lists the pinned task and its member worktrees under Pinned, out of their lanes', () => {
    expect(describeRows(rowsFor({}))).toEqual([
      `header:${PINNED_GROUP_KEY}:2`,
      `folder:${TASK.id}`,
      `item:${member.id}:${PINNED_GROUP_KEY}:1`,
      `header:${ALL_GROUP_KEY}:1`,
      `item:${other.id}:${ALL_GROUP_KEY}:0`
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
      `folder:${TASK.id}`,
      `item:${member.id}:${PINNED_GROUP_KEY}:1`,
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
