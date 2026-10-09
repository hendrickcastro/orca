import type { SubagentActivityItem } from '../../shared/subagent-results-types'

export type SubagentTranscriptResult = {
  prompt: string | null
  result: string | null
  finished: boolean
  /** The last turn ended on an API error (e.g. a rate limit), not on an answer. */
  failed: boolean
  finishedAt: string | null
  /** Most recent tool calls and texts, oldest first, so a running subagent can be followed. */
  activity: SubagentActivityItem[]
}

export const SUBAGENT_ACTIVITY_MAX_ITEMS = 20
const ACTIVITY_TEXT_MAX_LENGTH = 160
// Tool arguments that best say what a call does, in preference order.
const TOOL_DETAIL_KEYS = [
  'description',
  'command',
  'pattern',
  'file_path',
  'path',
  'query',
  'url',
  'prompt',
  'subject'
]

// Claude's subagents may close by calling this tool; its `message` is the answer they return.
const HANDBACK_TOOL_NAME = 'SubagentHandback'

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined
}

function parseRow(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function textOf(content: unknown): string[] {
  if (typeof content === 'string') {
    return content.trim() ? [content] : []
  }
  if (!Array.isArray(content)) {
    return []
  }
  const texts: string[] = []
  for (const block of content) {
    const text = field(block, 'text')
    if (field(block, 'type') === 'text' && typeof text === 'string' && text.trim()) {
      texts.push(text)
    }
  }
  return texts
}

function handbackMessage(content: unknown): string | null {
  if (!Array.isArray(content)) {
    return null
  }
  for (const block of content) {
    const message = field(field(block, 'input'), 'message')
    if (
      field(block, 'type') === 'tool_use' &&
      field(block, 'name') === HANDBACK_TOOL_NAME &&
      typeof message === 'string' &&
      message.trim()
    ) {
      return message
    }
  }
  return null
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > ACTIVITY_TEXT_MAX_LENGTH
    ? `${flat.slice(0, ACTIVITY_TEXT_MAX_LENGTH - 1)}…`
    : flat
}

function activityOf(content: unknown, at: string | null, rowId: string): SubagentActivityItem[] {
  if (!Array.isArray(content)) {
    return typeof content === 'string' && content.trim()
      ? [{ id: `${rowId}:0`, kind: 'text', label: oneLine(content), at }]
      : []
  }
  const items: SubagentActivityItem[] = []
  content.forEach((block: unknown, index) => {
    const id = `${rowId}:${index}`
    const type = field(block, 'type')
    const text = field(block, 'text')
    const name = field(block, 'name')
    if (type === 'text' && typeof text === 'string' && text.trim()) {
      items.push({ id, kind: 'text', label: oneLine(text), at })
    } else if (type === 'tool_use' && typeof name === 'string') {
      const input = field(block, 'input')
      const detail = TOOL_DETAIL_KEYS.map((key) => field(input, key)).find(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
      )
      items.push({
        id,
        kind: 'tool',
        label: name,
        ...(detail ? { detail: oneLine(detail) } : {}),
        at
      })
    }
  })
  return items
}

/** Reads a Claude subagent transcript: the task it was given and the text of its last turn.
 *  Claude writes one row per content block, so the last turn is every assistant row after the
 *  final user row (tool results arrive as user rows). */
export function readSubagentTranscriptResult(jsonl: string): SubagentTranscriptResult {
  let prompt: string | null = null
  let turnTexts: string[] = []
  let lastStopReason: unknown = null
  let lastAssistantAt: string | null = null
  let userAfterAssistant = false
  let failed = false
  let handback: { message: string; at: string | null } | null = null
  const activity: SubagentActivityItem[] = []
  const startTurn = (): void => {
    turnTexts = []
    lastStopReason = null
    failed = false
    userAfterAssistant = true
  }
  for (const [lineIndex, line] of jsonl.split('\n').entries()) {
    if (!line.trim()) {
      continue
    }
    const row = parseRow(line)
    const type = field(row, 'type')
    const message = field(row, 'message')
    const timestamp = field(row, 'timestamp')
    if (type === 'user') {
      if (prompt === null) {
        const texts = textOf(field(message, 'content'))
        prompt = texts.length > 0 ? texts.join('\n\n') : null
      }
      // Why: injected reminders are not the conversation, but a meta message with an `origin`
      // (coordinator, another agent, a task notice) is one the subagent answers in a new turn.
      if (field(row, 'isMeta') !== true || field(row, 'origin') !== undefined) {
        startTurn()
      }
      continue
    }
    if (type === 'attachment') {
      if (field(field(row, 'attachment'), 'type') === 'queued_command') {
        startTurn()
      }
      continue
    }
    if (type !== 'assistant') {
      continue
    }
    const content = field(message, 'content')
    if (field(row, 'isApiErrorMessage') !== true) {
      const uuid = field(row, 'uuid')
      activity.push(
        ...activityOf(
          content,
          typeof timestamp === 'string' ? timestamp : null,
          typeof uuid === 'string' ? uuid : `line-${lineIndex}`
        )
      )
      if (activity.length > SUBAGENT_ACTIVITY_MAX_ITEMS) {
        activity.splice(0, activity.length - SUBAGENT_ACTIVITY_MAX_ITEMS)
      }
    }
    const handbackText = handbackMessage(content)
    if (handbackText !== null) {
      handback = { message: handbackText, at: typeof timestamp === 'string' ? timestamp : null }
    }
    failed = field(row, 'isApiErrorMessage') === true
    if (!failed) {
      turnTexts.push(...textOf(content))
    }
    lastStopReason = field(message, 'stop_reason') ?? lastStopReason
    lastAssistantAt = typeof timestamp === 'string' ? timestamp : lastAssistantAt
    userAfterAssistant = false
  }
  // Why: a handback ends the subagent even though its tool result arrives as a later user row.
  if (handback && !failed) {
    return {
      prompt,
      result: handback.message,
      finished: true,
      failed: false,
      finishedAt: handback.at,
      activity
    }
  }
  const finished = !failed && lastStopReason === 'end_turn' && !userAfterAssistant
  return {
    prompt,
    result: turnTexts.length > 0 ? turnTexts.join('\n\n') : null,
    finished,
    failed,
    finishedAt: finished ? lastAssistantAt : null,
    activity
  }
}
