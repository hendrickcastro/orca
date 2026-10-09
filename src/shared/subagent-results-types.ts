import type { ExecutionHostId } from './execution-host'

/** Most transcripts one summaries request may name; the panel asks per visible session. */
export const SUBAGENT_RESULT_SUMMARIES_MAX_PATHS = 64
/** Characters of the final answer a list row previews. */
export const SUBAGENT_RESULT_PREVIEW_MAX_LENGTH = 240
/** Largest rendered result document main will write. */
export const SUBAGENT_RESULT_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024

export type SubagentResultTarget = {
  /** A Claude subagent transcript: `<session>/subagents/agent-<id>.jsonl`. */
  filePath: string
  executionHostId?: ExecutionHostId
}

export type SubagentResultSummary = {
  filePath: string
  /** The subagent's last turn ended with a final answer and nothing came after it. */
  finished: boolean
  /** The last turn ended on an API error instead of an answer. */
  failed?: boolean
  /** Start of the final answer; absent while it has written no text. */
  preview?: string
  finishedAt?: string
}

export type SubagentResultSummariesArgs = {
  filePaths: string[]
  executionHostId?: ExecutionHostId
}

export type SubagentResultSummariesResult = {
  summaries: SubagentResultSummary[]
}

export type SubagentResultDetail = {
  /** The task the parent agent handed to the subagent. */
  prompt: string | null
  /** The subagent's final answer, or its latest text while it is still working. */
  result: string | null
  finished: boolean
  failed: boolean
  finishedAt: string | null
  description: string | null
  agentType: string | null
}

export type SubagentResultReadResult =
  | { ok: true; detail: SubagentResultDetail }
  | { ok: false; reason: 'unavailable' | 'unreadable' }

export type SubagentResultDocumentArgs = SubagentResultTarget & { markdown: string }

export type SubagentResultDocumentResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'unavailable' | 'too-large' | 'write-failed' }
