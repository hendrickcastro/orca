import { Buffer } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type SecretEntry = { organizationUrl: string; username: string | null; pat: string }
const secrets = vi.hoisted(() => {
  const entries: SecretEntry[] = []
  return { entries }
})
vi.mock('./credential-store', () => ({ loadStoredAzureDevOpsSecrets: () => secrets.entries }))

import { azureDevOpsAuthHeadersFor, isAzureDevOpsOrganizationAncestor } from './azure-devops-auth'

function decode(header: Record<string, string>): string {
  return Buffer.from(header.Authorization.replace(/^Basic /, ''), 'base64').toString()
}

const OLD_ENV = process.env

describe('Azure DevOps auth per organization', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV }
    for (const name of Object.keys(process.env).filter((key) =>
      key.startsWith('ORCA_AZURE_DEVOPS_')
    )) {
      delete process.env[name]
    }
    secrets.entries = [
      {
        organizationUrl: 'https://dev.azure.com/RockTheSport2025',
        username: null,
        pat: 'front-pat'
      },
      {
        organizationUrl: 'https://dev.azure.com/rockthesportup',
        username: 'me@x.com',
        pat: 'back-pat'
      }
    ]
  })
  afterEach(() => {
    process.env = OLD_ENV
  })

  it('picks the saved token of the organization that owns the request URL', () => {
    expect(
      decode(azureDevOpsAuthHeadersFor('https://dev.azure.com/rockthesport2025/fe-manager'))
    ).toBe(':front-pat')
    expect(
      decode(azureDevOpsAuthHeadersFor('https://dev.azure.com/RockTheSportUp/BKD-ManagerServiceV2'))
    ).toBe('me@x.com:back-pat')
    expect(azureDevOpsAuthHeadersFor('https://dev.azure.com/other/project')).toEqual({})
  })

  it('lets environment variables win over saved organizations', () => {
    process.env.ORCA_AZURE_DEVOPS_TOKEN = 'env-pat'
    expect(decode(azureDevOpsAuthHeadersFor('https://dev.azure.com/rockthesportup/x'))).toBe(
      ':env-pat'
    )
  })

  it('matches organizations on path segments, not prefixes', () => {
    expect(
      isAzureDevOpsOrganizationAncestor('https://dev.azure.com/org', 'https://dev.azure.com/org/p')
    ).toBe(true)
    expect(
      isAzureDevOpsOrganizationAncestor('https://dev.azure.com/org', 'https://dev.azure.com/org2/p')
    ).toBe(false)
    expect(
      isAzureDevOpsOrganizationAncestor('https://dev.azure.com/org', 'https://other.com/org/p')
    ).toBe(false)
  })

  it('treats org.visualstudio.com and dev.azure.com/org as the same organization', () => {
    expect(
      isAzureDevOpsOrganizationAncestor(
        'https://dev.azure.com/Org',
        'https://org.visualstudio.com/p'
      )
    ).toBe(true)
    expect(
      isAzureDevOpsOrganizationAncestor(
        'https://org.visualstudio.com',
        'https://dev.azure.com/org/p'
      )
    ).toBe(true)
    expect(
      isAzureDevOpsOrganizationAncestor(
        'https://dev.azure.com/org',
        'https://other.visualstudio.com/p'
      )
    ).toBe(false)
  })
})
