import { describe, expect, it } from 'vitest'
import { classifyProviderFrame } from './provider-frame-disposition'
import { unhandledProviderFrameJournalItem } from './unhandled-provider-frame'

const initWithFailedMcpServer = {
  type: 'system',
  subtype: 'init',
  session_id: 'session-1',
  mcp_servers: [
    { name: 'playwright', status: 'connected' },
    { name: 'plugin:design:gmail', status: 'failed' }
  ],
  plugins: [{ name: 'design', source: 'design@synced' }]
}

describe('Claude system/init with a failed MCP server', () => {
  it('stays status chrome instead of becoming an error row', () => {
    expect(classifyProviderFrame('claude', 'message:system:init', initWithFailedMcpServer)).toBe(
      'status-chrome'
    )
    expect(
      unhandledProviderFrameJournalItem('claude', 'message:system:init', initWithFailedMcpServer)
    ).toBeNull()
  })

  it('still surfaces a failure any other Claude frame reports', () => {
    expect(
      classifyProviderFrame('claude', 'message:system:mirror_error', {
        type: 'system',
        subtype: 'mirror_error',
        error: 'boom'
      })
    ).toBe('error-surface')
    expect(
      classifyProviderFrame('claude', 'message:system:unknown_new_kind', { status: 'failed' })
    ).toBe('error-surface')
  })
})
