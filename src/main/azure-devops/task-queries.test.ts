import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetAzureDevOpsPreviewApiVersionCache } from './azure-devops-api-request'
import {
  buildAzureDevOpsWorkItemWiql,
  listAzureDevOpsPullRequests,
  listAzureDevOpsWorkItems
} from './task-queries'

const OLD_ENV = process.env
const OLD_FETCH = globalThis.fetch
const REMOTE = 'https://acme@dev.azure.com/acme/Portal%20Team/_git/web'

type Call = { url: URL; method: string; body: unknown }

function mockFetch(responses: (() => Response)[]): Call[] {
  const calls: Call[] = []
  globalThis.fetch = vi.fn<typeof fetch>(async (input, init) => {
    calls.push({
      url: new URL(input instanceof Request ? input.url : String(input)),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    })
    const respond = responses[calls.length - 1]
    return respond ? respond() : new Response('{}', { status: 500 })
  })
  return calls
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('Azure DevOps task queries', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV, ORCA_AZURE_DEVOPS_TOKEN: 'pat-token' }
    delete process.env.ORCA_AZURE_DEVOPS_API_BASE_URL
    _resetAzureDevOpsPreviewApiVersionCache()
  })

  afterEach(() => {
    process.env = OLD_ENV
    globalThis.fetch = OLD_FETCH
  })

  it('scopes WIQL to the project, excludes closed states and escapes quotes', () => {
    const wiql = buildAzureDevOpsWorkItemWiql("O'Neil Team", 'assigned-to-me')
    expect(wiql).toContain("[System.TeamProject] = 'O''Neil Team'")
    expect(wiql).toContain("[System.State] NOT IN ('Closed'")
    expect(wiql).toContain('[System.AssignedTo] = @Me')
    expect(buildAzureDevOpsWorkItemWiql('Portal', 'all-open')).not.toContain('@Me')
  })

  it('runs WIQL then a batch read and keeps the WIQL order', async () => {
    const calls = mockFetch([
      () => json({ workItems: [{ id: 7 }, { id: 3 }] }),
      () =>
        json({
          value: [
            {
              id: 3,
              fields: {
                'System.Title': 'Older',
                'System.WorkItemType': 'Bug',
                'System.State': 'Active',
                'System.ChangedDate': '2026-01-01T00:00:00Z'
              }
            },
            {
              id: 7,
              fields: {
                'System.Title': 'Newer',
                'System.WorkItemType': 'User Story',
                'System.State': 'New',
                'System.AssignedTo': { displayName: 'Ana' },
                'System.ChangedDate': '2026-02-01T00:00:00Z'
              }
            }
          ]
        })
    ])

    const result = await listAzureDevOpsWorkItems({
      repoId: 'repo-1',
      remoteUrl: REMOTE,
      filter: 'assigned-to-me'
    })

    expect(calls[0].method).toBe('POST')
    expect(calls[0].url.pathname).toBe('/acme/Portal%20Team/_apis/wit/wiql')
    expect(calls[1].url.pathname).toBe('/acme/Portal%20Team/_apis/wit/workitemsbatch')
    expect(calls[1].body).toMatchObject({ ids: [7, 3] })
    expect(result.error).toBeUndefined()
    expect(result.items.map((item) => [item.id, item.title, item.person])).toEqual([
      [7, 'Newer', 'Ana'],
      [3, 'Older', null]
    ])
    expect(result.items[0].url).toBe('https://dev.azure.com/acme/Portal%20Team/_workitems/edit/7')
  })

  it('reports rejected credentials as an auth error that names the needed scopes', async () => {
    mockFetch([() => json({ message: 'nope' }, 401)])
    const result = await listAzureDevOpsWorkItems({
      repoId: 'repo-1',
      remoteUrl: REMOTE,
      filter: 'all-open'
    })
    expect(result.items).toEqual([])
    expect(result.error?.type).toBe('auth')
    expect(result.error?.message).toContain('Work Items (Read)')
  })

  it('returns not_azure_devops without any request for other remotes', async () => {
    const calls = mockFetch([])
    const result = await listAzureDevOpsWorkItems({
      repoId: 'repo-1',
      remoteUrl: 'git@github.com:acme/web.git',
      filter: 'all-open'
    })
    expect(result.error?.type).toBe('not_azure_devops')
    expect(calls).toHaveLength(0)
  })

  it('lists my pull requests through the authenticated user id', async () => {
    const calls = mockFetch([
      () => json({ authenticatedUser: { id: 'user-42' } }),
      () =>
        json({
          value: [
            {
              pullRequestId: 12,
              title: 'Add search',
              status: 'active',
              createdBy: { displayName: 'Ana' },
              creationDate: '2026-03-01T00:00:00Z',
              sourceRefName: 'refs/heads/feature/search'
            }
          ]
        })
    ])

    const result = await listAzureDevOpsPullRequests({
      repoId: 'repo-1',
      remoteUrl: REMOTE,
      filter: 'created-by-me'
    })

    expect(calls[0].url.pathname).toBe('/acme/_apis/connectionData')
    expect(calls[1].url.pathname).toBe(
      '/acme/Portal%20Team/_apis/git/repositories/web/pullrequests'
    )
    expect(calls[1].url.searchParams.get('searchCriteria.creatorId')).toBe('user-42')
    expect(calls[1].url.searchParams.get('searchCriteria.status')).toBe('active')
    expect(result.items[0]).toMatchObject({
      kind: 'pull-request',
      id: 12,
      person: 'Ana',
      sourceBranch: 'feature/search',
      url: 'https://dev.azure.com/acme/Portal%20Team/_git/web/pullrequest/12'
    })
  })
})
