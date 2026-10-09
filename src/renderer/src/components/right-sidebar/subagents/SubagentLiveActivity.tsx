import type React from 'react'
import { FileText, MessageSquareText, SquareTerminal, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import { revealSessionPane } from './session-pane-navigation'
import { openSubagentResult } from './subagent-result-open'
import { useSubagentLiveDetail } from './use-subagent-live-detail'

const ACTIVITY_ROWS_SHOWN = 8

function activityTime(at: string | null): string | null {
  const timestamp = at ? Date.parse(at) : Number.NaN
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null
}

/** What a working subagent was asked and what it has done so far; follows the panel's refresh. */
export function SubagentLiveActivity({
  subagent,
  parent,
  refreshKey
}: {
  subagent: AiVaultSession
  parent: AiVaultSession
  refreshKey: string
}): React.JSX.Element {
  const { status, detail } = useSubagentLiveDetail(subagent, true, refreshKey)
  const activity = detail?.activity.slice(-ACTIVITY_ROWS_SHOWN) ?? []
  return (
    <div className="space-y-2 border-t border-sidebar-border/70 pt-2">
      {status === 'loading' && !detail ? (
        <p role="status" className="text-[11px] text-muted-foreground">
          {translate('subagentsPanel.live.loading', 'Reading its activity…')}
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="status" className="text-[11px] text-muted-foreground">
          {translate('subagentsPanel.live.loadError', "Couldn't read this subagent's activity.")}
        </p>
      ) : null}
      {detail?.prompt ? (
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-foreground/80">
            {translate('subagentsPanel.live.assignment', 'Assignment')}
          </div>
          <p className="line-clamp-3 text-[11px] leading-[1.4] text-muted-foreground">
            {detail.prompt}
          </p>
        </div>
      ) : null}
      {detail ? (
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-foreground/80">
            {translate('subagentsPanel.live.recentActivity', 'Recent activity')}
          </div>
          {activity.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {translate('subagentsPanel.live.noActivity', 'No activity recorded yet.')}
            </p>
          ) : (
            <ol className="space-y-0.5">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex min-w-0 items-start gap-1.5 text-[11px] leading-[1.4]"
                >
                  {item.kind === 'tool' ? (
                    <Wrench className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <MessageSquareText className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                  )}
                  <span
                    className="min-w-0 flex-1 truncate text-foreground/85"
                    title={item.detail ?? item.label}
                  >
                    {item.kind === 'tool' ? (
                      <>
                        <span className="font-medium">{item.label}</span>
                        {item.detail ? (
                          <span className="text-muted-foreground"> {item.detail}</span>
                        ) : null}
                      </>
                    ) : (
                      item.label
                    )}
                  </span>
                  {activityTime(item.at) ? (
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {activityTime(item.at)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => void openSubagentResult(subagent, parent.title)}
        >
          <FileText />
          {translate('subagentsPanel.live.openTab', 'Open in a tab')}
        </Button>
        <Button type="button" variant="ghost" size="xs" onClick={() => revealSessionPane(parent)}>
          <SquareTerminal />
          {translate('subagentsPanel.group.openTerminal', 'Go to its terminal')}
        </Button>
      </div>
    </div>
  )
}
