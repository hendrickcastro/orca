import { describe, expect, it, vi } from 'vitest'
import { commitPinnedAgentsPanelDrop } from './pinned-agents-panel-drop'

function actions() {
  return {
    pinWorktrees: vi.fn(),
    updateSettings: vi.fn(),
    showPanel: vi.fn()
  }
}

describe('commitPinnedAgentsPanelDrop', () => {
  it('pins the dropped workspaces, lists them and shows the panel', () => {
    const drop = actions()
    commitPinnedAgentsPanelDrop(['wt-1', 'folder:fw-1'], drop, [])
    expect(drop.pinWorktrees).toHaveBeenCalledWith(['wt-1', 'folder:fw-1'])
    expect(drop.updateSettings).toHaveBeenCalledWith({
      pinnedAgentsPanelWorkspaceIds: ['wt-1', 'folder:fw-1']
    })
    expect(drop.showPanel).toHaveBeenCalledTimes(1)
  })

  it('appends after the current rows without duplicating them', () => {
    const drop = actions()
    commitPinnedAgentsPanelDrop(['wt-a', 'wt-b'], drop, ['wt-a', 'wt-c'])
    expect(drop.updateSettings).toHaveBeenCalledWith({
      pinnedAgentsPanelWorkspaceIds: ['wt-a', 'wt-c', 'wt-b']
    })
  })

  it('ignores an empty drop', () => {
    const drop = actions()
    commitPinnedAgentsPanelDrop([], drop, ['wt-a'])
    expect(drop.pinWorktrees).not.toHaveBeenCalled()
    expect(drop.showPanel).not.toHaveBeenCalled()
  })
})
