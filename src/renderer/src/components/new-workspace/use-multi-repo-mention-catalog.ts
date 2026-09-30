import { useEffect, useMemo, useRef, useState } from 'react'
import type { Repo } from '../../../../shared/repo-types'
import type { ClaudeMcpServerEntry } from '../../../../shared/claude-user-mcp-servers'
import { QUICK_OPEN_LISTING_MAX_RESULTS } from '../../../../shared/quick-open-listing-limits'
import { loadMcpConfigInspections } from '@/components/settings/mcp-config-inspection'
import {
  buildMultiRepoReferenceToken,
  type MultiRepoReference,
  type MultiRepoReferenceScope
} from '@/lib/multi-repo-prompt-references'
import {
  EMPTY_MULTI_REPO_MENTION_CATALOG,
  toMultiRepoFileEntry,
  type MultiRepoFileEntry,
  type MultiRepoMentionCatalog
} from '@/lib/multi-repo-mention-suggestions'

type RepoCatalogPart = { references: MultiRepoReference[]; files: MultiRepoFileEntry[] }

async function settle<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load()
  } catch {
    // Why: a source that cannot be listed must not hide the others.
    return fallback
  }
}

function mcpReferences(
  servers: readonly ClaudeMcpServerEntry[],
  scope: MultiRepoReferenceScope,
  source: string
): MultiRepoReference[] {
  return servers
    .filter((server) => server.status !== 'invalid')
    .map((server) => ({
      kind: 'mcp',
      scope,
      name: server.name,
      token: buildMultiRepoReferenceToken('mcp', scope, server.name),
      description:
        server.status === 'disabled' ? `${server.transport}, disabled` : server.transport,
      source
    }))
}

async function loadRepoPart(repo: Repo): Promise<RepoCatalogPart> {
  const scope = { kind: 'repo', repoId: repo.id, repoName: repo.displayName } as const
  const [skills, docs, mcpFiles, files] = await Promise.all([
    settle(() => window.api.skills.discover({ cwd: repo.path }), null),
    settle(() => window.api.fs.listMarkdownDocuments({ rootPath: repo.path }), []),
    settle(() => loadMcpConfigInspections(repo.path, undefined), []),
    settle(
      () =>
        window.api.fs.listFiles({
          rootPath: repo.path,
          maxResults: QUICK_OPEN_LISTING_MAX_RESULTS
        }),
      []
    )
  ])
  const references: MultiRepoReference[] = []
  for (const skill of skills?.skills ?? []) {
    // The coordinator is Claude, so codex-only roots would be noise.
    if (!skill.providers.includes('claude') && !skill.providers.includes('agent-skills')) {
      continue
    }
    const skillScope: MultiRepoReferenceScope =
      skill.sourceKind === 'repo' ? scope : { kind: 'global' }
    references.push({
      kind: 'skill',
      scope: skillScope,
      name: skill.name,
      token: buildMultiRepoReferenceToken('skill', skillScope, skill.name),
      path: skill.skillFilePath,
      description: skill.description
    })
  }
  for (const inspection of mcpFiles) {
    references.push(...mcpReferences(inspection.servers, scope, inspection.candidate.relativePath))
  }
  for (const doc of docs) {
    references.push({
      kind: 'doc',
      scope,
      name: doc.relativePath,
      token: buildMultiRepoReferenceToken('doc', scope, doc.relativePath),
      path: doc.relativePath
    })
  }
  return { references, files: files.map((path) => toMultiRepoFileEntry(scope, path)) }
}

async function loadClaudeUserMcp(repos: readonly Repo[]): Promise<MultiRepoReference[]> {
  const servers = await settle(
    () => window.api.claudeMcp.listClaudeUserServers(repos.map((repo) => repo.path)),
    null
  )
  if (!servers) {
    return []
  }
  const references = mcpReferences(servers.user, { kind: 'global' }, 'Claude user config')
  for (const repo of repos) {
    references.push(
      ...mcpReferences(
        servers.projects[repo.path] ?? [],
        { kind: 'repo', repoId: repo.id, repoName: repo.displayName },
        'Claude local config'
      )
    )
  }
  return references
}

/** Skills, MCP servers, docs and files the request can reference, loaded per selected repo. */
export function useMultiRepoMentionCatalog(repos: readonly Repo[]): {
  catalog: MultiRepoMentionCatalog
  loading: boolean
} {
  const partsRef = useRef(new Map<string, Promise<RepoCatalogPart>>())
  const [parts, setParts] = useState<{ repoParts: RepoCatalogPart[]; user: MultiRepoReference[] }>({
    repoParts: [],
    user: []
  })
  const [loading, setLoading] = useState(false)
  const repoKey = repos.map((repo) => `${repo.id}\0${repo.path}`).join('\n')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const repoParts = repos.map((repo) => {
      const key = `${repo.id}\0${repo.path}`
      let part = partsRef.current.get(key)
      if (!part) {
        part = loadRepoPart(repo)
        partsRef.current.set(key, part)
      }
      return part
    })
    void Promise.all([Promise.all(repoParts), loadClaudeUserMcp(repos)]).then(
      ([loadedParts, user]) => {
        if (!cancelled) {
          setParts({ repoParts: loadedParts, user })
          setLoading(false)
        }
      }
    )
    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- repoKey is the selection signal; the repos array changes identity every render.
  }, [repoKey])

  const catalog = useMemo((): MultiRepoMentionCatalog => {
    if (parts.repoParts.length === 0 && parts.user.length === 0) {
      return EMPTY_MULTI_REPO_MENTION_CATALOG
    }
    // Global skills are reported once per repo scan; keep the first.
    const byToken = new Map<string, MultiRepoReference>()
    for (const reference of [
      ...parts.repoParts.flatMap((part) => part.references),
      ...parts.user
    ]) {
      if (!byToken.has(reference.token)) {
        byToken.set(reference.token, reference)
      }
    }
    return {
      references: [...byToken.values()],
      files: parts.repoParts.flatMap((part) => part.files)
    }
  }, [parts])

  return { catalog, loading }
}
