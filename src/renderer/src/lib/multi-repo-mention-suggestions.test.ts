import { describe, expect, it } from 'vitest'
import {
  buildMultiRepoReferenceToken,
  type MultiRepoReference
} from './multi-repo-prompt-references'
import {
  rankMultiRepoMentionSuggestions,
  toMultiRepoFileEntry,
  type MultiRepoMentionCatalog
} from './multi-repo-mention-suggestions'

const front = { kind: 'repo', repoId: 'front', repoName: 'front' } as const
const back = { kind: 'repo', repoId: 'back', repoName: 'back' } as const

function named(kind: MultiRepoReference['kind'], scope: MultiRepoReference['scope'], name: string) {
  return { kind, scope, name, token: buildMultiRepoReferenceToken(kind, scope, name) }
}

const catalog: MultiRepoMentionCatalog = {
  references: [
    named('doc', front, 'docs/api.md'),
    named('skill', { kind: 'global' }, 'tdd'),
    named('mcp', back, 'sql'),
    named('skill', back, 'api-contract')
  ],
  files: [
    toMultiRepoFileEntry(front, 'docs/api.md'),
    toMultiRepoFileEntry(front, 'src/api/client.ts'),
    toMultiRepoFileEntry(back, 'src/api/routes.ts')
  ]
}

describe('rankMultiRepoMentionSuggestions', () => {
  it('lists skills, MCP servers and docs, but no files, for a bare @', () => {
    // Why repository skills first: global ones from every agent home would otherwise fill the group.
    expect(rankMultiRepoMentionSuggestions('', catalog).map((entry) => entry.token)).toEqual([
      '@skill:back/api-contract',
      '@skill:tdd',
      '@mcp:back/sql',
      '@front/docs/api.md'
    ])
  })

  it('lists repository workflows and narrows to them with workflow:', () => {
    const withWorkflow = {
      ...catalog,
      references: [
        ...catalog.references,
        {
          kind: 'workflow' as const,
          scope: { kind: 'repo' as const, repoId: 'back', repoName: 'back' },
          name: 'bugfix-asana',
          token: '@workflow:back/bugfix-asana',
          path: '.claude/workflows/bugfix-asana.js'
        }
      ]
    }
    expect(rankMultiRepoMentionSuggestions('workflow:', withWorkflow).map((e) => e.token)).toEqual([
      '@workflow:back/bugfix-asana'
    ])
    expect(rankMultiRepoMentionSuggestions('', withWorkflow).map((e) => e.token)).toContain(
      '@workflow:back/bugfix-asana'
    )
  })

  it('narrows to one kind with a skill: or mcp: prefix', () => {
    expect(rankMultiRepoMentionSuggestions('skill:api', catalog).map((e) => e.token)).toEqual([
      '@skill:back/api-contract'
    ])
    expect(rankMultiRepoMentionSuggestions('mcp:', catalog).map((e) => e.token)).toEqual([
      '@mcp:back/sql'
    ])
  })

  it('ranks files from every repository and skips files already listed as docs', () => {
    const tokens = rankMultiRepoMentionSuggestions('api', catalog).map((entry) => entry.token)
    expect(tokens).toContain('@front/src/api/client.ts')
    expect(tokens).toContain('@back/src/api/routes.ts')
    expect(tokens.filter((token) => token === '@front/docs/api.md')).toHaveLength(1)
  })
})
