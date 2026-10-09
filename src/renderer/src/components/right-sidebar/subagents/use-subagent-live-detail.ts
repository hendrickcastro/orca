import { useEffect, useState } from 'react'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import type { SubagentResultDetail } from '../../../../../shared/subagent-results-types'
import { withSubagentActivity } from './subagent-result-document'

type LiveDetail = {
  status: 'loading' | 'loaded' | 'error'
  detail: SubagentResultDetail | null
}

/** A subagent's assignment and recent activity, re-read whenever `refreshKey` moves while shown. */
export function useSubagentLiveDetail(
  subagent: Pick<AiVaultSession, 'filePath' | 'executionHostId'>,
  enabled: boolean,
  refreshKey: string
): LiveDetail {
  const [state, setState] = useState<LiveDetail>({ status: 'loading', detail: null })

  useEffect(() => {
    if (!enabled) {
      return
    }
    let cancelled = false
    window.api.subagentResults
      .read({ filePath: subagent.filePath, executionHostId: subagent.executionHostId })
      .then((read) => {
        if (cancelled) {
          return
        }
        setState((previous) =>
          read.ok
            ? { status: 'loaded', detail: withSubagentActivity(read.detail) }
            : // Why: a transient read failure keeps the activity already shown.
              { status: previous.detail ? 'loaded' : 'error', detail: previous.detail }
        )
      })
      .catch(() => {
        if (!cancelled) {
          setState((previous) => ({ ...previous, status: previous.detail ? 'loaded' : 'error' }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [subagent.filePath, subagent.executionHostId, enabled, refreshKey])

  return state
}
