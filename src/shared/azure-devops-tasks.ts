export type AzureDevOpsWorkItemFilter = 'assigned-to-me' | 'all-open'

export type AzureDevOpsPullRequestFilter = 'active' | 'created-by-me' | 'review-requested'

export type AzureDevOpsTaskItem = {
  kind: 'work-item' | 'pull-request'
  id: number
  title: string
  /** Work item type ("Bug", "User Story"…) or "Pull request". */
  typeLabel: string
  state: string
  /** Assignee for work items, author for pull requests. */
  person: string | null
  updatedAt: string | null
  url: string
  /** Same id in another repo of the same project is the same item; dedupe on this. */
  projectKey: string
  repoId: string
  sourceBranch?: string
}

export type AzureDevOpsTaskListErrorType = 'not_azure_devops' | 'auth' | 'request'

export type AzureDevOpsTaskListArgs = {
  repoId: string
  remoteUrl: string
}

export type AzureDevOpsWorkItemListArgs = AzureDevOpsTaskListArgs & {
  filter: AzureDevOpsWorkItemFilter
}

export type AzureDevOpsPullRequestListArgs = AzureDevOpsTaskListArgs & {
  filter: AzureDevOpsPullRequestFilter
}

export type AzureDevOpsTaskListResult = {
  items: AzureDevOpsTaskItem[]
  error?: { type: AzureDevOpsTaskListErrorType; message: string }
}
