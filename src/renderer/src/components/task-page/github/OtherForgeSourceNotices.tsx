import { translate } from '@/i18n/i18n'
import type { TaskPageRepoSourceState } from '../../task-page-cache-selectors'
import {
  selectTaskPageOtherForgeSourceRepos,
  type TaskPageOtherForge
} from '../../task-page-other-forge-source-repos'

function otherForgeSourceNotice(forge: TaskPageOtherForge): string {
  switch (forge) {
    case 'azure-devops':
      return translate(
        'auto.components.TaskPage.otherForgeAzureDevOps',
        'is hosted on Azure DevOps. Its work items and pull requests are in the Azure DevOps tab.'
      )
    case 'gitlab':
      return translate(
        'auto.components.TaskPage.otherForgeGitLab',
        'is hosted on GitLab. Its issues and merge requests are in the GitLab tab.'
      )
    case 'bitbucket':
      return translate(
        'auto.components.TaskPage.otherForgeBitbucket',
        'is hosted on Bitbucket, which Tasks does not list.'
      )
    case 'gitea':
      return translate(
        'auto.components.TaskPage.otherForgeGitea',
        'is hosted on Gitea, which Tasks does not list.'
      )
  }
}

export function TaskPageOtherForgeSourceNotices({
  repos,
  sourceState
}: {
  repos: Parameters<typeof selectTaskPageOtherForgeSourceRepos>[0]
  sourceState: readonly TaskPageRepoSourceState[]
}): React.JSX.Element {
  return (
    <>
      {selectTaskPageOtherForgeSourceRepos(repos, sourceState).map((r) => (
        <div
          key={`source-other-forge-${r.repoId}`}
          role="status"
          className="border-b border-border/50 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
        >
          <span className="font-mono">{r.label}</span> {otherForgeSourceNotice(r.forge)}
        </div>
      ))}
    </>
  )
}
