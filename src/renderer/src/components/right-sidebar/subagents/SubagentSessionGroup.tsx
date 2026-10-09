import { useId, useState } from 'react'
import { toast } from 'sonner'
import type React from 'react'
import { ChevronRight, SquareTerminal } from 'lucide-react'
import { AgentStateDot } from '@/components/AgentStateDot'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import type { SubagentResultSummary } from '../../../../../shared/subagent-results-types'
import { SessionTime } from '../ai-vault-session-time'
import { selectSessionAgentDotState, selectSessionLocationLabel } from './session-location'
import { findSessionPane, revealSessionPane } from './session-pane-navigation'
import { SubagentLiveActivity } from './SubagentLiveActivity'
import { openSubagentResult } from './subagent-result-open'
import { orderSubagentRows, subagentRowDotState } from './subagent-row-state'
import type { SessionSubagents } from './use-session-subagents'

function SubagentRow({
  subagent,
  summary,
  parent,
  refreshKey
}: {
  subagent: AiVaultSession
  summary: SubagentResultSummary | undefined
  parent: AiVaultSession
  refreshKey: string
}): React.JSX.Element {
  const dotState = subagentRowDotState(subagent, summary)
  const working = dotState === 'working'
  const [expanded, setExpanded] = useState(false)
  const showActivity = working && expanded
  return (
    <div className="min-w-0 space-y-1.5 rounded-md border border-sidebar-border/70 bg-sidebar-accent/25 px-2.5 py-1.5">
      <button
        type="button"
        aria-expanded={working ? expanded : undefined}
        onClick={() => {
          // Why: a working subagent has no answer yet, so it expands into its live activity.
          if (working) {
            setExpanded((value) => !value)
          } else {
            void openSubagentResult(subagent, parent.title)
          }
        }}
        className="block w-full min-w-0 space-y-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {dotState ? (
            <span className="flex shrink-0 items-center">
              <AgentStateDot state={dotState} />
            </span>
          ) : null}
          <span
            className="min-w-0 flex-1 truncate text-[12px] leading-[1.35] text-foreground/90 hover:underline"
            title={subagent.title}
          >
            {subagent.title}
          </span>
          {subagent.subagent?.agentType ? (
            <Badge variant="outline" className="shrink-0">
              {subagent.subagent.agentType}
            </Badge>
          ) : null}
        </span>
        {showActivity ? null : (
          <span className="line-clamp-2 block text-[11px] leading-[1.4] text-muted-foreground">
            {summary?.preview ??
              (working
                ? translate('subagentsPanel.row.working', 'Working… select to follow it')
                : translate('subagentsPanel.row.noPreview', 'No answer text yet'))}
          </span>
        )}
      </button>
      {showActivity ? (
        <SubagentLiveActivity subagent={subagent} parent={parent} refreshKey={refreshKey} />
      ) : null}
    </div>
  )
}

export function SubagentSessionGroup({
  session,
  rows,
  open,
  onOpenChange,
  refreshKey
}: {
  session: AiVaultSession
  rows: SessionSubagents
  open: boolean
  onOpenChange: (open: boolean) => void
  refreshKey: string
}): React.JSX.Element {
  const contentId = useId()
  const hasPane = useAppStore((s) => findSessionPane(s, session) !== null)
  const parentDot = useAppStore((s) => selectSessionAgentDotState(s, session))
  const location = useAppStore((s) => selectSessionLocationLabel(s, session))
  const toggleLabel = translate('subagentsPanel.group.toggle', 'Show or hide subagents')
  const terminalLabel = translate('subagentsPanel.group.openTerminal', 'Go to its terminal')
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <section className="space-y-1.5" aria-busy={rows.status === 'loading'}>
        <div className="flex min-w-0 items-start gap-1.5">
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
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {parentDot ? (
                <span className="flex shrink-0 items-center">
                  <AgentStateDot state={parentDot} />
                </span>
              ) : null}
              <span
                className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground"
                title={session.title}
              >
                {session.title}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {rows.status === 'loaded' ? rows.subagents.length : session.subagentTranscriptCount}
              </span>
              <SessionTime value={session.updatedAt ?? session.modifiedAt} />
            </div>
            <div
              className="truncate text-[11px] text-muted-foreground"
              title={location ?? undefined}
            >
              {location
                ? translate('subagentsPanel.group.launchedIn', 'Claude · {{location}}', {
                    location
                  })
                : translate('subagentsPanel.group.launchedByClaude', 'Claude')}
            </div>
          </div>
          {hasPane ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={terminalLabel}
                  onClick={() => {
                    if (!revealSessionPane(session)) {
                      toast.error(
                        translate(
                          'subagentsPanel.group.terminalGone',
                          'That terminal is no longer open.'
                        )
                      )
                    }
                  }}
                  className="shrink-0"
                >
                  <SquareTerminal className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{terminalLabel}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <CollapsibleContent id={contentId}>
          <div className="space-y-1.5 pl-6">
            {rows.status === 'loading' ? (
              <p role="status" className="text-xs text-muted-foreground">
                {translate('subagentsPanel.loading', 'Loading subagents…')}
              </p>
            ) : null}
            {rows.status === 'error' ? (
              <p role="status" className="text-xs text-muted-foreground">
                {translate(
                  'subagentsPanel.group.loadError',
                  "Couldn't load this session's subagents."
                )}
              </p>
            ) : null}
            {orderSubagentRows(rows.subagents, rows.summaryByPath).map((subagent) => (
              <SubagentRow
                key={subagent.filePath}
                subagent={subagent}
                summary={rows.summaryByPath.get(subagent.filePath)}
                parent={session}
                refreshKey={refreshKey}
              />
            ))}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
