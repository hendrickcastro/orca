import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import type { TerminalTab } from '../../../../../shared/terminal-tab-types'

type LiveSessionInputs = {
  agentStatusByPaneKey: Record<string, AgentStatusEntry>
  tabsByWorktree: Record<string, TerminalTab[]>
}

export type LiveAgentSessionRefs = {
  sessionIds: ReadonlySet<string>
  transcriptPaths: ReadonlySet<string>
}

function comparablePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

/** Claude sessions running in this workspace's terminals, as a stable string so a store
 *  selector can compare it by value. Lines are `<session id>\t<transcript path>`. */
export function selectWorkspaceLiveClaudeSessionsKey(
  state: LiveSessionInputs,
  workspaceId: string | null
): string {
  if (!workspaceId) {
    return ''
  }
  const tabIds = new Set((state.tabsByWorktree[workspaceId] ?? []).map((tab) => tab.id))
  const lines = new Set<string>()
  for (const entry of Object.values(state.agentStatusByPaneKey)) {
    const owned = entry.worktreeId === workspaceId || (entry.tabId && tabIds.has(entry.tabId))
    if (!owned || entry.agentType !== 'claude' || !entry.providerSession?.id) {
      continue
    }
    lines.add(`${entry.providerSession.id}\t${entry.providerSession.transcriptPath ?? ''}`)
  }
  return [...lines].sort().join('\n')
}

export function parseLiveAgentSessionsKey(key: string): LiveAgentSessionRefs {
  const sessionIds = new Set<string>()
  const transcriptPaths = new Set<string>()
  for (const line of key ? key.split('\n') : []) {
    const [id, path] = line.split('\t')
    if (id) {
      sessionIds.add(id)
    }
    if (path) {
      transcriptPaths.add(comparablePath(path))
    }
  }
  return { sessionIds, transcriptPaths }
}

/** A terminal of the workspace launched this session, even when Claude works in another folder. */
export function isLiveWorkspaceSession(
  session: Pick<AiVaultSession, 'sessionId' | 'filePath'>,
  live: LiveAgentSessionRefs
): boolean {
  return (
    live.sessionIds.has(session.sessionId) ||
    live.transcriptPaths.has(comparablePath(session.filePath))
  )
}
