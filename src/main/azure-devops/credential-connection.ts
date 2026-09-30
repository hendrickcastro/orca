import type {
  AzureDevOpsConnectArgs,
  AzureDevOpsConnectResult,
  AzureDevOpsConnectionStatus
} from '../../shared/azure-devops-credentials'
import { cancelUnreadResponseBody } from '../lib/unread-response-body'
import {
  azureDevOpsApiVersionForOrigin,
  isAzureDevOpsPreviewVersionRejection,
  normalizeAzureDevOpsApiBaseUrl
} from './azure-devops-api-request'
import {
  azureDevOpsTokenConfigured,
  basicAuthHeaders,
  getAzureDevOpsAuthConfig
} from './azure-devops-auth'
import {
  getStoredAzureDevOpsOrganizations,
  hasStoredAzureDevOpsCredential,
  removeAzureDevOpsOrganization,
  saveAzureDevOpsOrganization
} from './credential-store'

const VERIFY_TIMEOUT_MS = 8000

type VerifyResult =
  | { ok: true; account: string | null }
  | { ok: false; reason: 'rejected' | 'unreachable'; status: number | null }

const ANONYMOUS_IDENTITY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

/** Accepts `https://dev.azure.com/org`, `dev.azure.com/org/project`, a bare `org`, or a Server collection URL. */
export function normalizeAzureDevOpsOrganizationUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(trimmed)) {
    return `https://dev.azure.com/${trimmed}`
  }
  let url: URL
  try {
    url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null
  }
  const segments = url.pathname.split('/').filter(Boolean)
  // Why: a cloud PAT authenticates per organization, so keep only the org segment of a pasted project or repo URL.
  if (url.hostname.toLowerCase() === 'dev.azure.com') {
    return segments[0] ? `https://dev.azure.com/${segments[0]}` : null
  }
  if (url.hostname.toLowerCase().endsWith('.visualstudio.com')) {
    return url.origin
  }
  const gitIndex = segments.indexOf('_git')
  const kept = gitIndex > 1 ? segments.slice(0, gitIndex - 1) : segments
  return normalizeAzureDevOpsApiBaseUrl(`${url.origin}/${kept.join('/')}`)
}

function displayName(user: unknown): string | null {
  if (!user || typeof user !== 'object') {
    return null
  }
  for (const key of ['providerDisplayName', 'customDisplayName']) {
    const value: unknown = key in user ? Reflect.get(user, key) : null
    if (typeof value === 'string' && value) {
      return value
    }
  }
  return null
}

// Why: Azure DevOps answers a wrong or foreign token with the public "Anonymous" identity (HTTP 200), not a 401.
function isAnonymousIdentity(user: unknown): boolean {
  if (!user || typeof user !== 'object') {
    return true
  }
  const descriptor: unknown = 'descriptor' in user ? user.descriptor : null
  const id: unknown = 'id' in user ? user.id : null
  return (
    (typeof descriptor === 'string' && descriptor.startsWith('System:PublicAccess')) ||
    id === ANONYMOUS_IDENTITY_ID
  )
}

async function requestConnectionData(
  organizationUrl: string,
  username: string | null,
  pat: string,
  apiVersion: string
): Promise<Response> {
  const url = new URL(`${organizationUrl}/_apis/connectionData`)
  url.searchParams.set('api-version', apiVersion)
  return fetch(url, {
    headers: { Accept: 'application/json', ...basicAuthHeaders(username, pat) },
    // Why: an unauthenticated request can be redirected to the sign-in page, which must read as rejected.
    redirect: 'manual',
    signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS)
  })
}

async function verifyOrganization(
  organizationUrl: string,
  username: string | null,
  pat: string
): Promise<VerifyResult> {
  const apiVersion = azureDevOpsApiVersionForOrigin(new URL(organizationUrl).origin)
  let response: Response
  try {
    response = await requestConnectionData(organizationUrl, username, pat, apiVersion)
    // connectionData is preview-only on Azure DevOps Services and on current Servers.
    if (response.status === 400 && !apiVersion.endsWith('-preview')) {
      const body = await response.text()
      if (!isAzureDevOpsPreviewVersionRejection(response.status, body)) {
        return { ok: false, reason: 'unreachable', status: response.status }
      }
      response = await requestConnectionData(
        organizationUrl,
        username,
        pat,
        `${apiVersion}-preview`
      )
    }
  } catch {
    return { ok: false, reason: 'unreachable', status: null }
  }
  const signInRedirect = response.status >= 300 && response.status < 400
  if (!response.ok || response.status === 203 || signInRedirect) {
    await cancelUnreadResponseBody(response)
    const rejected =
      signInRedirect ||
      response.status === 203 ||
      response.status === 401 ||
      response.status === 403
    return { ok: false, reason: rejected ? 'rejected' : 'unreachable', status: response.status }
  }
  try {
    const body: unknown = await response.json()
    const user =
      body && typeof body === 'object' && 'authenticatedUser' in body
        ? body.authenticatedUser
        : null
    return isAnonymousIdentity(user)
      ? { ok: false, reason: 'rejected', status: response.status }
      : { ok: true, account: displayName(user) }
  } catch {
    return { ok: false, reason: 'rejected', status: response.status }
  }
}

export async function connectAzureDevOps(
  input: AzureDevOpsConnectArgs
): Promise<AzureDevOpsConnectResult> {
  const organizationUrl = normalizeAzureDevOpsOrganizationUrl(input.organizationUrl)
  if (!organizationUrl) {
    return {
      ok: false,
      error: 'Enter the organization, for example https://dev.azure.com/my-organization.'
    }
  }
  const pat = input.pat.trim()
  if (!pat) {
    return { ok: false, error: 'Enter a personal access token.' }
  }
  const username = input.username?.trim() || null
  const result = await verifyOrganization(organizationUrl, username, pat)
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === 'rejected'
          ? `Azure DevOps rejected this token for ${organizationUrl}. Check that it belongs to this organization and has Code (Read) access.`
          : `Could not reach ${organizationUrl}. Check the organization URL and your connection.`
    }
  }
  saveAzureDevOpsOrganization({ organizationUrl, username, pat, account: result.account })
  return { ok: true, organizationUrl, account: result.account }
}

export function disconnectAzureDevOps(organizationUrl: string): void {
  removeAzureDevOpsOrganization(organizationUrl)
}

// Reads env vars and plaintext metadata only, so the Settings card never triggers a keychain prompt.
export function getAzureDevOpsConnectionStatus(): AzureDevOpsConnectionStatus {
  const organizations = hasStoredAzureDevOpsCredential() ? getStoredAzureDevOpsOrganizations() : []
  if (azureDevOpsTokenConfigured(getAzureDevOpsAuthConfig())) {
    return { source: 'environment', organizations }
  }
  return { source: organizations.length > 0 ? 'stored' : 'none', organizations }
}
