import type { AzureDevOpsTaskItem } from '../../../../../shared/azure-devops-tasks'
import { getLinkedWorkItemSuggestedName, getLinkedWorkItemWorkspaceName } from '@/lib/new-workspace'
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

/** Opens the new-workspace composer linked to an Azure DevOps work item or pull request. */
export function openComposerForAzureDevOpsItem(item: AzureDevOpsTaskItem): void {
  useAppStore.getState().openModal('new-workspace-composer', {
    linkedWorkItem: {
      provider: 'azure-devops',
      type: item.kind === 'pull-request' ? 'pr' : 'issue',
      number: item.id,
      title: item.title,
      url: item.url,
      repoId: item.repoId
    },
    prefilledName: getAzureDevOpsItemWorkspaceSeed(item),
    initialRepoId: item.repoId,
    telemetrySource: 'sidebar'
  })
}
