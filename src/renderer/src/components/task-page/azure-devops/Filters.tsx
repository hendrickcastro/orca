import type { TaskPageComposerActionsModel } from '../../use-task-page-composer-actions'
import { cn } from '@/lib/utils'
import TaskProjectSourceCombobox from '@/components/task-project-source-combobox'
import { normalizeTaskRepoSelection } from '@/components/task-page-default-repo-selection'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import {
  refreshAzureDevOpsTasks,
  setAzureDevOpsPullRequestFilter,
  setAzureDevOpsTaskView,
  setAzureDevOpsWorkItemFilter,
  useAzureDevOpsTaskView,
  type AzureDevOpsTaskView
} from './azure-devops-task-view-store'

function viewLabel(view: AzureDevOpsTaskView): string {
  return view === 'work-items'
    ? translate('auto.components.TaskPage.azureWorkItems', 'Work items')
    : translate('auto.components.TaskPage.azurePullRequests', 'Pull requests')
}

function chipClassName(active: boolean): string {
  return cn(
    'rounded-md border px-2 py-1 text-xs transition',
    active
      ? 'border-border/50 bg-foreground/90 text-background backdrop-blur-md'
      : 'border-border/50 bg-transparent text-foreground hover:bg-muted/50'
  )
}

export function TaskPageAzureDevOpsFilters({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element {
  const {
    updateSettings,
    eligibleRepos,
    repoSelection,
    setRepoSelection,
    taskPickerGroups,
    taskPickerRepos,
    getTaskPickerRepoHostLabel
  } = model
  const { view, workItemFilter, pullRequestFilter, loading } = useAzureDevOpsTaskView()
  const saveSelectionFailed = (): void => {
    toast.error(
      translate('auto.components.TaskPage.dfd72673e7', 'Failed to save project selection.')
    )
  }
  const chips =
    view === 'work-items'
      ? (
          [
            [
              'assigned-to-me',
              translate('auto.components.TaskPage.azureAssignedToMe', 'Assigned to me')
            ],
            ['all-open', translate('auto.components.TaskPage.azureAllOpen', 'All open')]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAzureDevOpsWorkItemFilter(id)}
            className={chipClassName(workItemFilter === id)}
          >
            {label}
          </button>
        ))
      : (
          [
            ['active', translate('auto.components.TaskPage.azureActive', 'Active')],
            [
              'created-by-me',
              translate('auto.components.TaskPage.azureCreatedByMe', 'Created by me')
            ],
            [
              'review-requested',
              translate('auto.components.TaskPage.azureNeedsMyReview', 'Needs my review')
            ]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAzureDevOpsPullRequestFilter(id)}
            className={chipClassName(pullRequestFilter === id)}
          >
            {label}
          </button>
        ))
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-xs">
          {(['work-items', 'pull-requests'] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setAzureDevOpsTaskView(entry)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs transition',
                view === entry
                  ? 'border-foreground/40 bg-foreground/90 text-background'
                  : 'border-border/50 bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              {viewLabel(entry)}
            </button>
          ))}
        </div>
        <div className="min-w-0 w-full sm:w-[200px]">
          <TaskProjectSourceCombobox
            groups={taskPickerGroups}
            selected={repoSelection}
            getRepoHostLabel={getTaskPickerRepoHostLabel}
            onChange={(next) => {
              const normalized = normalizeTaskRepoSelection(eligibleRepos, next)
              setRepoSelection(normalized)
              void updateSettings({ defaultRepoSelection: [...normalized] }).catch(
                saveSelectionFailed
              )
            }}
            onSelectAll={() => {
              setRepoSelection(new Set(taskPickerRepos.map((repo) => repo.id)))
              void updateSettings({ defaultRepoSelection: null }).catch(saveSelectionFailed)
            }}
            triggerClassName="h-8 w-full rounded-md border border-border/50 bg-muted/50 px-2 text-xs font-medium shadow-sm transition hover:bg-muted/50 focus:ring-2 focus:ring-ring/20 focus:outline-none"
          />
        </div>
      </div>
      <div className="min-w-0 rounded-md rounded-b-none border border-border/50 bg-muted/50 px-3 pt-2 pb-0 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex flex-wrap gap-2">{chips}</div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={refreshAzureDevOpsTasks}
                disabled={loading}
                aria-label={translate(
                  'auto.components.TaskPage.azureRefresh',
                  'Refresh Azure DevOps items'
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
              {translate('auto.components.TaskPage.azureRefresh', 'Refresh Azure DevOps items')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  )
}
