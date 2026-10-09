import { useEffect, useRef, useState } from 'react'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import type { SubagentResultSummary } from '../../../../../shared/subagent-results-types'
import { mapWithConcurrency } from '../../../../../shared/map-with-concurrency'
import { sortSubagentsByLaunch } from './subagent-row-state'

const SESSION_READ_CONCURRENCY = 2

export type SessionSubagents = {
  status: 'loading' | 'loaded' | 'error'
  subagents: AiVaultSession[]
  summaryByPath: ReadonlyMap<string, SubagentResultSummary>
}

const NO_SUMMARIES: ReadonlyMap<string, SubagentResultSummary> = new Map()
export const LOADING_SESSION_SUBAGENTS: SessionSubagents = {
  status: 'loading',
  subagents: [],
  summaryByPath: NO_SUMMARIES
}

async function readSummaries(
  subagents: readonly AiVaultSession[],
  executionHostId: AiVaultSession['executionHostId']
): Promise<ReadonlyMap<string, SubagentResultSummary>> {
  if (subagents.length === 0) {
    return NO_SUMMARIES
  }
  try {
    const { summaries } = await window.api.subagentResults.summaries({
      filePaths: subagents.map((subagent) => subagent.filePath),
      executionHostId
    })
    return new Map(summaries.map((summary) => [summary.filePath, summary]))
  } catch {
    // Why: hosts without the summaries bridge still list subagents, just without previews.
    return NO_SUMMARIES
  }
}

async function readSessionSubagents(session: AiVaultSession): Promise<SessionSubagents> {
  try {
    const result = await window.api.aiVault.listSubagentSessions({
      agent: session.agent,
      parentFilePath: session.filePath,
      executionHostId: session.executionHostId
    })
    const subagents = sortSubagentsByLaunch(result.sessions)
    return {
      status: 'loaded',
      subagents,
      summaryByPath: await readSummaries(subagents, session.executionHostId)
    }
  } catch {
    return { ...LOADING_SESSION_SUBAGENTS, status: 'error' }
  }
}

/** Every listed session's subagents with answer previews, keyed by session id; re-read whenever
 *  `refreshKey` moves. Loaded together so the panel can order sessions by live work. */
export function useSessionsSubagents(
  sessions: readonly AiVaultSession[],
  refreshKey: string
): ReadonlyMap<string, SessionSubagents> {
  const [bySession, setBySession] = useState<ReadonlyMap<string, SessionSubagents>>(new Map())
  const sessionsKey = sessions
    .map((session) => `${session.id}\t${session.filePath}\t${session.executionHostId}`)
    .join('\n')
  const currentKey = useRef(sessionsKey)
  currentKey.current = sessionsKey
  // Why: a tick must not cancel a slow round, or a large workspace would never finish loading.
  const roundInFlight = useRef<string | null>(null)

  useEffect(() => {
    if (roundInFlight.current === sessionsKey) {
      return
    }
    roundInFlight.current = sessionsKey
    // Why: AI Vault's service holds 16 pending calls; a burst per session fills it for every panel.
    void mapWithConcurrency(
      sessions,
      SESSION_READ_CONCURRENCY,
      async (session) => [session.id, await readSessionSubagents(session)] as const
    ).then((entries) => {
      if (roundInFlight.current === sessionsKey) {
        roundInFlight.current = null
      }
      if (currentKey.current !== sessionsKey) {
        return
      }
      setBySession((previous) => {
        const next = new Map<string, SessionSubagents>()
        for (const [id, rows] of entries) {
          const kept = previous.get(id)
          // Why: one failed read keeps the rows already shown instead of blanking or reordering them.
          next.set(id, rows.status === 'error' && kept?.status === 'loaded' ? kept : rows)
        }
        return next
      })
    })
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- sessionsKey is the sessions' identity; the objects are rebuilt on every list read.
  }, [sessionsKey, refreshKey])

  return bySession
}
