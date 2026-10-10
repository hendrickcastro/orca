import type { AppState } from '@/store/types'
import { resolveWorktreeStatus, type WorktreeStatus } from '@/lib/worktree-status'
import { EMPTY_BROWSER_TABS, EMPTY_TABS } from './WorktreeCardHelpers'
import {
  selectLivePtyIdsForWorktree,
  selectRuntimePaneTitlesForWorktree,
  selectTerminalLayoutRootsForWorktree
} from './worktree-card-status-inputs'
import { selectWorktreeAgentActivitySummary } from './worktree-agent-activity-summary'

/** One-read twin of useWorktreeActivityStatus, for a status the card needs only sometimes. */
export function selectWorktreeActivityStatus(state: AppState, worktreeId: string): WorktreeStatus {
  const summary = selectWorktreeAgentActivitySummary(state, worktreeId)
  return resolveWorktreeStatus({
    tabs: state.tabsByWorktree[worktreeId] ?? EMPTY_TABS,
    browserTabs: state.browserTabsByWorktree[worktreeId] ?? EMPTY_BROWSER_TABS,
    ptyIdsByTabId: selectLivePtyIdsForWorktree(state, worktreeId),
    runtimePaneTitlesByTabId: selectRuntimePaneTitlesForWorktree(state, worktreeId),
    agentStatusPaneIdsByTabId: summary.agentStatusPaneIdsByTabId,
    stalePaneIdsByTabId: summary.stalePaneIdsByTabId,
    terminalLayoutRootsByTabId: selectTerminalLayoutRootsForWorktree(state, worktreeId),
    hasPermission: summary.hasPermission,
    hasLiveWorking: summary.hasLiveWorking,
    hasLiveMonitoring: summary.hasLiveMonitoring,
    hasFailed: summary.hasFailed,
    hasInterrupted: summary.hasInterrupted,
    hasUnconfirmed: summary.hasUnconfirmed,
    hasLiveDone: summary.hasLiveDone,
    hasRetainedDone: summary.hasRetainedDone,
    hasRetainedFailed: summary.hasRetainedFailed
  })
}
