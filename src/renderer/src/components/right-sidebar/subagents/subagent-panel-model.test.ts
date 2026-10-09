import { describe, expect, it } from 'vitest'
import { buildSubagentResultMarkdown, withSubagentActivity } from './subagent-result-document'
import {
  orderSessionsByLiveWork,
  orderSubagentRows,
  sortSubagentsByLaunch,
  subagentRowDotState
} from './subagent-row-state'

const labels = {
  fallbackTitle: 'Subagent result',
  agent: 'Agent',
  parentTask: 'Task',
  status: 'Status',
  finished: 'Finished',
  failed: 'Failed',
  inProgress: 'In progress',
  result: 'Result',
  noResult: 'No final answer yet.',
  prompt: 'Assignment',
  recentActivity: 'Recent activity'
}

describe('subagentRowDotState', () => {
  const session = (status: 'running' | 'completed' | 'failed' | 'stopped' | null) => ({
    subagent: { parentSessionId: 'p', agentType: null, status }
  })

  it('marks a finished transcript done even without a task notification', () => {
    expect(subagentRowDotState(session(null), { filePath: 'x', finished: true })).toBe('done')
    expect(subagentRowDotState(session('running'), { filePath: 'x', finished: true })).toBe('done')
  })

  it('marks a turn that ended on an API error as failed', () => {
    expect(
      subagentRowDotState(session(null), { filePath: 'x', finished: false, failed: true })
    ).toBe('failed')
  })

  it('keeps reported failures and stops over the transcript verdict', () => {
    expect(subagentRowDotState(session('failed'), { filePath: 'x', finished: true })).toBe('failed')
    expect(subagentRowDotState(session('stopped'), undefined)).toBe('interrupted')
  })

  it('shows working only while the scanner reports it running', () => {
    expect(subagentRowDotState(session('running'), { filePath: 'x', finished: false })).toBe(
      'working'
    )
    expect(subagentRowDotState(session(null), { filePath: 'x', finished: false })).toBeNull()
  })
})

describe('sortSubagentsByLaunch', () => {
  it('orders by creation time and falls back to modification time', () => {
    const rows = [
      { id: 'b', createdAt: '2026-10-09T10:02:00Z', modifiedAt: '2026-10-09T10:09:00Z' },
      { id: 'c', createdAt: null, modifiedAt: '2026-10-09T10:03:00Z' },
      { id: 'a', createdAt: '2026-10-09T10:01:00Z', modifiedAt: '2026-10-09T10:05:00Z' }
    ]
    expect(sortSubagentsByLaunch(rows).map((row) => row.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('buildSubagentResultMarkdown', () => {
  it('puts the answer before the assignment and names the parent task', () => {
    const markdown = buildSubagentResultMarkdown({
      detail: {
        prompt: 'Find the bug',
        result: 'It is in parse().',
        finished: true,
        failed: false,
        finishedAt: '2026-10-09T11:00:00.000Z',
        description: 'Investigate parser',
        agentType: 'Explore',
        activity: []
      },
      parentTitle: 'Fix login',
      labels
    })
    expect(markdown).toBe(
      `${[
        '# Investigate parser',
        '**Agent:** Explore  \n**Task:** Fix login  \n**Status:** Finished · 2026-10-09T11:00:00.000Z',
        '## Result',
        'It is in parse().',
        '## Assignment',
        'Find the bug'
      ].join('\n\n')}\n`
    )
  })

  it('says when there is no answer yet and omits an empty assignment', () => {
    const markdown = buildSubagentResultMarkdown({
      detail: {
        prompt: null,
        result: null,
        finished: false,
        failed: false,
        finishedAt: null,
        description: null,
        agentType: null,
        activity: []
      },
      parentTitle: null,
      labels
    })
    const expected = [
      '# Subagent result',
      '**Status:** In progress',
      '## Result',
      '_No final answer yet._'
    ].join('\n\n')
    expect(markdown).toBe(`${expected}\n`)
  })
})

describe('live work ordering', () => {
  const sub = (filePath: string, status: 'running' | 'completed' | null) => ({
    filePath,
    subagent: { parentSessionId: 'p', agentType: null, status }
  })
  const summaries = new Map([['b', { filePath: 'b', finished: true }]])

  it('puts working subagents first and keeps launch order otherwise', () => {
    const rows = [sub('a', 'completed'), sub('b', 'running'), sub('c', 'running'), sub('d', null)]
    expect(orderSubagentRows(rows, summaries).map((row) => row.filePath)).toEqual([
      'c',
      'a',
      'b',
      'd'
    ])
  })

  it('puts sessions with a working subagent first', () => {
    const sessions = [{ id: 'old' }, { id: 'live' }, { id: 'done' }]
    const rows = new Map([
      ['old', { subagents: [sub('x', null)], summaryByPath: new Map() }],
      ['live', { subagents: [sub('y', 'running')], summaryByPath: new Map() }],
      ['done', { subagents: [sub('z', 'completed')], summaryByPath: new Map() }]
    ])
    expect(orderSessionsByLiveWork(sessions, rows).map((session) => session.id)).toEqual([
      'live',
      'old',
      'done'
    ])
  })
})

describe('withSubagentActivity', () => {
  it('treats a detail from a main process without activity tracking as having none', () => {
    const legacy = JSON.parse(
      '{"prompt":"Task","result":"Done","finished":true,"failed":false,"finishedAt":null,"description":null,"agentType":null}'
    )
    expect(withSubagentActivity(legacy).activity).toEqual([])
    expect(
      buildSubagentResultMarkdown({
        detail: withSubagentActivity(legacy),
        parentTitle: null,
        labels
      })
    ).toContain('Done')
  })
})
