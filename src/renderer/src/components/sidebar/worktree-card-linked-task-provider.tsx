import { AsanaIcon } from '@/components/icons/AsanaIcon'
import { AzureDevOpsIcon } from '@/components/icons/AzureDevOpsIcon'
import { JiraIcon } from '@/components/icons/JiraIcon'
import { translate } from '@/i18n/i18n'
import type { WorktreeCardJiraIssueDisplay } from './worktree-card-meta-types'

// Why: fork task providers reuse the Jira card row; these return null for Jira so upstream copy applies.

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

export function linkedTaskDetailLabel(issue: WorktreeCardJiraIssueDisplay): string | null {
  switch (issue.provider) {
    case 'asana':
      return translate('auto.components.sidebar.WorktreeCardMeta.asanaTask', 'Asana task')
    case 'azure-devops':
      return translate(
        'auto.components.sidebar.WorktreeCardMeta.azureDevOpsItem',
        'Azure DevOps {{value0}}',
        { value0: issue.identifier }
      )
    case undefined:
      return null
  }
}

export function linkedTaskViewLabel(issue: WorktreeCardJiraIssueDisplay): string | null {
  switch (issue.provider) {
    case 'asana':
      return translate('auto.components.sidebar.WorktreeCardMeta.viewOnAsana', 'View on Asana')
    case 'azure-devops':
      return translate(
        'auto.components.sidebar.WorktreeCardMeta.viewOnAzureDevOps',
        'View on Azure DevOps'
      )
    case undefined:
      return null
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
