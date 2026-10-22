import { useCallback, useMemo, useState } from 'react'
import type React from 'react'
import { Pin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorktreeAgentRows } from '@/components/sidebar/useWorktreeAgentRows'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { selectAgentRowPtyId } from './agent-row-live-terminal'
import type { PinnedAgentsPanelItem } from './pinned-agents-panel-selection'
import { PinnedAgentsWorkspacePicker } from './PinnedAgentsWorkspacePicker'
import {
  PinnedAgentsWorkbenchIdlePane,
  PinnedAgentsWorkbenchPane,
  type PanePlacement
} from './PinnedAgentsWorkbenchPane'
import { PinnedAgentsWorkbenchLayoutMenu } from './PinnedAgentsWorkbenchLayoutMenu'
import {
  normalizePinnedAgentsWorkbenchArrangement,
  pinnedAgentsWorkbenchGridClassName,
  normalizePinnedAgentsWorkbenchRowHeight,
  pinnedAgentsWorkbenchGridStyle
} from './pinned-agents-workbench-layout'
import { usePinnedAgentsPanel } from './use-pinned-agents-panel'

type LivePane = { row: DashboardAgentRow; ptyId: string }

/** The panes of one followed workspace: one per agent with a live terminal, else a placeholder. */
function WorkspacePanes({
  item,
  onRemove,
  expandedPaneKey,
  onToggleExpand
}: {
  item: PinnedAgentsPanelItem
  onRemove: (id: string) => void
  expandedPaneKey: string | null
  onToggleExpand: (paneKey: string) => void
}): React.JSX.Element {
  const placementFor = (paneKey: string): PanePlacement => ({
    paneKey,
    expanded: expandedPaneKey === paneKey,
    hidden: expandedPaneKey !== null && expandedPaneKey !== paneKey,
    onToggleExpand
  })
  const rows = useWorktreeAgentRows(item.entry.id)
  const ptyIdsByTabId = useAppStore((s) => s.ptyIdsByTabId)
  const terminalLayoutsByTabId = useAppStore((s) => s.terminalLayoutsByTabId)
  const panes = useMemo<LivePane[]>(() => {
    const seen = new Set<string>()
    const out: LivePane[] = []
    for (const row of rows) {
      const ptyId = selectAgentRowPtyId({ ptyIdsByTabId, terminalLayoutsByTabId }, row)
      if (ptyId && !seen.has(ptyId)) {
        seen.add(ptyId)
        out.push({ row, ptyId })
      }
    }
    return out
  }, [rows, ptyIdsByTabId, terminalLayoutsByTabId])
  if (panes.length === 0) {
    return (
      <PinnedAgentsWorkbenchIdlePane
        entry={item.entry}
        placement={placementFor(item.entry.id)}
        onRemove={() => onRemove(item.entry.id)}
      />
    )
  }
  return (
    <>
      {panes.map((pane) => (
        <PinnedAgentsWorkbenchPane
          key={pane.ptyId}
          entry={item.entry}
          row={pane.row}
          ptyId={pane.ptyId}
          placement={placementFor(pane.ptyId)}
          onRemove={() => onRemove(item.entry.id)}
        />
      ))}
    </>
  )
}

/**
 * The centre-area view: every followed workspace's agents side by side, each in a live terminal
 * big enough to read. Opened by dropping a card from the sidebar's Pinned section on the centre.
 */
export default function PinnedAgentsWorkbench(): React.JSX.Element {
  const { catalog, items, shownIds, toggle, remove } = usePinnedAgentsPanel()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const arrangement = useAppStore((s) =>
    normalizePinnedAgentsWorkbenchArrangement(s.settings?.pinnedAgentsWorkbenchArrangement)
  )
  const rowHeight = useAppStore((s) =>
    normalizePinnedAgentsWorkbenchRowHeight(s.settings?.pinnedAgentsWorkbenchRowHeight)
  )
  // Why local: an expanded pane is a glance, not a layout the next session should reopen in.
  const [expandedPaneKey, setExpandedPaneKey] = useState<string | null>(null)
  const toggleExpand = useCallback(
    (paneKey: string) => setExpandedPaneKey((current) => (current === paneKey ? null : paneKey)),
    []
  )
  const gridStyle = useMemo(
    () =>
      expandedPaneKey
        ? { gridTemplateColumns: 'minmax(0, 1fr)', gridAutoRows: 'minmax(0, 1fr)' }
        : pinnedAgentsWorkbenchGridStyle({ arrangement, rowHeight }),
    [arrangement, rowHeight, expandedPaneKey]
  )
  const closeLabel = translate('pinnedAgentsPanel.workbench.close', 'Back to the workspace')
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
        <Pin className="size-4 shrink-0 text-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {translate('pinnedAgentsPanel.workbench.title', 'Pinned agents')}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {translate(
              'pinnedAgentsPanel.workbench.subtitle',
              'Live terminals of the agents in the workspaces you dropped here, from any project'
            )}
          </div>
        </div>
        <PinnedAgentsWorkbenchLayoutMenu
          arrangement={arrangement}
          rowHeight={rowHeight}
          onChange={(next) =>
            void updateSettings({
              ...(next.arrangement !== undefined
                ? { pinnedAgentsWorkbenchArrangement: next.arrangement }
                : {}),
              ...(next.rowHeight !== undefined
                ? { pinnedAgentsWorkbenchRowHeight: next.rowHeight }
                : {})
            })
          }
        />
        <PinnedAgentsWorkspacePicker catalog={catalog} shownIds={shownIds} onToggle={toggle} />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={closeLabel}
              onClick={() => setActiveView('terminal')}
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{closeLabel}</TooltipContent>
        </Tooltip>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="text-sm font-medium text-foreground">
            {translate('pinnedAgentsPanel.noPinnedTitle', 'Nothing here yet')}
          </div>
          <div className="mt-2 max-w-[22rem] text-xs leading-5 text-muted-foreground">
            {translate(
              'pinnedAgentsPanel.workbench.empty',
              'Drag a workspace or a multi-repository task from the Pinned section of the sidebar and drop it here. Each of its agents gets its own live terminal.'
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'scrollbar-sleek grid min-h-0 flex-1 gap-2 overflow-y-auto p-2',
            // Why: an expanded pane owns the whole grid, so the shaped placement must not apply to it.
            expandedPaneKey === null && pinnedAgentsWorkbenchGridClassName(arrangement)
          )}
          style={gridStyle}
        >
          {items.map((item) => (
            <WorkspacePanes
              key={item.entry.id}
              item={item}
              onRemove={remove}
              expandedPaneKey={expandedPaneKey}
              onToggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}
