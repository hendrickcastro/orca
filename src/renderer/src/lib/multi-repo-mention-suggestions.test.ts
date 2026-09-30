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
    expect(rankMultiRepoMentionSuggestions('', catalog).map((entry) => entry.token)).toEqual([
      '@skill:tdd',
      '@skill:back/api-contract',
      '@mcp:back/sql',
      '@front/docs/api.md'
    ])
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
