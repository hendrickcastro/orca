import type { AgentDotState } from '@/components/AgentStateDot'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import type { SubagentResultSummary } from '../../../../../shared/subagent-results-types'

/** The dot a subagent row shows. A transcript that ended its last turn is done even when Claude
 *  wrote no task notification for it (foreground subagents never get one). */
export function subagentRowDotState(
  session: Pick<AiVaultSession, 'subagent'>,
  summary: SubagentResultSummary | undefined
): AgentDotState | null {
  const status = session.subagent?.status ?? null
  if (status === 'failed' || summary?.failed) {
    return 'failed'
  }
  if (status === 'stopped') {
    return 'interrupted'
  }
  if (summary?.finished || status === 'completed') {
    return 'done'
  }
  return status === 'running' ? 'working' : null
}

/** Launch order, so the list reads like the parent's plan. */
export function sortSubagentsByLaunch<T extends Pick<AiVaultSession, 'createdAt' | 'modifiedAt'>>(
  sessions: readonly T[]
): T[] {
  const startedAt = (session: T): string => session.createdAt ?? session.modifiedAt
  return [...sessions].sort((a, b) => startedAt(a).localeCompare(startedAt(b)))
}

type RowSummaries = ReadonlyMap<string, SubagentResultSummary>

function isWorking(
  session: Pick<AiVaultSession, 'subagent' | 'filePath'>,
  summaries: RowSummaries
) {
  return subagentRowDotState(session, summaries.get(session.filePath)) === 'working'
}

/** Working subagents first, each part keeping launch order. */
export function orderSubagentRows<T extends Pick<AiVaultSession, 'subagent' | 'filePath'>>(
  subagents: readonly T[],
  summaries: RowSummaries
): T[] {
  const working = subagents.filter((subagent) => isWorking(subagent, summaries))
  return [...working, ...subagents.filter((subagent) => !working.includes(subagent))]
}

/** Sessions with a working subagent first, each part keeping its recency order. */
export function orderSessionsByLiveWork<T extends Pick<AiVaultSession, 'id'>>(
  sessions: readonly T[],
  rowsBySession: ReadonlyMap<
    string,
    {
      subagents: readonly Pick<AiVaultSession, 'subagent' | 'filePath'>[]
      summaryByPath: RowSummaries
    }
  >
): T[] {
  const hasWorking = (session: T): boolean => {
    const rows = rowsBySession.get(session.id)
    return Boolean(rows?.subagents.some((subagent) => isWorking(subagent, rows.summaryByPath)))
  }
  const working = sessions.filter(hasWorking)
  return [...working, ...sessions.filter((session) => !working.includes(session))]
}
