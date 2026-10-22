import { describe, expect, it } from 'vitest'
import { stepPinnedAgentsPaneFontSize, zoomDirectionForKeydown } from './pinned-agents-pane-zoom'

describe('stepPinnedAgentsPaneFontSize', () => {
  it('steps one pane away from the shared terminal size and back', () => {
    expect(stepPinnedAgentsPaneFontSize(null, 14, 'in')).toBe(15)
    expect(stepPinnedAgentsPaneFontSize(15, 14, 'in')).toBe(16)
    expect(stepPinnedAgentsPaneFontSize(15, 14, 'out')).toBeNull()
    expect(stepPinnedAgentsPaneFontSize(20, 14, 'reset')).toBeNull()
  })

  it('stays within readable bounds', () => {
    expect(stepPinnedAgentsPaneFontSize(40, 14, 'in')).toBe(40)
    expect(stepPinnedAgentsPaneFontSize(8, 14, 'out')).toBe(8)
  })
})

describe('zoomDirectionForKeydown', () => {
  const key = (overrides: Partial<KeyboardEvent>) => ({
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...overrides
  })

  it('uses Ctrl on Windows and Linux and Cmd on macOS', () => {
    expect(zoomDirectionForKeydown(key({ key: '=', ctrlKey: true }), false)).toBe('in')
    expect(zoomDirectionForKeydown(key({ key: '=', metaKey: true }), false)).toBeNull()
    expect(zoomDirectionForKeydown(key({ key: '-', metaKey: true }), true)).toBe('out')
    expect(zoomDirectionForKeydown(key({ key: '-', ctrlKey: true }), true)).toBeNull()
  })

  it('accepts the shifted plus, the numpad keys and zero to reset', () => {
    expect(zoomDirectionForKeydown(key({ key: '+', ctrlKey: true }), false)).toBe('in')
    expect(zoomDirectionForKeydown(key({ code: 'NumpadSubtract', ctrlKey: true }), false)).toBe(
      'out'
    )
    expect(zoomDirectionForKeydown(key({ key: '0', ctrlKey: true }), false)).toBe('reset')
    expect(
      zoomDirectionForKeydown(key({ key: '=', ctrlKey: true, altKey: true }), false)
    ).toBeNull()
  })
})
