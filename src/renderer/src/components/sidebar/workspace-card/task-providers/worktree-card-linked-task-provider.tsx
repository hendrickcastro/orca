import { AsanaIcon } from '@/components/icons/AsanaIcon'
import { AzureDevOpsIcon } from '@/components/icons/AzureDevOpsIcon'
import { JiraIcon } from '@/components/icons/JiraIcon'
import { translate } from '@/i18n/i18n'
import type { WorktreeCardJiraIssueDisplay } from '../metadata/worktree-card-meta-types'

// Why: fork task providers (Asana, Azure DevOps) reuse the card's Jira slot; Jira returns null so upstream copy applies.

export function WorktreeCardLinkedTaskIcon({
  issue,
  className
}: {
  issue: WorktreeCardJiraIssueDisplay
  className?: string
}): React.JSX.Element {
  switch (issue.provider) {
    case 'asana':
      return <AsanaIcon className={className} />
    case 'azure-devops':
      return <AzureDevOpsIcon className={className} />
    case undefined:
      return <JiraIcon className={className} />
  }
}

export function linkedTaskBadgeLabel(issue: WorktreeCardJiraIssueDisplay): string | null {
  switch (issue.provider) {
    case 'asana':
      return translate(
        'auto.components.sidebar.WorktreeCardMeta.linkedAsana',
        'Linked Asana task {{value0}}',
        { value0: issue.title }
      )
    case 'azure-devops':
      return translate(
        'auto.components.sidebar.WorktreeCardMeta.linkedAzureDevOps',
        'Linked Azure DevOps {{value0}}',
        { value0: issue.identifier }
      )
    case undefined:
      return null
  }
}

/** Provider name the details hover's task row shows; also the key of its mark below. */
export function linkedTaskProviderName(
  issue: WorktreeCardJiraIssueDisplay | null | undefined
): string | null {
  switch (issue?.provider) {
    case 'asana':
      return 'Asana'
    case 'azure-devops':
      return 'Azure DevOps'
    case undefined:
      return null
  }
}

/** Provider marks the reference rows draw for fork providers, keyed like upstream's. */
export const FORK_TASK_PROVIDER_MARKS: Record<
  string,
  (props: { className?: string }) => React.JSX.Element
> = {
  Asana: AsanaIcon,
  'Azure DevOps': AzureDevOpsIcon
}
