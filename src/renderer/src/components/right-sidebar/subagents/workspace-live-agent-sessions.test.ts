import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import type { TerminalTab } from '../../../../../shared/terminal-tab-types'
import {
  isLiveWorkspaceSession,
  parseLiveAgentSessionsKey,
  selectWorkspaceLiveClaudeSessionsKey
} from './workspace-live-agent-sessions'

function entry(fields: Partial<AgentStatusEntry>): AgentStatusEntry {
  return {
    state: 'working',
    prompt: '',
    updatedAt: 0,
    stateStartedAt: 0,
    paneKey: 'tab-1:leaf',
    stateHistory: [],
    ...fields
  }
}

function tab(id: string, worktreeId: string): TerminalTab {
  return {
    id,
    ptyId: null,
    worktreeId,
    title: id,
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: 0
  }
}

describe('workspace live Claude sessions', () => {
  const state = {
    tabsByWorktree: { ws: [tab('tab-1', 'ws')], other: [tab('tab-2', 'other')] },
    agentStatusByPaneKey: {
      a: entry({
        tabId: 'tab-1',
        agentType: 'claude',
        providerSession: {
          key: 'session_id',
          id: 'sess-1',
          transcriptPath: String.raw`C:\Users\me\.claude\projects\p\sess-1.jsonl`
        }
      }),
      b: entry({
        paneKey: 'tab-2:leaf',
        tabId: 'tab-2',
        agentType: 'claude',
        providerSession: { key: 'session_id', id: 'sess-2' }
      }),
      c: entry({
        tabId: 'tab-1',
        agentType: 'codex',
        providerSession: { key: 'session_id', id: 'codex-1' }
      })
    }
  }

  it('keeps only Claude sessions running in the workspace terminals', () => {
    const live = parseLiveAgentSessionsKey(selectWorkspaceLiveClaudeSessionsKey(state, 'ws'))
    expect([...live.sessionIds]).toEqual(['sess-1'])
  })

  it('matches a session by id or by its transcript path in any spelling', () => {
    const live = parseLiveAgentSessionsKey(selectWorkspaceLiveClaudeSessionsKey(state, 'ws'))
    expect(isLiveWorkspaceSession({ sessionId: 'sess-1', filePath: '/x.jsonl' }, live)).toBe(true)
    expect(
      isLiveWorkspaceSession(
        { sessionId: 'renamed', filePath: 'c:/users/me/.claude/projects/p/sess-1.jsonl' },
        live
      )
    ).toBe(true)
    expect(isLiveWorkspaceSession({ sessionId: 'sess-2', filePath: '/y.jsonl' }, live)).toBe(false)
  })

  it('is empty without an active workspace', () => {
    expect(selectWorkspaceLiveClaudeSessionsKey(state, null)).toBe('')
  })
})
