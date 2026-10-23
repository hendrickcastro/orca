import { describe, expect, it } from 'vitest'
import { worktree } from '../worktree-list-groups-test-fixtures'
import {
  getPinnedFavoriteIds,
  splitPinnedFavorites,
  togglePinnedFavoriteId
} from './pinned-favorites'

describe('pinned favorites', () => {
  it('reads the stored ids and toggles one in or out', () => {
    expect([...getPinnedFavoriteIds(undefined)]).toEqual([])
    expect([...getPinnedFavoriteIds({ pinnedFavoriteWorkspaceIds: ['a'] })]).toEqual(['a'])
    expect(togglePinnedFavoriteId(undefined, 'a')).toEqual(['a'])
    expect(togglePinnedFavoriteId(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('splits worktrees and tasks into favourites and the rest, keeping order', () => {
    const first = { ...worktree, id: 'wt-1' }
    const second = { ...worktree, id: 'wt-2' }
    const task = { pair: { folderWorkspace: { id: 'fw-1' } } }
    const split = splitPinnedFavorites(new Set(['wt-2', 'folder:fw-1']), [first, second], [task])
    expect(split.favorites.worktrees.map((entry) => entry.id)).toEqual(['wt-2'])
    expect(split.favorites.tasks).toEqual([task])
    expect(split.rest.worktrees.map((entry) => entry.id)).toEqual(['wt-1'])
    expect(split.rest.tasks).toEqual([])
  })
})
