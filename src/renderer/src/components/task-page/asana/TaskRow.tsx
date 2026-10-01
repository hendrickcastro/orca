import { ArrowRight, Circle, CircleCheck, ExternalLink, LoaderCircle } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { useState } from 'react'
import type { AsanaTask } from '../../../../../shared/asana-types'
import { formatAsanaDueDate, getAsanaTaskState } from './asana-task-presentation'
import { openComposerForAsanaTask } from './asana-workspace-launch'

function openInBrowser(task: AsanaTask): void {
  void window.api.shell.openUrl(task.url)
}

function stateLabel(state: ReturnType<typeof getAsanaTaskState>): string {
  switch (state) {
    case 'done':
      return translate('auto.components.TaskPage.asanaStateDone', 'Done')
    case 'overdue':
      return translate('auto.components.TaskPage.asanaStateOverdue', 'Overdue')
    case 'open':
      return translate('auto.components.TaskPage.asanaStateOpen', 'Open')
  }
}

export function AsanaTaskRow({ task }: { task: AsanaTask }): React.JSX.Element {
  const state = getAsanaTaskState(task)
  const label = stateLabel(state)
  const [launching, setLaunching] = useState(false)
  return (
    // Why: div role="button" — it nests action buttons, and button-in-button is invalid HTML.
    <div
      role="button"
      tabIndex={0}
      onClick={() => openInBrowser(task)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          openInBrowser(task)
        }
      }}
      className="grid w-full cursor-pointer grid-cols-[24px_minmax(0,3fr)_90px_140px_minmax(0,1fr)_90px_50px] items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
    >
      <span title={label} aria-label={label} className="flex items-center">
        {state === 'done' ? (
          <CircleCheck className="size-4 text-status-success" />
        ) : (
          <Circle className="size-4 text-muted-foreground" />
        )}
      </span>
      <span className={cn('min-w-0 truncate text-sm', state === 'done' && 'text-muted-foreground')}>
        {task.name}
      </span>
      <span
        className={cn(
          'text-xs',
          state === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {formatAsanaDueDate(task.dueOn)}
      </span>
      <span className="truncate text-xs text-muted-foreground">{task.assignee ?? '—'}</span>
      <span className="flex min-w-0 gap-1 overflow-hidden">
        {task.projects.map((project) => (
          <Badge key={project} variant="outline">
            {project}
          </Badge>
        ))}
      </span>
      <span className="text-xs text-muted-foreground">
        {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : ''}
      </span>
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={launching}
              onClick={(event) => {
                event.stopPropagation()
                setLaunching(true)
                void openComposerForAsanaTask(task).finally(() => setLaunching(false))
              }}
              aria-label={translate(
                'auto.components.TaskPage.asanaStartWorkspace',
                'Start workspace from {{value0}}',
                { value0: task.name }
              )}
            >
              {launching ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {translate('auto.components.TaskPage.9497f2787c', 'Start workspace')}
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            openInBrowser(task)
          }}
          aria-label={translate('auto.components.TaskPage.asanaOpenInBrowser', 'Open in Asana')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
