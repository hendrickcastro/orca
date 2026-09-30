import { QuickOpenPathRanker } from '../../../shared/quick-open-path-search'
import {
  buildMultiRepoReferenceToken,
  type MultiRepoReference,
  type MultiRepoReferenceKind,
  type MultiRepoReferenceScope
} from './multi-repo-prompt-references'

export type MultiRepoFileEntry = {
  /** Ranked text: `<repo>/<relative path>`, so a query can start with the repo name. */
  key: string
  scope: Extract<MultiRepoReferenceScope, { kind: 'repo' }>
  path: string
}

export type MultiRepoMentionCatalog = {
  /** Skills, MCP servers and docs. */
  references: readonly MultiRepoReference[]
  files: readonly MultiRepoFileEntry[]
}

export const EMPTY_MULTI_REPO_MENTION_CATALOG: MultiRepoMentionCatalog = {
  references: [],
  files: []
}

const GROUP_LIMIT: Record<MultiRepoReferenceKind, number> = { skill: 8, mcp: 6, doc: 8, file: 10 }
const NAMED_KINDS: readonly MultiRepoReferenceKind[] = ['skill', 'mcp', 'doc']

export function toMultiRepoFileEntry(
  scope: MultiRepoFileEntry['scope'],
  path: string
): MultiRepoFileEntry {
  return { key: buildMultiRepoReferenceToken('file', scope, path).slice(1), scope, path }
}

/** Groups stay in skill → MCP → doc → file order; `skill:` and `mcp:` narrow to one kind. */
export function rankMultiRepoMentionSuggestions(
  rawQuery: string,
  catalog: MultiRepoMentionCatalog
): MultiRepoReference[] {
  const prefix = /^(skill|mcp):/i.exec(rawQuery)
  const onlyKind = prefix ? (prefix[1].toLowerCase() === 'skill' ? 'skill' : 'mcp') : null
  const query = (prefix ? rawQuery.slice(prefix[0].length) : rawQuery).toLowerCase()
  const matches = (reference: MultiRepoReference): boolean =>
    !query ||
    reference.token.toLowerCase().includes(query) ||
    reference.name.toLowerCase().includes(query)

  const suggestions: MultiRepoReference[] = []
  for (const kind of NAMED_KINDS) {
    if (onlyKind && onlyKind !== kind) {
      continue
    }
    suggestions.push(
      ...catalog.references
        .filter((reference) => reference.kind === kind && matches(reference))
        .slice(0, GROUP_LIMIT[kind])
    )
  }
  // Why: listing thousands of files on a bare `@` buries skills and docs.
  if (onlyKind || !query) {
    return suggestions
  }
  const ranker = new QuickOpenPathRanker(query, GROUP_LIMIT.file)
  const byKey = new Map<string, MultiRepoFileEntry>()
  const docTokens = new Set(
    catalog.references.filter((entry) => entry.kind === 'doc').map((entry) => entry.token)
  )
  for (const file of catalog.files) {
    if (docTokens.has(`@${file.key}`)) {
      continue
    }
    byKey.set(file.key, file)
    ranker.consider(file.key)
  }
  for (const key of ranker.result().paths) {
    const file = byKey.get(key)
    if (file) {
      suggestions.push({
        kind: 'file',
        scope: file.scope,
        name: file.path,
        path: file.path,
        token: `@${file.key}`
      })
    }
  }
  return suggestions
}
