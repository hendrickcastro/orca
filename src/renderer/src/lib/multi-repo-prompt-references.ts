import type { Repo } from '../../../shared/repo-types'
import type { Worktree } from '../../../shared/worktree/types'
import { getRelativePathInsideRoot, joinPath } from './path'

export type MultiRepoReferenceKind = 'skill' | 'workflow' | 'mcp' | 'doc' | 'file'

export type MultiRepoReferenceScope =
  | { kind: 'repo'; repoId: string; repoName: string }
  | { kind: 'global' }

export type MultiRepoReference = {
  kind: MultiRepoReferenceKind
  scope: MultiRepoReferenceScope
  /** Skill or server name, or the repo-relative path of a doc or file. */
  name: string
  /** Inserted into the request text, including the leading `@`. */
  token: string
  /** Doc/file/workflow: repo-relative with `/`. Skill: absolute SKILL.md path. */
  path?: string
  description?: string | null
  /** MCP: the config that declares the server. */
  source?: string
}

type ReferenceMember = { repo: Pick<Repo, 'id' | 'path'>; worktree: Pick<Worktree, 'path'> }

function tokenSegment(value: string): string {
  return value.trim().replace(/\s+/g, '-')
}

export function buildMultiRepoReferenceToken(
  kind: MultiRepoReferenceKind,
  scope: MultiRepoReferenceScope,
  name: string
): string {
  const repoPrefix = scope.kind === 'repo' ? `${tokenSegment(scope.repoName)}/` : ''
  if (kind === 'skill' || kind === 'workflow' || kind === 'mcp') {
    return `@${kind}:${repoPrefix}${tokenSegment(name)}`
  }
  return `@${repoPrefix}${tokenSegment(name)}`
}

/** Unlike GitHub logins, references contain `/`, `.`, `:` and `_`. */
export function findMultiRepoMentionQuery(
  value: string,
  caret: number
): { atIndex: number; query: string } | null {
  const beforeCaret = value.slice(0, caret)
  const match = /(^|[\s([{,])@([^\s@]*)$/.exec(beforeCaret)
  if (!match) {
    return null
  }
  const query = match[2] ?? ''
  return { atIndex: beforeCaret.length - query.length - 1, query }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Keeps only references whose token is still present in the request. */
export function collectMentionedReferences(
  prompt: string,
  references: Iterable<MultiRepoReference>
): MultiRepoReference[] {
  const byToken = new Map<string, MultiRepoReference>()
  for (const reference of references) {
    if (byToken.has(reference.token)) {
      continue
    }
    const pattern = new RegExp(
      `(^|[\\s([{,])${escapeRegExp(reference.token)}(?=$|[\\s)\\]},.;:!?])`
    )
    if (pattern.test(prompt)) {
      byToken.set(reference.token, reference)
    }
  }
  return [...byToken.values()]
}

function worktreePathFor(
  reference: MultiRepoReference,
  members: readonly ReferenceMember[]
): string | undefined {
  if (reference.scope.kind !== 'repo' || !reference.path) {
    return reference.path
  }
  const { repoId } = reference.scope
  const member = members.find((entry) => entry.repo.id === repoId)
  if (!member) {
    return reference.path
  }
  if (reference.kind === 'skill') {
    // Why: repo skills were discovered in the original checkout; Claude must read the worktree copy.
    const relative = getRelativePathInsideRoot(reference.path, member.repo.path)
    return relative === null ? reference.path : joinPath(member.worktree.path, relative)
  }
  return joinPath(member.worktree.path, reference.path)
}

function scopeLabel(scope: MultiRepoReferenceScope): string {
  return scope.kind === 'repo' ? `repository ${JSON.stringify(scope.repoName)}` : 'global'
}

export function describeMultiRepoReferences(
  references: readonly MultiRepoReference[],
  members: readonly ReferenceMember[]
): string[] {
  if (references.length === 0) {
    return []
  }
  const lines = references.map((reference) => {
    const location = worktreePathFor(reference, members)
    const scope = scopeLabel(reference.scope)
    switch (reference.kind) {
      case 'skill':
        return `- ${reference.token}: skill ${JSON.stringify(reference.name)} (${scope}). Read ${location ?? 'its SKILL.md'} and follow it.`
      case 'workflow':
        return `- ${reference.token}: Claude Code workflow ${JSON.stringify(reference.name)} (${scope}) at ${location ?? reference.name}. Run it with the Workflow tool when it fits the task.`
      case 'mcp':
        return `- ${reference.token}: MCP server ${JSON.stringify(reference.name)} (${scope}${reference.source ? `, ${reference.source}` : ''}). Use its tools where relevant; say so if it is not connected in this session.`
      case 'doc':
        return `- ${reference.token}: document in ${scope} at ${location ?? reference.name}. Read it before editing.`
      case 'file':
        return `- ${reference.token}: file in ${scope} at ${location ?? reference.name}.`
    }
  })
  return [
    '',
    'References mentioned in the request (repository paths point at the feature worktrees):',
    ...lines
  ]
}
