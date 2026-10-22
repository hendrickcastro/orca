import { describe, expect, it } from 'vitest'
import { normalizeRightSidebarRoute } from './right-sidebar-route'

describe('normalizeRightSidebarRoute for the Pinned panel', () => {
  it('keeps the Pinned panel as the persisted tab', () => {
    expect(normalizeRightSidebarRoute('pinned-agents')).toEqual({
      rightSidebarTab: 'pinned-agents',
      rightSidebarExplorerView: 'files'
    })
  })
})
