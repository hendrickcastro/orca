import type { TaskPageComposerActionsModel } from '../../use-task-page-composer-actions'
import { translate } from '@/i18n/i18n'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { ArrowRight, ExternalLink } from 'lucide-react'
import type { AzureDevOpsTaskItem } from '../../../../../shared/azure-devops-tasks'
import { useAzureDevOpsTaskItems } from './use-azure-devops-task-items'
import { useAzureDevOpsTaskView } from './azure-devops-task-view-store'
import { openComposerForAzureDevOpsItem } from './azure-devops-workspace-launch'

function emptyMessage(view: 'work-items' | 'pull-requests', hasAzureRepos: boolean): string {
  if (!hasAzureRepos) {
    return translate(
      'auto.components.TaskPage.azureNoRepos',
      'None of the selected projects has an Azure DevOps remote. Select a project hosted on dev.azure.com or visualstudio.com.'
    )
  }
  return view === 'work-items'
    ? translate(
        'auto.components.TaskPage.azureNoWorkItems',
        'No open work items match this filter.'
      )
    : translate(
        'auto.components.TaskPage.azureNoPullRequests',
        'No active pull requests match this filter.'
      )
}

function openInBrowser(item: AzureDevOpsTaskItem): void {
  void window.api.shell.openUrl(item.url)
}

export function TaskPageAzureDevOpsItemList({
  model
}: {
  model: TaskPageComposerActionsModel
}): React.JSX.Element {
  const { view } = useAzureDevOpsTaskView()
  const { azureRepos, items, error, loading } = useAzureDevOpsTaskItems(model.selectedRepos)
  const repoNameById = new Map(azureRepos.map(({ repo }) => [repo.id, repo.displayName]))
  const showRepo = azureRepos.length > 1
  return (
    <div className="flex min-h-0 max-h-full flex-col overflow-hidden rounded-md rounded-t-none border border-t-0 border-border/50 bg-muted/50 shadow-sm">
      <div className="flex-none grid grid-cols-[80px_minmax(0,3fr)_150px_140px_100px_50px] gap-3 border-b border-border/50 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span>{translate('auto.components.TaskPage.eb10c32872', 'ID')}</span>
        <span>{translate('auto.components.TaskPage.16cba35bee', 'Title')}</span>
        <span>{translate('auto.components.TaskPage.00b7ffb952', 'Type / State')}</span>
        <span>
          {view === 'work-items'
            ? translate('auto.components.TaskPage.azureAssignee', 'Assignee')
            : translate('auto.components.TaskPage.azureAuthor', 'Author')}
        </span>
        <span>
          {view === 'work-items'
            ? translate('auto.components.TaskPage.f362667d55', 'Updated')
            : translate('auto.components.TaskPage.azureCreated', 'Created')}
        </span>
        <span />
      </div>
      <div className="min-h-0 flex-initial overflow-y-auto scrollbar-sleek">
        {error ? (
          <div role="alert" className="border-b border-border px-4 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {loading && items.length === 0 ? (
          <div className="divide-y divide-border/50">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="grid w-full gap-3 px-3 py-2 grid-cols-[80px_minmax(0,3fr)_150px_140px_100px_50px]"
              >
                <div className="h-4 w-14 animate-pulse rounded bg-muted/70" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-muted/70" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted/60" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted/60" />
                <div />
              </div>
            ))}
          </div>
        ) : null}
        {!loading && items.length === 0 && !error ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {emptyMessage(view, azureRepos.length > 0)}
          </div>
        ) : null}
        <div className="divide-y divide-border/50">
          {items.map((item) => (
            // Why: div role="button" — it nests action buttons, and button-in-button is invalid HTML.
            <div
              role="button"
              tabIndex={0}
              key={`${item.kind}:${item.projectKey}:${item.id}`}
              onClick={() => openInBrowser(item)}
              onKeyDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault()
                  openInBrowser(item)
                }
              }}
              className="grid w-full cursor-pointer gap-3 px-3 py-2 text-left hover:bg-muted/50 grid-cols-[80px_minmax(0,3fr)_150px_140px_100px_50px]"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {item.kind === 'pull-request' ? '!' : '#'}
                {item.id}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm">{item.title}</span>
                {showRepo || item.sourceBranch ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {[showRepo ? repoNameById.get(item.repoId) : null, item.sourceBranch]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                ) : null}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {item.typeLabel} · {item.state}
              </span>
              <span className="truncate text-xs text-muted-foreground">{item.person ?? '—'}</span>
              <span className="text-xs text-muted-foreground">
                {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ''}
              </span>
              <div className="flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(event) => {
                        event.stopPropagation()
                        openComposerForAzureDevOpsItem(item)
                      }}
                      aria-label={translate(
                        'auto.components.TaskPage.azureStartWorkspace',
                        'Start workspace from {{value0}}',
                        { value0: `${item.kind === 'pull-request' ? '!' : '#'}${item.id}` }
                      )}
                    >
                      <ArrowRight className="size-3.5" />
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
                    openInBrowser(item)
                  }}
                  aria-label={translate(
                    'auto.components.TaskPage.azureOpenInBrowser',
                    'Open in Azure DevOps'
                  )}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
