import { useMemo, useRef } from 'react'
import type React from 'react'
import { Maximize2, Minimize2, SquareArrowOutUpRight, X } from 'lucide-react'
import { AgentStateDot } from '@/components/AgentStateDot'
import { AgentTerminalPreview } from '@/components/dashboard/terminal-preview/AgentTerminalPreview'
import DashboardAgentRow from '@/components/dashboard/DashboardAgentRow'
import type { DashboardAgentRow as DashboardAgentRowData } from '@/components/dashboard/rows/dashboard-agent-row'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import { activateTabAndFocusPane } from '@/lib/workspace/tabs/activate-tab-and-focus-pane'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { agentRowDisplayDotState } from '@/lib/agent-status/presentation/agent-row-dot-state'
import { getAgentRowPrimaryText } from '../../../../../shared/agent-status/presentation/agent-row-primary-text'
import { agentTypeToIconAgent } from '../../../../../shared/agent-status/presentation/agent-type-icon-agent'
import { formatAgentTypeLabel } from '../../../../../shared/agent-status/presentation/agent-type-label'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { useNow } from '@/hooks/use-now'
import { useAppStore } from '@/store'
import { parsePaneKey } from '../../../../../shared/workspace-layout/stable-pane-id'
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
  onRemove?: () => void
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
        {onRemove ? (
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
        ) : null}
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
  row: DashboardAgentRowData
  ptyId: string
  placement: PanePlacement
  onRemove?: () => void
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
            onClick={() => revealPinnedAgent(entry.id, row)}
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

/**
 * An agent without a terminal (a native chat session): its latest request, reply and step, with a
 * way into the chat. Why not an empty pane: these agents work like any other and must be seen.
 */
export function PinnedAgentsWorkbenchActivityPane({
  entry,
  row,
  placement
}: {
  entry: PinnedWorkspaceEntry
  row: DashboardAgentRowData
  placement: PanePlacement
}): React.JSX.Element {
  const now = useNow(30_000)
  const openLabel = translate('pinnedAgentsPanel.workbench.openChat', 'Open the chat')
  const reply = row.entry.lastAssistantMessage?.trim()
  return (
    <PaneFrame
      entry={entry}
      placement={placement}
      title={
        <>
          <span className="inline-flex shrink-0">
            <AgentIcon agent={agentTypeToIconAgent(row.agentType)} size={13} />
          </span>
          <AgentStateDot state={agentRowDisplayDotState(row)} size="sm" />
          <span className="min-w-0 flex-1 truncate">
            {formatAgentTypeLabel(row.agentType)}
            {getAgentRowPrimaryText(row.entry) ? ` · ${getAgentRowPrimaryText(row.entry)}` : ''}
          </span>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <DashboardAgentRow
          agent={row}
          now={now}
          onActivate={() => revealPinnedAgent(entry.id, row)}
          onDismiss={() => undefined}
          hideExpand
        />
        {reply ? (
          <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-md border border-border px-2 py-1.5 text-xs leading-5 text-foreground">
            {reply}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            {translate('pinnedAgentsPanel.workbench.noReplyYet', 'No reply yet')}
          </div>
        )}
        <div className="flex shrink-0 justify-end">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => revealPinnedAgent(entry.id, row)}
          >
            <SquareArrowOutUpRight className="size-3" />
            {openLabel}
          </Button>
        </div>
      </div>
    </PaneFrame>
  )
}

/** Opens the agent where it lives: its terminal pane, or its chat tab when it has no terminal. */
function revealPinnedAgent(workspaceId: string, row: DashboardAgentRowData): void {
  activateAndRevealWorktree(workspaceId)
  const parsed = parsePaneKey(row.activationPaneKey ?? row.paneKey)
  const tabId = parsed?.tabId ?? row.tab.id
  const hasTerminalTab = (useAppStore.getState().tabsByWorktree[workspaceId] ?? []).some(
    (tab) => tab.id === tabId
  )
  if (parsed && hasTerminalTab) {
    activateTabAndFocusPane(parsed.tabId, parsed.leafId, { flashFocusedPane: true })
    return
  }
  activateStructuredAgentSessionTab({ worktreeId: workspaceId, tabId })
}
