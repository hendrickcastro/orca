import { describe, expect, it } from 'vitest'
import {
  normalizePinnedAgentsWorkbenchArrangement,
  normalizePinnedAgentsWorkbenchRowHeight,
  pinnedAgentsWorkbenchGridClassName,
  pinnedAgentsWorkbenchGridStyle
} from './pinned-agents-workbench-layout'

describe('pinned agents workbench layout', () => {
  it('flows panes automatically unless an arrangement was chosen', () => {
    expect(normalizePinnedAgentsWorkbenchArrangement(undefined)).toBe('auto')
    expect(normalizePinnedAgentsWorkbenchArrangement('constructor')).toBe('auto')
    expect(normalizePinnedAgentsWorkbenchArrangement('columns-3')).toBe('columns-3')
    expect(pinnedAgentsWorkbenchGridStyle({ arrangement: 'auto', rowHeight: 'normal' })).toEqual({
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
      gridAutoRows: 'minmax(360px, 1fr)'
    })
    expect(pinnedAgentsWorkbenchGridStyle({ arrangement: 'columns-2', rowHeight: 'tall' })).toEqual(
      { gridAutoRows: 'minmax(540px, 1fr)' }
    )
  })

  it('shapes the first three panes through their position in the grid', () => {
    expect(pinnedAgentsWorkbenchGridClassName('one-top-two-bottom')).toContain(
      '[&>:nth-child(1)]:col-span-2'
    )
    expect(pinnedAgentsWorkbenchGridClassName('two-top-one-bottom')).toContain(
      '[&>:nth-child(3)]:col-span-2'
    )
    expect(pinnedAgentsWorkbenchGridClassName('one-left-two-right')).toContain(
      '[&>:nth-child(1)]:row-span-2'
    )
    expect(pinnedAgentsWorkbenchGridClassName('two-left-one-right')).toContain(
      '[&>:nth-child(3)]:row-span-2'
    )
    expect(pinnedAgentsWorkbenchGridClassName('auto')).toBe('')
  })

  it('falls back to the normal row height', () => {
    expect(normalizePinnedAgentsWorkbenchRowHeight('huge')).toBe('normal')
    expect(normalizePinnedAgentsWorkbenchRowHeight('compact')).toBe('compact')
  })
})
