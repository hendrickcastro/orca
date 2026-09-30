import { describe, expect, it } from 'vitest'
import type { FolderWorkspace, WorkspaceKey } from '../../../../shared/folder-workspace-types'
import type { WorkspaceLineage } from '../../../../shared/worktree/lineage-types'
import { resolveCoordinatedWorktreeStatus, selectWorktreeCoordinator } from './worktree-coordinator'

function folder(id: string, name: string, isArchived = false): FolderWorkspace {
  return {
    id,
    projectGroupId: 'group',
    name,
    folderPath: 'C:/wt/front',
    linkedTask: null,
    comment: '',
    isArchived,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0
  }
}

function lineage(child: WorkspaceKey, parent: WorkspaceKey): WorkspaceLineage {
  return {
    childWorkspaceKey: child,
    parentWorkspaceKey: parent,
    origin: 'manual',
    capture: { source: 'explicit-cli-flag', confidence: 'explicit' },
    createdAt: 0
  }
}

describe('worktree coordinator', () => {
  const state = {
    folderWorkspaces: [folder('task', 'Question type text'), folder('old', 'Old', true)],
    workspaceLineageByChildKey: {
      'worktree:front::C:/wt/front': lineage('worktree:front::C:/wt/front', 'folder:task'),
      'worktree:back::C:/wt/back': lineage('worktree:back::C:/wt/back', 'worktree:parent'),
      'worktree:gone::C:/wt/gone': lineage('worktree:gone::C:/wt/gone', 'folder:old')
    }
  }

  it('finds the folder workspace coordinating a worktree', () => {
    expect(selectWorktreeCoordinator(state, 'front::C:/wt/front')).toEqual({
      key: 'folder:task',
      name: 'Question type text'
    })
  })

  it('ignores worktree parents, archived coordinators and the folder card itself', () => {
    expect(selectWorktreeCoordinator(state, 'back::C:/wt/back')).toBeNull()
    expect(selectWorktreeCoordinator(state, 'gone::C:/wt/gone')).toBeNull()
    expect(selectWorktreeCoordinator(state, 'folder:task')).toBeNull()
  })

  it("shows the coordinator's agent state only when the worktree has none of its own", () => {
    expect(resolveCoordinatedWorktreeStatus('inactive', 'working')).toEqual({
      status: 'working',
      fromCoordinator: true
    })
    expect(resolveCoordinatedWorktreeStatus('done', 'working')).toEqual({
      status: 'done',
      fromCoordinator: false
    })
    expect(resolveCoordinatedWorktreeStatus('inactive', 'active')).toEqual({
      status: 'inactive',
      fromCoordinator: false
    })
    expect(resolveCoordinatedWorktreeStatus('inactive', null).fromCoordinator).toBe(false)
  })
})
