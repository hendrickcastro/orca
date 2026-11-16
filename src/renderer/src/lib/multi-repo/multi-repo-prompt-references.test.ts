import { describe, expect, it } from 'vitest'
import {
  buildMultiRepoReferenceToken,
  collectMentionedReferences,
  describeMultiRepoReferences,
  findMultiRepoMentionQuery,
  type MultiRepoReference
} from './multi-repo-prompt-references'

const front = { kind: 'repo', repoId: 'front', repoName: 'Web App' } as const

function reference(
  kind: MultiRepoReference['kind'],
  scope: MultiRepoReference['scope'],
  name: string,
  path?: string
): MultiRepoReference {
  return { kind, scope, name, path, token: buildMultiRepoReferenceToken(kind, scope, name) }
}

describe('multi-repository prompt references', () => {
  it('builds tokens that name the kind and owning repository', () => {
    expect(buildMultiRepoReferenceToken('skill', { kind: 'global' }, 'tdd')).toBe('@skill:tdd')
    expect(buildMultiRepoReferenceToken('mcp', front, 'playwright')).toBe('@mcp:Web-App/playwright')
    expect(buildMultiRepoReferenceToken('file', front, 'src/api client.ts')).toBe(
      '@Web-App/src/api-client.ts'
    )
  })

  it('detects a mention query containing path and scope characters', () => {
    expect(findMultiRepoMentionQuery('Fix @Web-App/src/a_b.ts', 23)).toEqual({
      atIndex: 4,
      query: 'Web-App/src/a_b.ts'
    })
    expect(findMultiRepoMentionQuery('use @skill:td', 13)).toEqual({
      atIndex: 4,
      query: 'skill:td'
    })
    expect(findMultiRepoMentionQuery('mail me@example', 15)).toBeNull()
  })

  it('keeps only references still present as whole tokens', () => {
    const tdd = reference('skill', { kind: 'global' }, 'tdd')
    const tddx = reference('skill', { kind: 'global' }, 'tdd-extra')
    const removed = reference('mcp', { kind: 'global' }, 'sql')
    expect(
      collectMentionedReferences('Use @skill:tdd-extra, then @skill:tdd.', [tdd, tddx, removed])
    ).toEqual([tdd, tddx])
    expect(collectMentionedReferences('Use @skill:tdd-extra', [tdd])).toEqual([])
  })

  it('resolves repository paths to the task worktrees and leaves global ones intact', () => {
    const members = [
      { repo: { id: 'front', path: 'D:\\Front' }, worktree: { path: 'D:\\wt\\front' } }
    ]
    const lines = describeMultiRepoReferences(
      [
        reference('file', front, 'src/api.ts', 'src/api.ts'),
        reference('skill', front, 'deploy', 'D:\\Front\\.claude\\skills\\deploy\\SKILL.md'),
        reference(
          'skill',
          { kind: 'global' },
          'tdd',
          'C:\\Users\\me\\.claude\\skills\\tdd\\SKILL.md'
        )
      ],
      members
    ).join('\n')
    expect(lines).toContain('D:\\wt\\front\\src\\api.ts')
    expect(lines).toContain('D:\\wt\\front\\.claude\\skills\\deploy\\SKILL.md')
    expect(lines).toContain('C:\\Users\\me\\.claude\\skills\\tdd\\SKILL.md')
    expect(lines).not.toContain('D:\\Front')
  })

  it('adds nothing when the request mentions no references', () => {
    expect(describeMultiRepoReferences([], [])).toEqual([])
  })
})
