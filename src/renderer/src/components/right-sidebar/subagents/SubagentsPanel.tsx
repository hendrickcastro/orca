import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import { useActiveWorktreeId } from '@/store/selectors'
import { useWorktreeActivityStatus } from '../../sidebar/use-worktree-activity-status'
import { orderSessionsByLiveWork } from './subagent-row-state'
import { SubagentSessionGroup } from './SubagentSessionGroup'
import { LOADING_SESSION_SUBAGENTS, useSessionsSubagents } from './use-session-subagents'
import { useWorkspaceSubagentSessions } from './use-workspace-subagent-sessions'

const LIVE_REFRESH_INTERVAL_MS = 4_000

/** Ticks while an agent in the workspace is working, so running subagents update in place. */
function useLiveRefreshTick(active: boolean): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) {
      return
    }
    // Why: pauses while the window is hidden and catches up once it is visible again.
    return installWindowVisibilityInterval({
      run: () => setTick((value) => value + 1),
      intervalMs: LIVE_REFRESH_INTERVAL_MS
    })
  }, [active])
  return tick
}

function PanelMessage({ title, copy }: { title: string; copy?: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {copy ? (
        <div className="mt-2 max-w-[16rem] text-xs leading-5 text-muted-foreground">{copy}</div>
      ) : null}
    </div>
  )
}

export default function SubagentsPanel(): React.JSX.Element {
  const workspaceId = useActiveWorktreeId() ?? null
  const liveStatus = useWorktreeActivityStatus(workspaceId ?? '')
  const tick = useLiveRefreshTick(liveStatus === 'working')
  const [manualRefresh, setManualRefresh] = useState(0)
  const refreshKey = `${liveStatus}:${tick}:${manualRefresh}`
  const data = useWorkspaceSubagentSessions(`${liveStatus}:${tick}`, manualRefresh)
  const rowsBySession = useSessionsSubagents(data.sessions, refreshKey)
  const orderedSessions = useMemo(
    () => orderSessionsByLiveWork(data.sessions, rowsBySession),
    [data.sessions, rowsBySession]
  )
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const refreshLabel = translate('subagentsPanel.refresh', 'Refresh subagents')

  let body: React.JSX.Element
  if (!workspaceId) {
    body = (
      <PanelMessage
        title={translate('subagentsPanel.noWorkspace', 'No workspace selected')}
        copy={translate(
          'subagentsPanel.noWorkspaceCopy',
          'Select a workspace to see the subagents its agents launched.'
        )}
      />
    )
  } else if (data.remote) {
    body = (
      <PanelMessage
        title={translate('subagentsPanel.remoteTitle', 'Not available for SSH workspaces')}
        copy={translate(
          'subagentsPanel.remoteCopy',
          'Subagent transcripts are read from this computer, so SSH workspaces are not covered yet.'
        )}
      />
    )
  } else if (data.sessions.length === 0) {
    body =
      data.status === 'loading' ? (
        <PanelMessage title={translate('subagentsPanel.loading', 'Loading subagents…')} />
      ) : data.status === 'error' ? (
        <PanelMessage
          title={translate('subagentsPanel.loadError', "Couldn't load this workspace's sessions")}
          copy={translate('subagentsPanel.loadErrorCopy', 'Use Refresh to try again.')}
        />
      ) : (
        <PanelMessage
          title={translate('subagentsPanel.emptyTitle', 'No subagents yet')}
          copy={translate(
            'subagentsPanel.emptyCopy',
            'When a Claude agent in this workspace delegates work to subagents, each one appears here under the session that launched it. Select one to open its result.'
          )}
        />
      )
  } else {
    body = (
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-3">
          {orderedSessions.map((session) => (
            <SubagentSessionGroup
              key={session.id}
              session={session}
              rows={rowsBySession.get(session.id) ?? LOADING_SESSION_SUBAGENTS}
              open={!collapsed.has(session.id)}
              onOpenChange={(open) =>
                setCollapsed((previous) => {
                  const next = new Set(previous)
                  if (open) {
                    next.delete(session.id)
                  } else {
                    next.add(session.id)
                  }
                  return next
                })
              }
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {translate('subagentsPanel.title', 'Subagents')}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {translate('subagentsPanel.subtitle', 'Grouped by the session that launched them')}
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setManualRefresh((value) => value + 1)}
                disabled={!workspaceId || data.remote}
                aria-label={refreshLabel}
              >
                <RefreshCw
                  className={cn('size-3.5', data.status === 'loading' && 'animate-spin')}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{refreshLabel}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {body}
    </div>
  )
}
