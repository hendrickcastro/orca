import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('./credential-store', () => ({
  getStoredAzureDevOpsOrganizations: () => [],
  hasStoredAzureDevOpsCredential: () => false,
  removeAzureDevOpsOrganization: vi.fn(),
  saveAzureDevOpsOrganization: store.save
}))

import { connectAzureDevOps, normalizeAzureDevOpsOrganizationUrl } from './credential-connection'

describe('Azure DevOps organization connection', () => {
  beforeEach(() => store.save.mockClear())
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes organization names, project URLs and Server collections', () => {
    expect(normalizeAzureDevOpsOrganizationUrl('RockTheSport2025')).toBe(
      'https://dev.azure.com/RockTheSport2025'
    )
    expect(
      normalizeAzureDevOpsOrganizationUrl('https://user@dev.azure.com/rockthesportup/BKD/_git/BKD')
    ).toBe('https://dev.azure.com/rockthesportup')
    expect(normalizeAzureDevOpsOrganizationUrl('acme.visualstudio.com/Project')).toBe(
      'https://acme.visualstudio.com'
    )
    expect(
      normalizeAzureDevOpsOrganizationUrl('https://ado.example.com/tfs/Coll/Proj/_git/repo')
    ).toBe('https://ado.example.com/tfs/Coll')
    expect(normalizeAzureDevOpsOrganizationUrl('ftp://x')).toBeNull()
  })

  it('saves the organization only after Azure DevOps accepts the token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ authenticatedUser: { providerDisplayName: 'Hendrick' } })
    )
    await expect(
      connectAzureDevOps({ organizationUrl: 'rockthesportup', username: '', pat: ' pat ' })
    ).resolves.toEqual({
      ok: true,
      organizationUrl: 'https://dev.azure.com/rockthesportup',
      account: 'Hendrick'
    })
    expect(store.save).toHaveBeenCalledWith({
      organizationUrl: 'https://dev.azure.com/rockthesportup',
      username: null,
      pat: 'pat',
      account: 'Hendrick'
    })
  })

  it('treats the sign-in redirect as a rejected token and saves nothing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: '/signin' } })
    )
    const result = await connectAzureDevOps({ organizationUrl: 'rockthesportup', pat: 'bad' })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain('rejected')
    expect(store.save).not.toHaveBeenCalled()
  })

  it('retries connectionData with the preview api-version Azure DevOps requires', async () => {
    const versions: (string | null)[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const version = new URL(String(input)).searchParams.get('api-version')
      versions.push(version)
      return version?.endsWith('-preview')
        ? Response.json({
            authenticatedUser: {
              id: 'user-1',
              descriptor: 'aad.x',
              providerDisplayName: 'Hendrick'
            }
          })
        : Response.json(
            { typeKey: 'VssInvalidPreviewVersionException', message: 'under preview' },
            { status: 400 }
          )
    })
    await expect(
      connectAzureDevOps({ organizationUrl: 'rockthesportup', pat: 'pat' })
    ).resolves.toMatchObject({ ok: true, account: 'Hendrick' })
    expect(versions).toEqual(['7.1', '7.1-preview'])
  })

  it('rejects a token Azure DevOps answers with the anonymous public identity', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        authenticatedUser: {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          descriptor: 'System:PublicAccess;aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          providerDisplayName: 'Anonymous'
        }
      })
    )
    const result = await connectAzureDevOps({ organizationUrl: 'rockthesportup', pat: 'bad' })
    expect(!result.ok && result.error).toContain('rejected')
    expect(store.save).not.toHaveBeenCalled()
  })
})
