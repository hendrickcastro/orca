import { describe, expect, it } from 'vitest'
import { selectRepoReferenceChips } from './RepoReferenceChips'
import { describeSingleRepoReference } from './NewWorkspaceComposerInstructionsSection'

const repoScope = { kind: 'repo' as const, repoId: 'api', repoName: 'api' }

describe('repository reference chips', () => {
  it('keeps only repository skills and workflows, workflows after skills', () => {
    const chips = selectRepoReferenceChips([
      {
        kind: 'skill',
        scope: { kind: 'global' },
        name: 'global-skill',
        token: '@skill:global-skill'
      },
      {
        kind: 'workflow',
        scope: repoScope,
        name: 'bugfix-asana',
        token: '@workflow:api/bugfix-asana'
      },
      { kind: 'skill', scope: repoScope, name: 'tdd', token: '@skill:api/tdd' },
      { kind: 'doc', scope: repoScope, name: 'README.md', token: '@api/README.md' }
    ])
    expect(chips.map((chip) => chip.token)).toEqual([
      '@skill:api/tdd',
      '@workflow:api/bugfix-asana'
    ])
  })

  it('turns a chip into a plain instruction with a repository-relative path', () => {
    expect(
      describeSingleRepoReference(
        {
          kind: 'skill',
          scope: repoScope,
          name: 'tdd',
          token: '@skill:api/tdd',
          path: 'D:/work/api/.claude/skills/tdd/SKILL.md'
        },
        'D:/work/api'
      )
    ).toBe('Use the "tdd" skill (.claude/skills/tdd/SKILL.md).')
    expect(
      describeSingleRepoReference(
        {
          kind: 'workflow',
          scope: repoScope,
          name: 'bugfix-asana',
          token: '@workflow:api/bugfix-asana',
          path: '.claude/workflows/bugfix-asana.js'
        },
        'D:/work/api'
      )
    ).toBe(
      'Run the "bugfix-asana" workflow (.claude/workflows/bugfix-asana.js) with the Workflow tool.'
    )
  })
})
