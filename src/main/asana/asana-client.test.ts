import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state: {
    fetch: ReturnType<typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>>
    token: string | null
    saved: string[]
  } = {
    fetch: vi.fn<(url: string, init: RequestInit) => Promise<Response>>(),
    token: 'stored-token',
    saved: []
  }
  return state
})

vi.mock('electron', () => ({ net: { fetch: mocks.fetch } }))
vi.mock('./asana-token-store', () => ({
  hasAsanaToken: () => mocks.token !== null,
  readAsanaToken: () => mocks.token,
  saveAsanaToken: (token: string) => mocks.saved.push(token),
  clearAsanaToken: () => {
    mocks.token = null
  }
}))

import { connectAsana, createAsanaTask, listAsanaTasks } from './asana-client'

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function lastRequest(): { url: URL; init: RequestInit } {
  const call = mocks.fetch.mock.calls.at(-1)
  if (!call) {
    throw new Error('Asana was not called')
  }
  return { url: new URL(call[0]), init: call[1] }
}

describe('Asana client', () => {
  beforeEach(() => {
    mocks.fetch.mockReset()
    mocks.token = 'stored-token'
    mocks.saved = []
  })

  it('lists my tasks, including recently completed ones, newest created first', async () => {
    mocks.fetch.mockResolvedValue(
      respond({
        data: [
          { gid: '1', name: 'Old', created_at: '2026-01-01T00:00:00Z', completed: true },
          {
            gid: '2',
            name: 'New',
            created_at: '2026-02-01T00:00:00Z',
            completed: false,
            assignee: { name: 'Ana' },
            projects: [{ name: 'Portal' }],
            permalink_url: 'https://app.asana.com/0/9/2'
          }
        ]
      })
    )

    const result = await listAsanaTasks({ workspaceGid: 'ws-1', scope: 'my-tasks' })

    const { url, init } = lastRequest()
    expect(url.pathname).toBe('/api/1.0/tasks')
    expect(url.searchParams.get('assignee')).toBe('me')
    expect(url.searchParams.get('workspace')).toBe('ws-1')
    // Why: a past timestamp (not `now`) is what makes Asana include completed tasks.
    expect(Date.parse(url.searchParams.get('completed_since') ?? '')).toBeLessThan(Date.now())
    expect(url.searchParams.get('opt_fields')).toContain('completed')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer stored-token')
    expect(result.tasks.map((task) => [task.name, task.completed])).toEqual([
      ['New', false],
      ['Old', true]
    ])
    expect(result.tasks[0]).toMatchObject({ assignee: 'Ana', projects: ['Portal'] })
  })

  it('follows Asana pagination before sorting', async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        respond({
          data: [{ gid: '1', name: 'First page', created_at: '2026-01-01T00:00:00Z' }],
          next_page: { offset: 'page-2' }
        })
      )
      .mockResolvedValueOnce(
        respond({
          data: [{ gid: '2', name: 'Second page', created_at: '2026-03-01T00:00:00Z' }],
          next_page: null
        })
      )

    const result = await listAsanaTasks({ workspaceGid: 'ws-1', scope: 'my-tasks' })

    expect(mocks.fetch).toHaveBeenCalledTimes(2)
    expect(lastRequest().url.searchParams.get('offset')).toBe('page-2')
    expect(result.tasks.map((task) => task.name)).toEqual(['Second page', 'First page'])
  })

  it('lists a project without the assignee filter', async () => {
    mocks.fetch.mockResolvedValue(respond({ data: [] }))
    await listAsanaTasks({ workspaceGid: 'ws-1', scope: 'project', projectGid: 'p-1' })
    const { url } = lastRequest()
    expect(url.searchParams.get('project')).toBe('p-1')
    expect(url.searchParams.has('assignee')).toBe(false)
  })

  it('creates a task in the project, assigned to me', async () => {
    mocks.fetch.mockResolvedValue(respond({ data: { gid: '5', name: 'Write docs' } }))
    const result = await createAsanaTask({
      workspaceGid: 'ws-1',
      name: ' Write docs ',
      notes: 'Details',
      projectGid: 'p-1',
      assignToMe: true,
      dueOn: '2026-10-15'
    })
    const { init } = lastRequest()
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      data: {
        name: 'Write docs',
        notes: 'Details',
        projects: ['p-1'],
        assignee: 'me',
        due_on: '2026-10-15'
      }
    })
    expect(result).toMatchObject({ ok: true, task: { gid: '5' } })
  })

  it('explains a rejected token', async () => {
    mocks.fetch.mockResolvedValue(respond({ errors: [{ message: 'Not Authorized' }] }, 401))
    const result = await listAsanaTasks({ workspaceGid: 'ws-1', scope: 'my-tasks' })
    expect(result.error).toContain('rejected the personal access token')
  })

  it('saves a token only after Asana accepts it', async () => {
    mocks.fetch.mockResolvedValueOnce(respond({ errors: [{ message: 'bad' }] }, 401))
    expect((await connectAsana('wrong')).ok).toBe(false)
    expect(mocks.saved).toEqual([])

    mocks.fetch.mockResolvedValueOnce(
      respond({ data: { name: 'Ana', workspaces: [{ gid: 'ws-1', name: 'Acme' }] } })
    )
    const result = await connectAsana(' right ')
    expect(result).toMatchObject({
      ok: true,
      status: { userName: 'Ana', workspaces: [{ gid: 'ws-1', name: 'Acme' }] }
    })
    expect(mocks.saved).toEqual(['right'])
  })
})
