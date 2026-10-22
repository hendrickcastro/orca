import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { readDashboardClientHost } from '@/components/dashboard/dashboard-client-host'
import {
  resolveDashboardCardTerminalInput,
  type DashboardCardTerminalInputState
} from '@/components/dashboard/dashboard-card-terminal-input'
import type { AppState } from '@/store/types'
import type { DashboardCardTerminalInput } from '../../../../../shared/dashboard-snapshot'
import { parsePaneKey } from '../../../../../shared/stable-pane-id'

type LiveTerminalState = Pick<AppState, 'terminalLayoutsByTabId' | 'ptyIdsByTabId'>

/** The live PTY behind an agent row, when its terminal is still open; the same rule the board uses. */
export function selectAgentRowPtyId(
  state: LiveTerminalState,
  row: DashboardAgentRow
): string | null {
  if (row.rowSource === 'retained') {
    return null
  }
  const parsed = parsePaneKey(row.activationPaneKey ?? row.paneKey)
  const tabId = parsed?.tabId ?? row.tab.id
  const leafId = parsed?.leafId ?? null
  const layoutPtyId =
    (leafId ? state.terminalLayoutsByTabId[tabId]?.ptyIdsByLeafId?.[leafId] : undefined) ?? null
  return layoutPtyId && (state.ptyIdsByTabId[tabId] ?? []).includes(layoutPtyId)
    ? layoutPtyId
    : null
}

export function resolveAgentRowTerminalInput(
  state: Partial<DashboardCardTerminalInputState>,
  args: { ptyId: string; worktreeId: string; workspacePath: string; row: DashboardAgentRow }
): DashboardCardTerminalInput {
  const client = readDashboardClientHost()
  return resolveDashboardCardTerminalInput(state, {
    ptyId: args.ptyId,
    worktreeId: args.worktreeId,
    paneKey: args.row.activationPaneKey ?? args.row.paneKey,
    cwd: args.row.tab.startupCwd ?? args.workspacePath,
    shellOverride: args.row.tab.shellOverride,
    launchAgent: args.row.tab.launchAgent,
    clientPlatform: client.platform,
    userAgent: client.userAgent,
    osRelease: client.osRelease
  })
}
