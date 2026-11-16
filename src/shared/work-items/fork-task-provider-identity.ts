export type AzureDevOpsTaskProviderIdentity = {
  provider: 'azure-devops'
  organizationUrl?: string | null
  project?: string | null
  repository?: string | null
}

export type AsanaTaskProviderIdentity = {
  provider: 'asana'
  workspaceId?: string | null
  workspaceName?: string | null
}

export type ForkTaskProviderIdentity = AzureDevOpsTaskProviderIdentity | AsanaTaskProviderIdentity
type ForkTaskProvider = ForkTaskProviderIdentity['provider']

export const FORK_TASK_PROVIDER_IDENTITY_FIELDS: Record<ForkTaskProvider, readonly string[]> = {
  'azure-devops': ['organizationUrl', 'project', 'repository'],
  asana: ['workspaceId', 'workspaceName']
}

export function normalizeForkTaskProviderIdentity(
  provider: ForkTaskProvider,
  raw: Record<string, unknown>
): ForkTaskProviderIdentity {
  switch (provider) {
    case 'azure-devops':
      return {
        provider,
        organizationUrl: normalizeNonEmptyString(raw.organizationUrl),
        project: normalizeNonEmptyString(raw.project),
        repository: normalizeNonEmptyString(raw.repository)
      }
    case 'asana':
      return {
        provider,
        workspaceId: normalizeNonEmptyString(raw.workspaceId),
        workspaceName: normalizeNonEmptyString(raw.workspaceName)
      }
  }
}

export function isStoredForkTaskProviderIdentity(
  provider: ForkTaskProvider,
  raw: Record<string, unknown>
): boolean {
  return FORK_TASK_PROVIDER_IDENTITY_FIELDS[provider].every(
    (key) => raw[key] === undefined || raw[key] === null || typeof raw[key] === 'string'
  )
}

export function forkTaskProviderIdentityCachePart(identity: ForkTaskProviderIdentity): string {
  switch (identity.provider) {
    case 'azure-devops':
      return [identity.organizationUrl, identity.project, identity.repository]
        .filter(Boolean)
        .join('/')
    case 'asana':
      return identity.workspaceId ?? ''
  }
}

function normalizeNonEmptyString(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed ? trimmed : null
}
