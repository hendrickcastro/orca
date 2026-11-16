import { useMemo } from 'react'
import type { DashboardAgentRow } from '@/components/dashboard/rows/dashboard-agent-row'
import { useWorktreeAgentRows } from '@/components/sidebar/workspace-card/activity/useWorktreeAgentRows'
import type { PinnedAgentsPanelItem } from './pinned-agents-panel-selection'
import type { PinnedWorkspaceEntry } from './pinned-workspaces-catalog'

/** An agent worth a pane: not silent, and not a subagent, which belongs to its parent's pane. */
export function isPinnedLiveAgentRow(row: Pick<DashboardAgentRow, 'rowSource' | 'state'>): boolean {
  return row.rowSource !== 'subagent' && row.state !== 'idle'
}

/** Every pinned workspace once, tasks before their repos, in sidebar order. */
export function flattenPinnedWorkspaces(
  catalog: readonly PinnedWorkspaceEntry[]
): PinnedAgentsPanelItem[] {
  const seen = new Set<string>()
  const items: PinnedAgentsPanelItem[] = []
  const add = (entry: PinnedWorkspaceEntry, parent: PinnedWorkspaceEntry | null): void => {
    if (!seen.has(entry.id)) {
      seen.add(entry.id)
      items.push({ entry, parent })
    }
  }
  for (const entry of catalog) {
    add(entry, null)
    for (const member of entry.members) {
      add(member, entry)
    }
  }
  return items
}

const NO_ROWS: DashboardAgentRow[] = []

/** The agents of one pinned workspace that get a pane, in the order the sidebar lists them. */
export function usePinnedLiveAgentRows(workspaceId: string): DashboardAgentRow[] {
  const rows = useWorktreeAgentRows(workspaceId)
  return useMemo(() => {
    const live = rows.filter(isPinnedLiveAgentRow)
    return live.length > 0 ? live : NO_ROWS
  }, [rows])
}
