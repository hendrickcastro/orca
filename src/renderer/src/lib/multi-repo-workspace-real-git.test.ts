import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runProcess } from '../../../shared/child-process/run-process'
import { normalizeFolderWorkspaces } from '../../../shared/folder-workspaces'
import { MultiRepoWorkspaceCreation } from './multi-repo-workspace-creation'
import { fixture, repo, worktree } from './multi-repo-workspace-test-fixtures'

const temporaryRoots: string[] = []
afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  )
})

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await runProcess({ program: 'git', cwd, args, timeoutMs: 10_000 })
  if (result.code !== 0) {
    throw new Error(result.stderr)
  }
  return result.stdout.trim()
}

describe('multi-repository creation with real Git fixtures', () => {
  it('isolates edits in two worktrees, preserves originals and survives workspace normalization', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-multi-repo-'))
    temporaryRoots.push(root)
    const repos = [
      repo('frontend', join(root, 'Web Projects', 'frontend')),
      repo('backend', join(root, 'Services', 'backend'))
    ]
    for (const entry of repos) {
      await mkdir(entry.path, { recursive: true })
      await git(entry.path, ['init'])
      await git(entry.path, ['symbolic-ref', 'HEAD', 'refs/heads/main'])
      await writeFile(join(entry.path, 'contract.txt'), 'original')
      await git(entry.path, ['add', '.'])
      await git(entry.path, [
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        'commit',
        '-m',
        'Initial'
      ])
    }
    const api = fixture()
    api.worktrees.create.mockImplementation(async (args) => {
      const entry = repos.find((candidate) => candidate.id === args.repoId)
      if (!entry) {
        throw new Error('Unknown repository')
      }
      const path = join(root, 'Feature Worktrees', entry.id)
      await git(entry.path, [
        'worktree',
        'add',
        '-b',
        args.branchNameOverride!,
        path,
        args.baseBranch!
      ])
      return { worktree: worktree(args, path) }
    })
    const creation = new MultiRepoWorkspaceCreation({
      name: 'Search',
      branch: 'feature/search',
      repos,
      prompt: 'Implement both sides.'
    })
    const folder = await creation.create(api, vi.fn())
    for (const member of creation.members) {
      expect(await git(member.worktree.path, ['branch', '--show-current'])).toBe('feature/search')
      await writeFile(join(member.worktree.path, 'contract.txt'), 'feature')
      expect(await readFile(join(member.repo.path, 'contract.txt'), 'utf8')).toBe('original')
      expect(await git(member.repo.path, ['status', '--porcelain'])).toBe('')
      expect(await git(member.worktree.path, ['status', '--porcelain'])).toContain('contract.txt')
    }
    const restored = normalizeFolderWorkspaces(JSON.parse(JSON.stringify([folder])), [
      creation.group!
    ])
    expect(restored[0].folderPath).toBe(creation.members[0].worktree.path)
    expect(restored[0].comment).toContain(creation.members[1].worktree.path)
  })
})
