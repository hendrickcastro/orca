import { translate } from '@/i18n/i18n'
import { useAsanaTaskView } from './asana-task-view-store'
import { useAsanaTasks } from './use-asana-tasks'
import { AsanaConnectPanel } from './ConnectPanel'
import { AsanaCreateTaskDialog } from './CreateTaskDialog'
import { AsanaTaskRow } from './TaskRow'
import { filterAsanaTasksByStatus } from './asana-task-presentation'

export function TaskPageAsanaItemList(): React.JSX.Element {
  const { status, statusLoading, loading, scope, projectGid, statusFilter } = useAsanaTaskView()
  const { tasks, error } = useAsanaTasks()
  if (!status || (statusLoading && !status.connected)) {
    return (
      <div className="rounded-md border border-border/50 bg-muted/50 px-4 py-12 text-center text-sm text-muted-foreground">
        {translate('auto.components.TaskPage.asanaChecking', 'Checking the Asana connection…')}
      </div>
    )
  }
  if (!status.connected) {
    return (
      <div className="rounded-md border border-border/50 bg-muted/50">
        <AsanaConnectPanel error={status.error} />
      </div>
    )
  }
  const visibleTasks = filterAsanaTasksByStatus(tasks, statusFilter)
  const waitingForProject = scope === 'project' && !projectGid
  return (
    <div className="flex min-h-0 max-h-full flex-col overflow-hidden rounded-md rounded-t-none border border-t-0 border-border/50 bg-muted/50 shadow-sm">
      <div className="flex-none grid grid-cols-[24px_minmax(0,3fr)_90px_140px_minmax(0,1fr)_90px_50px] gap-3 border-b border-border/50 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span />
        <span>{translate('auto.components.TaskPage.asanaName', 'Name')}</span>
        <span>{translate('auto.components.TaskPage.asanaDue', 'Due')}</span>
        <span>{translate('auto.components.TaskPage.azureAssignee', 'Assignee')}</span>
        <span>{translate('auto.components.TaskPage.asanaProjects', 'Projects')}</span>
        <span>{translate('auto.components.TaskPage.azureCreated', 'Created')}</span>
        <span />
      </div>
      <div className="min-h-0 flex-initial overflow-y-auto scrollbar-sleek">
        {error ? (
          <div role="alert" className="border-b border-border px-4 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {!loading && visibleTasks.length === 0 && !error ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {waitingForProject
              ? translate(
                  'auto.components.TaskPage.asanaPickProject',
                  'Choose a project to see its tasks.'
                )
              : translate('auto.components.TaskPage.asanaNoTasks', 'No tasks here.')}
          </div>
        ) : null}
        <div className="divide-y divide-border/50">
          {visibleTasks.map((task) => (
            <AsanaTaskRow key={task.gid} task={task} />
          ))}
        </div>
      </div>
      <AsanaCreateTaskDialog />
    </div>
  )
}
