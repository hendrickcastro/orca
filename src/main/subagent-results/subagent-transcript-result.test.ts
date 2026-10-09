import { describe, expect, it } from 'vitest'
import { readSubagentTranscriptResult } from './subagent-transcript-result'

const row = (value: Record<string, unknown>): string => JSON.stringify(value)
const user = (content: unknown): string => row({ type: 'user', message: { role: 'user', content } })
const assistant = (
  content: unknown,
  stopReason: string | null = null,
  timestamp = '2026-10-09T10:00:00.000Z'
): string =>
  row({
    type: 'assistant',
    timestamp,
    message: { role: 'assistant', content, stop_reason: stopReason }
  })

describe('readSubagentTranscriptResult', () => {
  it('returns the task prompt and the final turn text of a finished subagent', () => {
    const jsonl = [
      user('Investigate the bug'),
      row({ type: 'attachment' }),
      assistant([{ type: 'tool_use', id: 't1', name: 'Grep', input: {} }]),
      user([{ type: 'tool_result', tool_use_id: 't1', content: 'match' }]),
      assistant([{ type: 'thinking', thinking: 'hmm' }]),
      assistant([{ type: 'text', text: 'Root cause found.' }], null),
      assistant(
        [{ type: 'text', text: 'Fix: guard null.' }],
        'end_turn',
        '2026-10-09T11:00:00.000Z'
      ),
      row({ type: 'attachment' })
    ].join('\n')

    expect(readSubagentTranscriptResult(jsonl)).toMatchObject({
      prompt: 'Investigate the bug',
      result: 'Root cause found.\n\nFix: guard null.',
      finished: true,
      failed: false,
      finishedAt: '2026-10-09T11:00:00.000Z'
    })
  })

  it('drops text from turns that a later tool result superseded', () => {
    const jsonl = [
      user([{ type: 'text', text: 'Task' }]),
      assistant([{ type: 'text', text: 'Let me look.' }]),
      assistant([{ type: 'tool_use', id: 't1', name: 'Read', input: {} }], 'tool_use'),
      user([{ type: 'tool_result', tool_use_id: 't1', content: 'file' }])
    ].join('\n')

    expect(readSubagentTranscriptResult(jsonl)).toMatchObject({
      prompt: 'Task',
      result: null,
      finished: false,
      failed: false,
      finishedAt: null
    })
  })

  it('treats a turn that has not ended as unfinished but keeps its latest text', () => {
    const jsonl = [user('Task'), assistant([{ type: 'text', text: 'Working on it' }])].join('\n')

    expect(readSubagentTranscriptResult(jsonl)).toMatchObject({
      result: 'Working on it',
      finished: false,
      finishedAt: null
    })
  })

  it('skips malformed and blank lines', () => {
    const jsonl = ['not json', '', user('Task'), '{"type":', assistant('Done', 'end_turn')].join(
      '\r\n'
    )

    expect(readSubagentTranscriptResult(jsonl)).toMatchObject({
      prompt: 'Task',
      result: 'Done',
      finished: true
    })
  })

  it('takes the answer from a SubagentHandback call even though its tool result follows', () => {
    const jsonl = [
      user('Map the callers'),
      assistant(
        [
          {
            type: 'tool_use',
            id: 'h1',
            name: 'SubagentHandback',
            input: { message: 'Three callers found.' }
          }
        ],
        null,
        '2026-10-09T12:00:00.000Z'
      ),
      user([{ type: 'tool_result', tool_use_id: 'h1', content: 'ok' }])
    ].join('\n')

    expect(readSubagentTranscriptResult(jsonl)).toMatchObject({
      prompt: 'Map the callers',
      result: 'Three callers found.',
      finished: true,
      failed: false,
      finishedAt: '2026-10-09T12:00:00.000Z'
    })
  })

  it('reports a turn that ended on an API error as failed, without the error as the answer', () => {
    const jsonl = [
      user('Task'),
      row({
        type: 'assistant',
        isApiErrorMessage: true,
        message: {
          role: 'assistant',
          model: '<synthetic>',
          stop_reason: 'stop_sequence',
          content: [{ type: 'text', text: 'API Error: rate limit' }]
        }
      })
    ].join('\n')

    expect(readSubagentTranscriptResult(jsonl)).toMatchObject({
      result: null,
      finished: false,
      failed: true
    })
  })

  it('keeps the answer when an injected reminder arrives after it', () => {
    const jsonl = [
      user('Task'),
      assistant([{ type: 'text', text: 'Answer.' }], 'end_turn'),
      row({ type: 'user', isMeta: true, message: { role: 'user', content: 'reminder' } })
    ].join('\n')

    expect(readSubagentTranscriptResult(jsonl)).toMatchObject({
      result: 'Answer.',
      finished: true
    })
  })

  it('starts a new turn when another agent messages the subagent after its answer', () => {
    const jsonl = [
      user('Task'),
      assistant([{ type: 'text', text: 'Long answer.' }], 'end_turn'),
      row({
        type: 'user',
        isMeta: true,
        origin: { kind: 'coordinator' },
        message: { role: 'user', content: 'Thanks, one more thing' }
      }),
      assistant([{ type: 'text', text: 'Short follow-up.' }], 'end_turn')
    ].join('\n')

    expect(readSubagentTranscriptResult(jsonl)).toMatchObject({
      result: 'Short follow-up.',
      finished: true
    })
  })

  it('starts a new turn at a queued message', () => {
    const jsonl = [
      user('Task'),
      assistant([{ type: 'text', text: 'First answer.' }], 'end_turn'),
      row({ type: 'attachment', attachment: { type: 'queued_command', prompt: 'More' } }),
      assistant([{ type: 'text', text: 'Second answer.' }], 'end_turn')
    ].join('\n')

    expect(readSubagentTranscriptResult(jsonl)).toMatchObject({
      result: 'Second answer.',
      finished: true
    })
  })

  it('lists recent tool calls and texts so a running subagent can be followed', () => {
    const jsonl = [
      user('Task'),
      assistant(
        [{ type: 'tool_use', id: 't1', name: 'Grep', input: { pattern: 'chargeCard' } }],
        'tool_use',
        '2026-10-09T10:01:00.000Z'
      ),
      user([{ type: 'tool_result', tool_use_id: 't1', content: 'match' }]),
      assistant(
        [{ type: 'text', text: 'Reading   the\nresults' }],
        null,
        '2026-10-09T10:02:00.000Z'
      )
    ].join('\n')

    expect(readSubagentTranscriptResult(jsonl).activity).toEqual([
      {
        id: 'line-1:0',
        kind: 'tool',
        label: 'Grep',
        detail: 'chargeCard',
        at: '2026-10-09T10:01:00.000Z'
      },
      {
        id: 'line-3:0',
        kind: 'text',
        label: 'Reading the results',
        at: '2026-10-09T10:02:00.000Z'
      }
    ])
  })
})
