import { describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../../shared/project-group-types'
import type { WorkspaceLineage } from '../../../../../shared/worktree/lineage-types'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../../../../../shared/workspace-scope'
import { repo, worktree } from '../../sidebar/worktree-list-groups-test-fixtures'
import {
  expandPinnedAgentsPanelDropIds,
  movePinnedAgentsPanelItem,
  resolvePinnedAgentsPanelItems,
  togglePinnedAgentsPanelItem
} from './pinned-agents-panel-selection'
import { selectPinnedWorkspaceCatalog } from './pinned-workspaces-catalog'

const group: ProjectGroup = {
  id: 'group-1',
  name: 'Checkout',
  parentPath: '/tmp/parent',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

const task: FolderWorkspace = {
  id: 'fw-task',
  projectGroupId: group.id,
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
const pinned = { ...worktree, id: 'wt-pinned', displayName: 'pinned', isPinned: true }
const plain = { ...worktree, id: 'wt-plain', displayName: 'plain' }

const lineage: Record<string, WorkspaceLineage> = {
  [worktreeWorkspaceKey(member.id)]: {
    childWorkspaceKey: worktreeWorkspaceKey(member.id),
    parentWorkspaceKey: folderWorkspaceKey(task.id),
    origin: 'manual',
    capture: { source: 'manual-action', confidence: 'explicit' },
    createdAt: 1
  }
}

const state = {
  repos: [repo],
  worktreesByRepo: { [repo.id]: [plain, member, pinned] },
  folderWorkspaces: [task, { ...task, id: 'fw-unpinned', isPinned: false }],
  projectGroups: [group],
  workspaceLineageByChildKey: lineage
}

describe('selectPinnedWorkspaceCatalog', () => {
  it('lists pinned tasks with their members, then pinned worktrees', () => {
    const catalog = selectPinnedWorkspaceCatalog(state)
    expect(catalog.map((entry) => [entry.id, entry.kind, entry.projectName])).toEqual([
      [folderWorkspaceKey(task.id), 'folder', 'Checkout'],
      [pinned.id, 'worktree', 'orca']
    ])
    expect(catalog[0].members.map((entry) => entry.id)).toEqual([member.id])
  })

  it('ignores archived workspaces', () => {
    const catalog = selectPinnedWorkspaceCatalog({
      ...state,
      worktreesByRepo: { [repo.id]: [{ ...pinned, isArchived: true }] },
      folderWorkspaces: [{ ...task, isArchived: true }]
    })
    expect(catalog).toEqual([])
  })
})

describe('pinned agents panel selection', () => {
  const catalog = selectPinnedWorkspaceCatalog(state)

  it('shows nothing until something is dropped or chosen', () => {
    expect(resolvePinnedAgentsPanelItems(catalog, undefined)).toEqual([])
  })

  it('expands a dropped task to its members through the workspace lineage', () => {
    expect(
      expandPinnedAgentsPanelDropIds(lineage, [folderWorkspaceKey(task.id), pinned.id])
    ).toEqual([folderWorkspaceKey(task.id), member.id, pinned.id])
  })

  it('keeps the stored order and drops ids that are no longer pinned', () => {
    const items = resolvePinnedAgentsPanelItems(catalog, [pinned.id, 'gone', member.id, pinned.id])
    expect(items.map((item) => item.entry.id)).toEqual([pinned.id, member.id])
    expect(items[1].parent?.id).toBe(folderWorkspaceKey(task.id))
  })

  it('adds a row on the first toggle, then removes it', () => {
    const afterAdd = togglePinnedAgentsPanelItem(catalog, undefined, member.id)
    expect(afterAdd).toEqual([member.id])
    expect(togglePinnedAgentsPanelItem(catalog, afterAdd, member.id)).toEqual([])
  })

  it('moves a row onto another row', () => {
    expect(movePinnedAgentsPanelItem(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(movePinnedAgentsPanelItem(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(movePinnedAgentsPanelItem(['a', 'b'], 'a', 'missing')).toEqual(['a', 'b'])
  })
})
