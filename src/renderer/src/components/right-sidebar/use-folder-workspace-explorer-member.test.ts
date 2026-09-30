import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: vi.fn() }))

import { pickFolderWorkspaceExplorerMember } from './use-folder-workspace-explorer-member'

const front = { worktree: { id: 'front::C:/wt/front', path: 'C:/wt/front' } }
const back = { worktree: { id: 'back::C:/wt/back', path: 'C:/wt/back' } }

describe('pickFolderWorkspaceExplorerMember', () => {
  it('keeps the single-root explorer when the folder has fewer than two members', () => {
    expect(pickFolderWorkspaceExplorerMember([front], undefined, 'C:/wt/front')).toBeNull()
  })

  it('defaults to the worktree the folder already points at', () => {
    expect(pickFolderWorkspaceExplorerMember([back, front], undefined, 'C:/wt/front')).toBe(front)
    expect(pickFolderWorkspaceExplorerMember([back, front], undefined, 'D:/elsewhere')).toBe(back)
  })

  it('honors the chosen member and falls back when it is gone', () => {
    expect(pickFolderWorkspaceExplorerMember([front, back], back.worktree.id, 'C:/wt/front')).toBe(
      back
    )
    expect(pickFolderWorkspaceExplorerMember([front, back], 'removed', 'C:/wt/front')).toBe(front)
  })
})
