import { describe, expect, it } from 'vitest'
import { getPinnedFavoriteIds } from '../../../../../shared/sidebar-list/pinned-favorites'
import { togglePinnedFavoriteId } from './pinned-favorites'

describe('pinned favorites', () => {
  it('reads the stored ids and toggles one in or out', () => {
    expect([...getPinnedFavoriteIds(undefined)]).toEqual([])
    expect([...getPinnedFavoriteIds({ pinnedFavoriteWorkspaceIds: ['a'] })]).toEqual(['a'])
    expect(togglePinnedFavoriteId(undefined, 'a')).toEqual(['a'])
    expect(togglePinnedFavoriteId(['a', 'b'], 'a')).toEqual(['b'])
  })
})
