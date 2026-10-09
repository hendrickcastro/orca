import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import {
  useActiveWorktree,
  useActiveWorktreeId,
  useAllWorktrees,
  useRepoById
} from '@/store/selectors'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { filterAiVaultSessions } from '../../../../../shared/ai-vault-session-filters'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../shared/execution-host'
import { resolveAiVaultPanelSessionListRequest } from '../ai-vault-panel-session-list-request'
import { claimAiVaultForcedRescan } from '../ai-vault-session-refresh'
import {
  aiVaultSessionListArgs,
  readCachedAiVaultSessionList
} from '../ai-vault-session-list-request'
import { deriveAiVaultWorkspaceScopePaths } from '../ai-vault-scope-paths'
import {
  isLiveWorkspaceSession,
  parseLiveAgentSessionsKey,
  selectWorkspaceLiveClaudeSessionsKey,
  type LiveAgentSessionRefs
} from './workspace-live-agent-sessions'

const SESSIONS_SHOWN_MAX = 20

export type WorkspaceSubagentSessions = {
  workspaceId: string | null
  /** Subagent transcripts live on the execution host; only local ones can be read today. */
  remote: boolean
  status: 'loading' | 'loaded' | 'error'
  /** Claude sessions of this workspace that launched subagents, newest first. */
  sessions: AiVaultSession[]
}

function sessionsWithSubagents(
  sessions: readonly AiVaultSession[],
  scopePaths: readonly string[],
  live: LiveAgentSessionRefs
): AiVaultSession[] {
  const inWorkspaceFolder = new Set(
    filterAiVaultSessions(sessions, {
      query: '',
      agents: ['claude'],
      scope: 'workspace',
      sort: 'updated',
      activeWorktreePaths: scopePaths,
      hideEmptySessions: false
    }).map((session) => session.id)
  )
  return sessions
    .filter(
      (session) =>
        session.agent === 'claude' &&
        session.executionHostId === LOCAL_EXECUTION_HOST_ID &&
        session.subagentTranscriptCount > 0 &&
        !session.subagent &&
        // Why: a terminal of this workspace may run Claude in another folder; it still owns the task.
        (inWorkspaceFolder.has(session.id) || isLiveWorkspaceSession(session, live))
    )
    .sort((a, b) => (b.updatedAt ?? b.modifiedAt).localeCompare(a.updatedAt ?? a.modifiedAt))
    .slice(0, SESSIONS_SHOWN_MAX)
}

/** The active workspace's sessions that launched subagents, read through Session History's
 *  shared list so the two panels never scan twice. */
export function useWorkspaceSubagentSessions(
  refreshKey: string,
  manualRefresh: number
): WorkspaceSubagentSessions {
  const workspaceId = useActiveWorktreeId() ?? null
  const worktree = useActiveWorktree()
  const allWorktrees = useAllWorktrees()
  const repo = useRepoById(worktree?.repoId ?? null)
  const remote = Boolean(repo?.connectionId)
  const liveSessionsKey = useAppStore((s) => selectWorkspaceLiveClaudeSessionsKey(s, workspaceId))
  const scopePathsKey = useMemo(
    () => deriveAiVaultWorkspaceScopePaths(worktree ?? null, allWorktrees).join('\n'),
    [worktree, allWorktrees]
  )
  const [state, setState] = useState<
    Pick<WorkspaceSubagentSessions, 'status' | 'sessions'> & { forWorkspace: string | null }
  >({ status: 'loading', sessions: [], forWorkspace: null })
  // Why: an explicit refresh forces one rescan; later ticks must not keep spending the shared budget.
  const forcedRefresh = useRef(0)

  useEffect(() => {
    if (!workspaceId || remote || !scopePathsKey) {
      setState({ status: 'loaded', sessions: [], forWorkspace: workspaceId })
      return
    }
    let cancelled = false
    const scopePaths = scopePathsKey.split('\n')
    const live = parseLiveAgentSessionsKey(liveSessionsKey)
    const request = resolveAiVaultPanelSessionListRequest(useAppStore.getState(), workspaceId)
    const cached = readCachedAiVaultSessionList(request)
    setState((previous) => {
      if (cached) {
        return {
          status: 'loaded',
          sessions: sessionsWithSubagents(cached.sessions, scopePaths, live),
          forWorkspace: workspaceId
        }
      }
      // Why: another workspace's rows must never stand in for this one's while it loads.
      return previous.forWorkspace === workspaceId && previous.status !== 'error'
        ? previous
        : { status: 'loading', sessions: [], forWorkspace: workspaceId }
    })
    const force = manualRefresh > forcedRefresh.current && claimAiVaultForcedRescan()
    forcedRefresh.current = manualRefresh
    window.api.aiVault
      .listSessions(
        aiVaultSessionListArgs(request, {
          requestToken: createBrowserUuid(),
          force
        })
      )
      .then((result) => {
        if (!cancelled && !result.cancelled) {
          setState({
            status: 'loaded',
            sessions: sessionsWithSubagents(result.sessions, scopePaths, live),
            forWorkspace: workspaceId
          })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState((previous) => ({ ...previous, status: 'error' }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, remote, scopePathsKey, liveSessionsKey, refreshKey, manualRefresh])

  return { workspaceId, remote, status: state.status, sessions: state.sessions }
}
