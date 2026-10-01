import { LoaderCircle, Plus, RefreshCw, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import {
  patchAsanaTaskView,
  refreshAsanaTasks,
  selectAsanaWorkspace,
  useAsanaTaskView
} from './asana-task-view-store'
import { reloadAsanaStatus } from './use-asana-tasks'

function chipClassName(active: boolean): string {
  return cn(
    'rounded-md border px-2 py-1 text-xs transition',
    active
      ? 'border-border/50 bg-foreground/90 text-background backdrop-blur-md'
      : 'border-border/50 bg-transparent text-foreground hover:bg-muted/50'
  )
}

export function TaskPageAsanaFilters(): React.JSX.Element | null {
  const { status, workspaceGid, scope, projectGid, projects, loading, statusFilter } =
    useAsanaTaskView()
  if (!status?.connected) {
    return null
  }
  const disconnect = async (): Promise<void> => {
    await window.api.asana?.disconnect()
    await reloadAsanaStatus()
  }
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {status.workspaces.length > 1 ? (
          <Select value={workspaceGid ?? undefined} onValueChange={selectAsanaWorkspace}>
            <SelectTrigger size="sm" className="w-full sm:w-[220px]">
              <SelectValue
                placeholder={translate('auto.components.TaskPage.asanaWorkspace', 'Workspace')}
              />
            </SelectTrigger>
            <SelectContent>
              {status.workspaces.map((workspace) => (
                <SelectItem key={workspace.gid} value={workspace.gid}>
                  {workspace.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {status.userName ? (
          <span className="text-xs text-muted-foreground">{status.userName}</span>
        ) : null}
      </div>
      <div className="min-w-0 rounded-md rounded-b-none border border-border/50 bg-muted/50 px-3 pt-2 pb-0 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => patchAsanaTaskView({ scope: 'my-tasks' })}
              className={chipClassName(scope === 'my-tasks')}
            >
              {translate('auto.components.TaskPage.asanaMyTasks', 'My tasks')}
            </button>
            <Select
              value={scope === 'project' ? (projectGid ?? undefined) : undefined}
              onValueChange={(gid) => patchAsanaTaskView({ scope: 'project', projectGid: gid })}
            >
              <SelectTrigger size="sm" className="w-[200px]">
                <SelectValue
                  placeholder={translate('auto.components.TaskPage.asanaByProject', 'By project…')}
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.gid} value={project.gid}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {(
              [
                ['all', translate('auto.components.TaskPage.asanaFilterAll', 'All')],
                ['open', translate('auto.components.TaskPage.asanaFilterOpen', 'Open')],
                ['done', translate('auto.components.TaskPage.asanaFilterDone', 'Done')]
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => patchAsanaTaskView({ statusFilter: id })}
                className={chipClassName(statusFilter === id)}
              >
                {label}
              </button>
            ))}
            <Button size="sm" onClick={() => patchAsanaTaskView({ createOpen: true })}>
              <Plus className="size-3.5" />
              {translate('auto.components.TaskPage.asanaNewTaskButton', 'New task')}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={refreshAsanaTasks}
                  disabled={loading}
                  aria-label={translate(
                    'auto.components.TaskPage.asanaRefresh',
                    'Refresh Asana tasks'
                  )}
                >
                  {loading ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {translate('auto.components.TaskPage.asanaRefresh', 'Refresh Asana tasks')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void disconnect()}
                  aria-label={translate(
                    'auto.components.TaskPage.asanaDisconnect',
                    'Disconnect Asana'
                  )}
                >
                  <Unlink className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {translate('auto.components.TaskPage.asanaDisconnect', 'Disconnect Asana')}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </>
  )
}
