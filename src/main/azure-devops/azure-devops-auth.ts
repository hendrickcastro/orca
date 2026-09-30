import { Buffer } from 'node:buffer'
import { loadStoredAzureDevOpsSecrets, type AzureDevOpsStoredSecretEntry } from './credential-store'

export type AzureDevOpsAuthConfig = {
  apiBaseUrl: string | null
  pat: string | null
  accessToken: string | null
  username: string | null
}

function envValue(name: string): string | null {
  const value = process.env[name]?.trim() ?? ''
  return value.length > 0 ? value : null
}

export function getAzureDevOpsAuthConfig(): AzureDevOpsAuthConfig {
  return {
    apiBaseUrl: envValue('ORCA_AZURE_DEVOPS_API_BASE_URL'),
    pat: envValue('ORCA_AZURE_DEVOPS_TOKEN') ?? envValue('ORCA_AZURE_DEVOPS_PAT'),
    accessToken: envValue('ORCA_AZURE_DEVOPS_ACCESS_TOKEN'),
    username: envValue('ORCA_AZURE_DEVOPS_USERNAME')
  }
}

export function azureDevOpsTokenConfigured(config: AzureDevOpsAuthConfig): boolean {
  return Boolean(config.pat || config.accessToken)
}

export function basicAuthHeaders(username: string | null, pat: string): Record<string, string> {
  return { Authorization: `Basic ${Buffer.from(`${username ?? ''}:${pat}`).toString('base64')}` }
}

function envAuthHeaders(config: AzureDevOpsAuthConfig): Record<string, string> {
  if (config.accessToken) {
    return { Authorization: `Bearer ${config.accessToken}` }
  }
  return config.pat ? basicAuthHeaders(config.username, config.pat) : {}
}

/** Organization names are case-insensitive, so `dev.azure.com/Org` covers `dev.azure.com/org/project`. */
export function isAzureDevOpsOrganizationAncestor(
  organizationUrl: string,
  baseUrl: string
): boolean {
  try {
    const organization = new URL(organizationUrl)
    const target = new URL(baseUrl)
    const organizationPath = organization.pathname.replace(/\/+$/, '').toLowerCase()
    const targetPath = target.pathname.replace(/\/+$/, '').toLowerCase()
    return (
      organization.origin.toLowerCase() === target.origin.toLowerCase() &&
      (targetPath === organizationPath || targetPath.startsWith(`${organizationPath}/`))
    )
  } catch {
    return false
  }
}

export function findAzureDevOpsOrganizationFor<T extends { organizationUrl: string }>(
  entries: readonly T[],
  baseUrl: string
): T | null {
  let best: T | null = null
  for (const entry of entries) {
    if (
      isAzureDevOpsOrganizationAncestor(entry.organizationUrl, baseUrl) &&
      (!best || entry.organizationUrl.length > best.organizationUrl.length)
    ) {
      best = entry
    }
  }
  return best
}

function storedEntryFor(baseUrl: string): AzureDevOpsStoredSecretEntry | null {
  try {
    return findAzureDevOpsOrganizationFor(loadStoredAzureDevOpsSecrets(), baseUrl)
  } catch {
    // Decryption denied or unavailable: fall through as unauthenticated.
    return null
  }
}

// Env vars win so existing headless/SSH setups keep working; otherwise each
// request uses the saved credential of the organization that owns its URL.
export function azureDevOpsAuthHeadersFor(baseUrl: string): Record<string, string> {
  const env = getAzureDevOpsAuthConfig()
  if (azureDevOpsTokenConfigured(env)) {
    return envAuthHeaders(env)
  }
  const stored = storedEntryFor(baseUrl)
  return stored ? basicAuthHeaders(stored.username, stored.pat) : {}
}
