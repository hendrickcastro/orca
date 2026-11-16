import type { ForkTaskProviderIdentity } from '../../../shared/work-items/fork-task-provider-identity'

/** Labels the fork's Azure DevOps and Asana identities in task source summaries. */
export function getForkProviderIdentityLabel(identity: ForkTaskProviderIdentity): string | null {
  switch (identity.provider) {
    case 'asana':
      return identity.workspaceName ?? identity.workspaceId ?? null
    case 'azure-devops':
      return identity.repository ?? identity.project ?? identity.organizationUrl ?? null
  }
}
