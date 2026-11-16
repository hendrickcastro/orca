import { useCallback, useMemo, useState } from 'react'
import type React from 'react'
import { Pin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store'
import { selectAgentRowPtyId } from './agent-row-live-terminal'
import type { PinnedAgentsPanelItem } from './pinned-agents-panel-selection'
import {
  PinnedAgentsWorkbenchActivityPane,
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
import { flattenPinnedWorkspaces, usePinnedLiveAgentRows } from './pinned-live-agents'
import { PinnedIdleWorkspaceChip } from './PinnedIdleWorkspaceChip'
import { usePinnedAgentsPanel } from './use-pinned-agents-panel'

/** One pane per live agent of a pinned workspace: its terminal, or its activity when it has none. */
function WorkspaceAgentPanes({
  item,
  expandedPaneKey,
  onToggleExpand
}: {
  item: PinnedAgentsPanelItem
  expandedPaneKey: string | null
  onToggleExpand: (paneKey: string) => void
}): React.JSX.Element | null {
  const rows = usePinnedLiveAgentRows(item.entry.id)
  const ptyIdsByTabId = useAppStore((s) => s.ptyIdsByTabId)
  const terminalLayoutsByTabId = useAppStore((s) => s.terminalLayoutsByTabId)
  const panes = useMemo(() => {
    const seenPtys = new Set<string>()
    return rows.flatMap((row) => {
      const ptyId = selectAgentRowPtyId({ ptyIdsByTabId, terminalLayoutsByTabId }, row)
      if (ptyId && seenPtys.has(ptyId)) {
        return []
      }
      if (ptyId) {
        seenPtys.add(ptyId)
      }
      return [{ row, ptyId, key: ptyId ?? row.paneKey }]
    })
  }, [rows, ptyIdsByTabId, terminalLayoutsByTabId])
  if (panes.length === 0) {
    return null
  }
  const placementFor = (paneKey: string): PanePlacement => ({
    paneKey,
    expanded: expandedPaneKey === paneKey,
    hidden: expandedPaneKey !== null && expandedPaneKey !== paneKey,
    onToggleExpand
  })
  return (
    <>
      {panes.map((pane) =>
        pane.ptyId ? (
          <PinnedAgentsWorkbenchPane
            key={pane.key}
            entry={item.entry}
            row={pane.row}
            ptyId={pane.ptyId}
            placement={placementFor(pane.key)}
          />
        ) : (
          <PinnedAgentsWorkbenchActivityPane
            key={pane.key}
            entry={item.entry}
            row={pane.row}
            placement={placementFor(pane.key)}
          />
        )
      )}
    </>
  )
}

/**
 * The centre view: every live agent of every pinned workspace, from any project, side by side.
 * Why automatic: a hand-picked list showed empty panes for idle workspaces and missed agents
 * that started elsewhere; pinning is already the user's statement of what to watch.
 */
export default function PinnedAgentsWorkbench(): React.JSX.Element {
  const { catalog } = usePinnedAgentsPanel()
  const items = useMemo(() => flattenPinnedWorkspaces(catalog), [catalog])
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
              'pinnedAgentsPanel.workbench.liveSubtitle',
              'The agents working in your pinned workspaces, from any project'
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
            {translate('pinnedAgentsPanel.workbench.noPinnedTitle', 'Nothing pinned yet')}
          </div>
          <div className="mt-2 max-w-[22rem] text-xs leading-5 text-muted-foreground">
            {translate(
              'pinnedAgentsPanel.workbench.noPinnedCopy',
              'Pin workspaces or multi-repository tasks in the sidebar. Their agents appear here as soon as they start working.'
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            data-pinned-agents-grid=""
            className={cn(
              'scrollbar-sleek grid min-h-0 flex-1 gap-2 overflow-y-auto p-2',
              // Why: an expanded pane owns the whole grid, so the shaped placement must not apply to it.
              expandedPaneKey === null && pinnedAgentsWorkbenchGridClassName(arrangement),
              // Why: with no live agent the grid is empty; the message below takes its place.
              'empty:hidden'
            )}
            style={gridStyle}
          >
            {items.map((item) => (
              <WorkspaceAgentPanes
                key={item.entry.id}
                item={item}
                expandedPaneKey={expandedPaneKey}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
          <div className="hidden flex-1 flex-col items-center justify-center px-6 text-center [[data-pinned-agents-grid]:empty+&]:flex">
            <div className="text-sm font-medium text-foreground">
              {translate(
                'pinnedAgentsPanel.workbench.noLiveTitle',
                'No agent is working right now'
              )}
            </div>
            <div className="mt-2 max-w-[22rem] text-xs leading-5 text-muted-foreground">
              {translate(
                'pinnedAgentsPanel.workbench.noLiveCopy',
                'When an agent starts in one of your pinned workspaces, its terminal or chat appears here.'
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border px-3 py-2 empty:hidden [&:not(:has(button))]:hidden">
            <span className="text-[11px] text-muted-foreground">
              {translate('pinnedAgentsPanel.workbench.idleLabel', 'No agents:')}
            </span>
            {items.map((item) => (
              <PinnedIdleWorkspaceChip key={item.entry.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
