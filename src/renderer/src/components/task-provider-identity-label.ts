import type { TaskProviderIdentity } from '../../../shared/task-source-context'

// Why a separate module: keeps task-source-context-summary.ts within its line budget now that the
// fork's Azure DevOps and Asana identities are labelled here too.
export function getProviderIdentityLabel(
  identity: TaskProviderIdentity | null | undefined
): string | null {
  if (!identity) {
    return null
  }
  switch (identity.provider) {
    case 'github':
      return `${identity.owner}/${identity.repo}`
    case 'gitlab':
      return identity.namespace && identity.project
        ? `${identity.namespace}/${identity.project}`
        : (identity.projectId ?? null)
    case 'linear':
    case 'asana':
      return identity.workspaceName ?? identity.workspaceId ?? null
    case 'jira':
      return identity.siteUrl ?? identity.siteId ?? null
    case 'azure-devops':
      return identity.repository ?? identity.project ?? identity.organizationUrl ?? null
  }
}
