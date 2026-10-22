import { useMemo, useRef } from 'react'
import type React from 'react'
import { Maximize2, Minimize2, SquareArrowOutUpRight, X } from 'lucide-react'
import { AgentStateDot } from '@/components/AgentStateDot'
import { AgentTerminalPreview } from '@/components/dashboard-popout/AgentTerminalPreview'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentRowDisplayDotState } from '@/lib/agent-row-dot-state'
import { getAgentRowPrimaryText } from '@/lib/agent-row-primary-text'
import { agentTypeToIconAgent, formatAgentTypeLabel } from '@/lib/agent-status'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../../shared/stable-pane-id'
import { resolveAgentRowTerminalInput } from './agent-row-live-terminal'
import { PINNED_AGENTS_ZOOM_SCOPE_ATTR, usePinnedAgentsPaneZoom } from './pinned-agents-pane-zoom'
import type { PinnedWorkspaceEntry } from './pinned-workspaces-catalog'

/** How one pane sits in the grid: expanded fills the area alone, hidden stays mounted so its terminal keeps streaming. */
export type PanePlacement = {
  paneKey: string
  expanded: boolean
  hidden: boolean
  onToggleExpand: (paneKey: string) => void
}

function PaneFrame({
  entry,
  title,
  placement,
  onRemove,
  children
}: {
  entry: PinnedWorkspaceEntry
  title: React.ReactNode
  placement: PanePlacement
  onRemove: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const openLabel = translate('pinnedAgentsPanel.workbench.openWorkspace', 'Open its workspace')
  const removeLabel = translate('pinnedAgentsPanel.card.remove', 'Remove from this panel')
  const expandLabel = placement.expanded
    ? translate('pinnedAgentsPanel.workbench.restorePane', 'Back to the grid')
    : translate('pinnedAgentsPanel.workbench.expandPane', 'Expand this pane')
  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border bg-background',
        placement.hidden && 'hidden'
      )}
      data-pinned-agents-pane={entry.id}
      data-pinned-agents-pane-expanded={placement.expanded || undefined}
    >
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-foreground">
            {title}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {entry.projectName} · {entry.name}
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={expandLabel}
              aria-pressed={placement.expanded}
              onClick={() => placement.onToggleExpand(placement.paneKey)}
            >
              {placement.expanded ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{expandLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={openLabel}
              onClick={() => activateAndRevealWorktree(entry.id)}
            >
              <SquareArrowOutUpRight className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{openLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={removeLabel}
              onClick={onRemove}
            >
              <X className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{removeLabel}</TooltipContent>
        </Tooltip>
      </div>
      {children}
    </section>
  )
}

/** One agent's live terminal, big enough to read, with a header that says whose it is. */
export function PinnedAgentsWorkbenchPane({
  entry,
  row,
  ptyId,
  placement,
  onRemove
}: {
  entry: PinnedWorkspaceEntry
  row: DashboardAgentRow
  ptyId: string
  placement: PanePlacement
  onRemove: () => void
}): React.JSX.Element {
  // Why once per pty: host facts decide key encodings and do not change while the pane lives.
  const terminalInput = useMemo(
    () =>
      resolveAgentRowTerminalInput(useAppStore.getState(), {
        ptyId,
        worktreeId: entry.id,
        workspacePath: entry.path,
        row
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ptyId, entry.id, entry.path]
  )
  const focusLabel = translate('pinnedAgentsPanel.workbench.focusAgent', 'Go to this agent')
  const parsed = parsePaneKey(row.activationPaneKey ?? row.paneKey)
  const zoomScopeRef = useRef<HTMLDivElement | null>(null)
  const baseFontSize = useAppStore((s) => s.settings?.terminalFontSize ?? 14)
  const zoom = usePinnedAgentsPaneZoom(zoomScopeRef, baseFontSize)
  const zoomHint = translate(
    'pinnedAgentsPanel.workbench.zoomHint',
    'Cmd/Ctrl and + or - zoom only this pane while its terminal has focus'
  )
  return (
    <PaneFrame
      entry={entry}
      placement={placement}
      onRemove={onRemove}
      title={
        <>
          <span className="inline-flex shrink-0">
            <AgentIcon agent={agentTypeToIconAgent(row.agentType)} size={13} />
          </span>
          <AgentStateDot state={agentRowDisplayDotState(row)} size="sm" />
          <button
            type="button"
            title={focusLabel}
            className="min-w-0 flex-1 truncate text-left hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={() => {
              activateAndRevealWorktree(entry.id)
              if (parsed) {
                activateTabAndFocusPane(parsed.tabId, parsed.leafId, { flashFocusedPane: true })
              }
            }}
          >
            {formatAgentTypeLabel(row.agentType)}
            {getAgentRowPrimaryText(row.entry) ? ` · ${getAgentRowPrimaryText(row.entry)}` : ''}
          </button>
          {zoom.percent !== null ? (
            <span
              className="shrink-0 rounded-sm border border-border px-1 text-[10px] tabular-nums text-muted-foreground"
              title={zoomHint}
            >
              {zoom.percent}%
            </span>
          ) : null}
        </>
      }
    >
      <div
        ref={zoomScopeRef}
        className="flex min-h-0 flex-1 flex-col"
        title={zoomHint}
        {...{ [PINNED_AGENTS_ZOOM_SCOPE_ATTR]: '' }}
        data-pinned-agents-font-size={zoom.fontSize ?? undefined}
      >
        <AgentTerminalPreview
          key={ptyId}
          ptyId={ptyId}
          terminalInput={terminalInput}
          host={{ autoFocus: false, fontSize: zoom.fontSize }}
          className="min-h-0 flex-1"
        />
      </div>
    </PaneFrame>
  )
}

/** A followed workspace with nothing live to show yet keeps its place so the user knows it is listed. */
export function PinnedAgentsWorkbenchIdlePane({
  entry,
  placement,
  onRemove
}: {
  entry: PinnedWorkspaceEntry
  placement: PanePlacement
  onRemove: () => void
}): React.JSX.Element {
  return (
    <PaneFrame
      entry={entry}
      placement={placement}
      onRemove={onRemove}
      title={<span className="truncate">{entry.name}</span>}
    >
      <div className="flex flex-1 items-center justify-center px-6 text-center text-xs leading-5 text-muted-foreground">
        {translate(
          'pinnedAgentsPanel.workbench.noLiveAgents',
          'No agent is running here right now. Start one in this workspace and it will appear in this pane.'
        )}
      </div>
    </PaneFrame>
  )
}
