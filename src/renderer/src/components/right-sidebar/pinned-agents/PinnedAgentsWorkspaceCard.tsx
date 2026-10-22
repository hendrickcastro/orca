import { useId, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { ChevronRight, GripVertical, MonitorPlay, Workflow, X } from 'lucide-react'
import { AgentIcon } from '@/lib/agent-catalog'
import { agentTypeToIconAgent, formatAgentTypeLabel } from '@/lib/agent-status'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentTerminalPreview } from '@/components/dashboard-popout/AgentTerminalPreview'
import StatusIndicator from '@/components/sidebar/StatusIndicator'
import WorktreeCardAgents from '@/components/sidebar/WorktreeCardAgents'
import { useWorktreeAgentRows } from '@/components/sidebar/useWorktreeAgentRows'
import { useWorktreeActivityStatus } from '@/components/sidebar/use-worktree-activity-status'
import { resolveAgentRowTerminalInput, selectAgentRowPtyId } from './agent-row-live-terminal'
import { PINNED_AGENTS_ZOOM_SCOPE_ATTR, usePinnedAgentsPaneZoom } from './pinned-agents-pane-zoom'
import type { PinnedAgentsPanelItem } from './pinned-agents-panel-selection'

type LiveAgentChoice = { paneKey: string; ptyId: string; label: string }

function LiveTerminal({
  worktreeId,
  workspacePath,
  choices,
  rows
}: {
  worktreeId: string
  workspacePath: string
  choices: LiveAgentChoice[]
  rows: ReturnType<typeof useWorktreeAgentRows>
}): React.JSX.Element {
  const [chosenPaneKey, setChosenPaneKey] = useState<string | null>(null)
  const zoomScopeRef = useRef<HTMLDivElement | null>(null)
  const baseFontSize = useAppStore((s) => s.settings?.terminalFontSize ?? 14)
  const zoom = usePinnedAgentsPaneZoom(zoomScopeRef, baseFontSize)
  const choice = choices.find((candidate) => candidate.paneKey === chosenPaneKey) ?? choices[0]
  const row = rows.find((candidate) => candidate.paneKey === choice.paneKey)
  // Why: host facts decide key encodings; read once per pty like the board does for its cards.
  const terminalInput = useMemo(
    () =>
      row
        ? resolveAgentRowTerminalInput(useAppStore.getState(), {
            ptyId: choice.ptyId,
            worktreeId,
            workspacePath,
            row
          })
        : null,
    [choice.ptyId, row, worktreeId, workspacePath]
  )
  return (
    <div className="mt-1.5 space-y-1">
      {choices.length > 1 ? (
        <div className="flex flex-wrap gap-1" role="tablist">
          {choices.map((candidate) => (
            <button
              key={candidate.paneKey}
              type="button"
              role="tab"
              aria-selected={candidate.paneKey === choice.paneKey}
              onClick={() => setChosenPaneKey(candidate.paneKey)}
              className={cn(
                'rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                candidate.paneKey === choice.paneKey && 'bg-accent text-foreground'
              )}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        ref={zoomScopeRef}
        className="h-56 overflow-hidden rounded-md border border-border bg-background"
        {...{ [PINNED_AGENTS_ZOOM_SCOPE_ATTR]: '' }}
        data-pinned-agents-font-size={zoom.fontSize ?? undefined}
      >
        <AgentTerminalPreview
          key={choice.ptyId}
          ptyId={choice.ptyId}
          terminalInput={terminalInput}
          host={{ embedded: true, fontSize: zoom.fontSize }}
          className="h-full"
        />
      </div>
    </div>
  )
}

export function PinnedAgentsWorkspaceCard({
  item,
  onRemove
}: {
  item: PinnedAgentsPanelItem
  onRemove: (id: string) => void
}): React.JSX.Element {
  const { entry, parent } = item
  const contentId = useId()
  const [open, setOpen] = useState(true)
  // Why: the panel exists to watch agents work, so the live terminal starts open.
  const [liveOpen, setLiveOpen] = useState(true)
  const status = useWorktreeActivityStatus(entry.id)
  const rows = useWorktreeAgentRows(entry.id)
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: entry.id })
  const ptyIdsByTabId = useAppStore((s) => s.ptyIdsByTabId)
  const terminalLayoutsByTabId = useAppStore((s) => s.terminalLayoutsByTabId)
  const liveChoices = useMemo<LiveAgentChoice[]>(() => {
    const choices: LiveAgentChoice[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      const ptyId = selectAgentRowPtyId({ ptyIdsByTabId, terminalLayoutsByTabId }, row)
      if (!ptyId || seen.has(ptyId)) {
        continue
      }
      seen.add(ptyId)
      choices.push({ paneKey: row.paneKey, ptyId, label: formatAgentTypeLabel(row.agentType) })
    }
    return choices
  }, [rows, ptyIdsByTabId, terminalLayoutsByTabId])
  const showLive = liveOpen && liveChoices.length > 0
  const openLabel = translate('pinnedAgentsPanel.card.open', 'Go to this workspace')
  const removeLabel = translate('pinnedAgentsPanel.card.remove', 'Remove from this panel')
  const toggleLabel = translate('pinnedAgentsPanel.card.toggle', 'Show or hide its agents')
  const dragLabel = translate('pinnedAgentsPanel.card.drag', 'Drag to reorder')
  const liveLabel =
    liveChoices.length > 0
      ? translate('pinnedAgentsPanel.card.live', 'Live terminal')
      : translate('pinnedAgentsPanel.card.liveUnavailable', 'No live terminal to show')

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section
        ref={setNodeRef}
        // Why: translate only; dnd-kit's scale would stretch the card's text while it moves.
        style={{
          transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
          transition
        }}
        className={cn(
          'rounded-md border border-sidebar-border/70 bg-sidebar-accent/25 px-2 py-1.5',
          isDragging && 'relative z-10 shadow-md'
        )}
        data-pinned-agents-card={entry.id}
      >
        <div className="flex min-w-0 items-center gap-1">
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={dragLabel}
            className="flex shrink-0 cursor-grab touch-none items-center text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={toggleLabel}
              aria-controls={contentId}
              className="shrink-0"
            >
              <ChevronRight className={cn('size-3.5', open && 'rotate-90')} />
            </Button>
          </CollapsibleTrigger>
          <StatusIndicator status={status} className="shrink-0" />
          <button
            type="button"
            onClick={() => activateAndRevealWorktree(entry.id)}
            title={openLabel}
            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="flex min-w-0 items-center gap-1 text-[12px] font-medium text-foreground">
              {entry.kind === 'folder' ? (
                <Workflow className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : null}
              <span className="truncate hover:underline">{entry.name}</span>
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {parent
                ? translate('pinnedAgentsPanel.card.memberOf', '{{value0}} · task {{value1}}', {
                    value0: entry.projectName,
                    value1: parent.name
                  })
                : entry.kind === 'folder'
                  ? translate('pinnedAgentsPanel.card.task', 'Multi-repository task')
                  : entry.projectName}
            </span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={showLive ? 'secondary' : 'ghost'}
                size="icon-xs"
                aria-label={liveLabel}
                aria-pressed={showLive}
                disabled={liveChoices.length === 0}
                onClick={() => setLiveOpen((value) => !value)}
                className="shrink-0"
              >
                <MonitorPlay className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{liveLabel}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={removeLabel}
                onClick={() => onRemove(entry.id)}
                className="shrink-0"
              >
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{removeLabel}</TooltipContent>
          </Tooltip>
        </div>
        <CollapsibleContent id={contentId}>
          {rows.length === 0 ? (
            <p className="px-1 pt-1 text-[11px] text-muted-foreground">
              {translate('pinnedAgentsPanel.card.noAgents', 'No agents here right now')}
            </p>
          ) : (
            <WorktreeCardAgents worktreeId={entry.id} agents={rows} className="mt-0.5" />
          )}
          {showLive ? (
            <LiveTerminal
              worktreeId={entry.id}
              workspacePath={entry.path}
              choices={liveChoices}
              rows={rows}
            />
          ) : null}
          {rows.length > 0 && !showLive ? (
            <p className="mt-1 flex items-center gap-1 px-1 text-[10.5px] text-muted-foreground/80">
              {rows.slice(0, 4).map((row) => (
                <span key={row.paneKey} className="inline-flex shrink-0">
                  <AgentIcon agent={agentTypeToIconAgent(row.agentType)} size={11} />
                </span>
              ))}
              <span className="truncate">
                {translate('pinnedAgentsPanel.card.agentCount', '{{value0}} agent(s)', {
                  value0: rows.length
                })}
              </span>
            </p>
          ) : null}
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
