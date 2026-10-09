import { useAppStore } from '@/store'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import type { AgentStatusEntry } from '../../../../../shared/agent-status-types'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import { parsePaneKey } from '../../../../../shared/stable-pane-id'
import type { TerminalTab } from '../../../../../shared/terminal-tab-types'
import { isLiveWorkspaceSession, parseLiveAgentSessionsKey } from './workspace-live-agent-sessions'

export type SessionPane = {
  worktreeId: string
  tabId: string
  leafId: string
  paneKey: string
}

type PaneInputs = {
  agentStatusByPaneKey: Record<string, AgentStatusEntry>
  tabsByWorktree: Record<string, TerminalTab[]>
}

/** The terminal pane where a Claude session runs, when Orca still tracks one. */
export function findSessionPane(
  state: PaneInputs,
  session: Pick<AiVaultSession, 'sessionId' | 'filePath'>
): SessionPane | null {
  for (const [paneKey, entry] of Object.entries(state.agentStatusByPaneKey)) {
    const provider = entry.providerSession
    if (entry.agentType !== 'claude' || !provider?.id) {
      continue
    }
    const live = parseLiveAgentSessionsKey(`${provider.id}\t${provider.transcriptPath ?? ''}`)
    const parsed = parsePaneKey(paneKey)
    if (!parsed || !isLiveWorkspaceSession(session, live)) {
      continue
    }
    const worktreeId =
      entry.worktreeId ??
      Object.entries(state.tabsByWorktree).find(([, tabs]) =>
        tabs.some((tab) => tab.id === parsed.tabId)
      )?.[0]
    if (worktreeId) {
      return { worktreeId, tabId: parsed.tabId, leafId: parsed.leafId, paneKey }
    }
  }
  return null
}

/** Switches to the session's workspace and focuses its terminal; false when none is tracked. */
export function revealSessionPane(
  session: Pick<AiVaultSession, 'sessionId' | 'filePath'>
): boolean {
  const pane = findSessionPane(useAppStore.getState(), session)
  if (!pane) {
    return false
  }
  if (activateAndRevealWorktree(pane.worktreeId) === false) {
    return false
  }
  const tabs = useAppStore.getState().tabsByWorktree[pane.worktreeId] ?? []
  if (tabs.some((tab) => tab.id === pane.tabId)) {
    activateTabAndFocusPane(pane.tabId, pane.leafId, {
      flashFocusedPane: true,
      scrollToBottomIfOutputSinceLastView: true
    })
    return true
  }
  return activateStructuredAgentSessionTab({ worktreeId: pane.worktreeId, tabId: pane.tabId })
}
