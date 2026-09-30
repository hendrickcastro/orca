import { describe, expect, it, vi } from 'vitest'
import {
  buildMultiRepoCoordinatorPrompt,
  isMultiRepoLocalRepository,
  MultiRepoWorkspaceCreation
} from './multi-repo-workspace-creation'
import { repo, worktree, fixture } from './multi-repo-workspace-test-fixtures'

describe('multi-repository feature creation', () => {
  const request = {
    name: 'Patient search',
    branch: 'feature/patient-search',
    prompt: 'Implement search in the UI and API.',
    repos: [repo('frontend', 'D:\\_ALGORITXIA\\frontend'), repo('backend', 'E:\\Services\\backend')]
  }

  it('uses separate repository roots, shared task lineage and each repository base ref', async () => {
    const api = fixture()
    const creation = new MultiRepoWorkspaceCreation({
      ...request,
      repos: [request.repos[0], { ...request.repos[1], worktreeBaseRef: 'develop' }]
    })
    const result = await creation.create(api, vi.fn())
    expect(
      api.worktrees.create.mock.calls.map(([args]) => [
        args.repoId,
        args.baseBranch,
        args.branchNameOverride,
        args.parentWorkspace,
        args.setupDecision
      ])
    ).toEqual([
      ['frontend', 'main', 'feature/patient-search', 'folder:feature', 'skip'],
      ['backend', 'develop', 'feature/patient-search', 'folder:feature', 'skip']
    ])
    expect(result.folderPath).toBe('/worktrees/frontend')
    expect(result.comment).toContain('/worktrees/backend')
    expect(result.comment).not.toContain('E:\\\\Services')
  })

  it('keeps the first worktree when the second fails and retries only unfinished work', async () => {
    const api = fixture()
    api.worktrees.create
      .mockImplementationOnce(async (args) => ({ worktree: worktree(args) }))
      .mockRejectedValueOnce(new Error('Branch already exists'))
    const creation = new MultiRepoWorkspaceCreation(request)
    await expect(creation.create(api, vi.fn())).rejects.toThrow('Branch already exists')
    expect(creation.members.map((member) => member.repo.id)).toEqual(['frontend'])
    expect(creation.workspace?.comment).toContain('/worktrees/frontend')
    await creation.create(api, vi.fn())
    expect(api.worktrees.create.mock.calls.map(([args]) => args.repoId)).toEqual([
      'frontend',
      'backend',
      'backend'
    ])
    expect(api.projectGroups.create).toHaveBeenCalledTimes(1)
    expect(api.folderWorkspaces.create).toHaveBeenCalledTimes(1)
  })

  it('repairs a metadata write failure without duplicating the confirmed worktree', async () => {
    const api = fixture()
    api.folderWorkspaces.update.mockRejectedValueOnce(new Error('Save failed'))
    const creation = new MultiRepoWorkspaceCreation(request)
    await expect(creation.create(api, vi.fn())).rejects.toThrow('Save failed')
    await creation.create(api, vi.fn())
    expect(api.worktrees.create.mock.calls.map(([args]) => args.repoId)).toEqual([
      'frontend',
      'backend'
    ])
    expect(creation.workspace?.comment).toContain('/worktrees/backend')
  })

  it('rejects unsupported hosts and duplicate selections before any mutation', () => {
    for (const candidate of [
      { ...request.repos[1], connectionId: 'server' },
      { ...request.repos[1], executionHostId: 'runtime:server' as const },
      { ...request.repos[1], kind: 'folder' as const },
      repo('backend', '\\\\wsl.localhost\\Ubuntu\\home\\backend')
    ]) {
      expect(isMultiRepoLocalRepository(candidate)).toBe(false)
      expect(
        () => new MultiRepoWorkspaceCreation({ ...request, repos: [request.repos[0], candidate] })
      ).toThrow('on this computer')
    }
    expect(
      () =>
        new MultiRepoWorkspaceCreation({ ...request, repos: [request.repos[0], request.repos[0]] })
    ).toThrow('different repositories')
  })

  it('gives the coordinator exact feature paths and a cross-repository contract', () => {
    const args = { repoId: 'backend', name: 'search' }
    const prompt = buildMultiRepoCoordinatorPrompt(
      'search',
      [{ repo: request.repos[1], worktree: worktree(args, 'E:\\Work Trees\\backend') }],
      'Add search'
    )
    expect(prompt).toContain('E:\\\\Work Trees\\\\backend')
    expect(prompt).toContain('request and response shapes')
    expect(prompt).toContain('not the original checkouts')
    expect(prompt).toContain('Add search')
  })
})
