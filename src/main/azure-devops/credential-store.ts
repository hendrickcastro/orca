import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  CredentialDecryptionError,
  credentialFileHasContent,
  readStoredCredentialToken,
  writeCredentialFileAtomic,
  writeEncryptedCredential
} from '../integration-credential-file'
import type { AzureDevOpsOrganizationCredential } from '../../shared/azure-devops-credentials'

// Why: one secret envelope per machine keeps every organization's PAT behind a
// single decrypt, while the plaintext metadata lets status reads list them
// without touching the OS keychain.
type StoredMetadata = { version: 1; organizations: AzureDevOpsOrganizationCredential[] }

export type AzureDevOpsStoredSecretEntry = {
  organizationUrl: string
  username: string | null
  pat: string
}

type StoredSecret = { version: 1; organizations: AzureDevOpsStoredSecretEntry[] }

let cachedMetadata: StoredMetadata | null = null
let metadataLoaded = false
let cachedSecret: StoredSecret | null = null

function orcaDir(): string {
  return join(homedir(), '.orca')
}

function metadataPath(): string {
  return join(orcaDir(), 'azure-devops-credentials.json')
}

function secretPath(): string {
  return join(orcaDir(), 'azure-devops-credentials.enc')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function parseOrganizations<T>(
  value: unknown,
  parse: (entry: Record<string, unknown>) => T | null
): T[] {
  if (!Array.isArray(value)) {
    return []
  }
  const parsed: T[] = []
  for (const entry of value) {
    if (isRecord(entry)) {
      const next = parse(entry)
      if (next) {
        parsed.push(next)
      }
    }
  }
  return parsed
}

function readMetadata(): StoredMetadata | null {
  if (!existsSync(metadataPath())) {
    return null
  }
  try {
    const raw: unknown = JSON.parse(readFileSync(metadataPath(), 'utf-8'))
    const organizations = parseOrganizations(isRecord(raw) ? raw.organizations : null, (entry) => {
      const organizationUrl = asOptionalString(entry.organizationUrl)
      return organizationUrl
        ? {
            organizationUrl,
            username: asOptionalString(entry.username),
            account: asOptionalString(entry.account),
            updatedAt: asOptionalString(entry.updatedAt) ?? ''
          }
        : null
    })
    return { version: 1, organizations }
  } catch {
    return null
  }
}

export function getStoredAzureDevOpsOrganizations(): AzureDevOpsOrganizationCredential[] {
  if (!metadataLoaded) {
    cachedMetadata = readMetadata()
    metadataLoaded = true
  }
  return cachedMetadata?.organizations ?? []
}

/** Never decrypts, so it is safe on every status poll. */
export function hasStoredAzureDevOpsCredential(): boolean {
  return getStoredAzureDevOpsOrganizations().length > 0 && credentialFileHasContent(secretPath())
}

/** Decrypts once per session on the first real API call. Throws CredentialDecryptionError. */
export function loadStoredAzureDevOpsSecrets(): AzureDevOpsStoredSecretEntry[] {
  if (cachedSecret) {
    return cachedSecret.organizations
  }
  if (!existsSync(secretPath())) {
    return []
  }
  try {
    const token = readStoredCredentialToken('Azure DevOps', readFileSync(secretPath()))
    if (!token) {
      return []
    }
    const raw: unknown = JSON.parse(token)
    cachedSecret = {
      version: 1,
      organizations: parseOrganizations(isRecord(raw) ? raw.organizations : null, (entry) => {
        const organizationUrl = asOptionalString(entry.organizationUrl)
        const pat = asOptionalString(entry.pat)
        return organizationUrl && pat
          ? { organizationUrl, username: asOptionalString(entry.username), pat }
          : null
      })
    }
    return cachedSecret.organizations
  } catch (error) {
    if (error instanceof CredentialDecryptionError) {
      throw error
    }
    return []
  }
}

function sameOrganization(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

function write(secret: StoredSecret, metadata: StoredMetadata): void {
  if (!existsSync(orcaDir())) {
    mkdirSync(orcaDir(), { recursive: true })
  }
  writeEncryptedCredential('Azure DevOps', secretPath(), JSON.stringify(secret))
  writeCredentialFileAtomic(metadataPath(), Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'))
  cachedSecret = secret
  cachedMetadata = metadata
  metadataLoaded = true
}

export function saveAzureDevOpsOrganization(
  entry: AzureDevOpsStoredSecretEntry & { account: string | null }
): void {
  const secrets = loadStoredAzureDevOpsSecrets().filter(
    (existing) => !sameOrganization(existing.organizationUrl, entry.organizationUrl)
  )
  const organizations = getStoredAzureDevOpsOrganizations().filter(
    (existing) => !sameOrganization(existing.organizationUrl, entry.organizationUrl)
  )
  write(
    {
      version: 1,
      organizations: [
        ...secrets,
        { organizationUrl: entry.organizationUrl, username: entry.username, pat: entry.pat }
      ]
    },
    {
      version: 1,
      organizations: [
        ...organizations,
        {
          organizationUrl: entry.organizationUrl,
          username: entry.username,
          account: entry.account,
          updatedAt: new Date().toISOString()
        }
      ]
    }
  )
}

// Why: swallowing a non-ENOENT unlink failure would clear memory while the files
// survive, so the credential silently returns on the next launch.
function unlinkIfPresent(path: string): void {
  try {
    unlinkSync(path)
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error
    }
  }
}

export function removeAzureDevOpsOrganization(organizationUrl: string): void {
  const secrets = loadStoredAzureDevOpsSecrets().filter(
    (entry) => !sameOrganization(entry.organizationUrl, organizationUrl)
  )
  const organizations = getStoredAzureDevOpsOrganizations().filter(
    (entry) => !sameOrganization(entry.organizationUrl, organizationUrl)
  )
  if (organizations.length > 0) {
    write({ version: 1, organizations: secrets }, { version: 1, organizations })
    return
  }
  try {
    unlinkIfPresent(secretPath())
    unlinkIfPresent(metadataPath())
  } finally {
    cachedSecret = null
    cachedMetadata = null
    metadataLoaded = true
  }
}

/** @internal - tests need a clean in-memory cache between cases. */
export function _resetAzureDevOpsCredentialCache(): void {
  cachedMetadata = null
  metadataLoaded = false
  cachedSecret = null
}
