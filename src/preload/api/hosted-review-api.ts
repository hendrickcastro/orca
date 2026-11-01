import type {
  AzureDevOpsConnectArgs,
  AzureDevOpsConnectResult,
  AzureDevOpsConnectionStatus
} from '../../shared/azure-devops-credentials'
import type {
  AzureDevOpsPullRequestListArgs,
  AzureDevOpsTaskListResult,
  AzureDevOpsWorkItemListArgs
} from '../../shared/azure-devops-tasks'
import type {
  BitbucketConnectArgs,
  BitbucketConnectResult,
  BitbucketConnectionStatus
} from '../../shared/bitbucket-credentials'
import type {
  CreateHostedReviewArgs,
  CreateHostedReviewResult,
  CreateStackedHostedReviewArgs,
  CreateStackedHostedReviewResult,
  HostedReviewCreationEligibility,
  HostedReviewCreationEligibilityArgs,
  HostedReviewForBranchArgs,
  HostedReviewForBranchReply,
  HostedReviewInfo
} from '../../shared/hosted-review'

export type HostedReviewApi = {
  forBranch: {
    (
      args: HostedReviewForBranchArgs & { reportReadOutcome?: false }
    ): Promise<HostedReviewInfo | null>
    (args: HostedReviewForBranchArgs): Promise<HostedReviewForBranchReply>
  }
  getCreationEligibility: (
    args: HostedReviewCreationEligibilityArgs
  ) => Promise<HostedReviewCreationEligibility>
  create: (args: CreateHostedReviewArgs) => Promise<CreateHostedReviewResult>
  createStacked: (args: CreateStackedHostedReviewArgs) => Promise<CreateStackedHostedReviewResult>
}

export type AzureDevOpsApi = {
  connect: (args: AzureDevOpsConnectArgs) => Promise<AzureDevOpsConnectResult>
  disconnect: (organizationUrl: string) => Promise<void>
  status: () => Promise<AzureDevOpsConnectionStatus>
  listWorkItems: (args: AzureDevOpsWorkItemListArgs) => Promise<AzureDevOpsTaskListResult>
  listPullRequests: (args: AzureDevOpsPullRequestListArgs) => Promise<AzureDevOpsTaskListResult>
}

export type BitbucketApi = {
  connect: (args: BitbucketConnectArgs) => Promise<BitbucketConnectResult>
  disconnect: () => Promise<void>
  status: () => Promise<BitbucketConnectionStatus>
}
