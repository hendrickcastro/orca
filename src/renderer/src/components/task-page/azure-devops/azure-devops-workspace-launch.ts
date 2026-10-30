import type { AzureDevOpsTaskItem } from '../../../../../shared/azure-devops-tasks'
import {
  getLinkedWorkItemSuggestedName,
  getLinkedWorkItemWorkspaceName,
  type LinkedWorkItemSummary
} from '@/lib/new-workspace'
import { useAppStore } from '@/store'

export function getAzureDevOpsItemWorkspaceSeed(item: AzureDevOpsTaskItem): string {
  const linked = {
    type: item.kind === 'pull-request' ? ('pr' as const) : ('issue' as const),
    provider: 'azure-devops' as const,
    number: item.id,
    title: item.title
  }
  return getLinkedWorkItemWorkspaceName(linked)?.seedName ?? getLinkedWorkItemSuggestedName(item)
}

function azureDevOpsLinkedWorkItem(item: AzureDevOpsTaskItem): LinkedWorkItemSummary {
  return {
    provider: 'azure-devops',
    type: item.kind === 'pull-request' ? 'pr' : 'issue',
    number: item.id,
    title: item.title,
    url: item.url,
    repoId: item.repoId
  }
}

/** Opens the new-workspace composer linked to an Azure DevOps work item or pull request. */
export function openComposerForAzureDevOpsItem(item: AzureDevOpsTaskItem): void {
  useAppStore.getState().openModal('new-workspace-composer', {
    linkedWorkItem: azureDevOpsLinkedWorkItem(item),
    prefilledName: getAzureDevOpsItemWorkspaceSeed(item),
    initialRepoId: item.repoId,
    telemetrySource: 'sidebar'
  })
}

/** The work item handed to the several-repositories flow, for items that span repos. */
export function openMultiRepoWorkspaceForAzureDevOpsItem(item: AzureDevOpsTaskItem): void {
  useAppStore.getState().openModal('multi-repo-workspace', {
    name: getAzureDevOpsItemWorkspaceSeed(item),
    linkedWorkItem: azureDevOpsLinkedWorkItem(item)
  })
}
