import { getTerminalFileContext } from '@/components/terminal-pane/terminal-file-path-mapping'
import { listRuntimeFiles } from '@/runtime/runtime-file-search-client'
import { QUICK_OPEN_LISTING_MAX_RESULTS } from '../../../../shared/quick-open-listing-limits'

const ROOTED_PATH_PATTERN = /^(?:~|\.\.|[\\/]|[A-Za-z]:[\\/])/
const NAME_LOOKUP_MAX_RESULTS = 500
const TERMINAL_LOOKUP_TTL_MS = 30_000

export type WorkspaceFileLookupHost = {
  worktreeId: string
  worktreePath: string
  runtimeEnvironmentId: string | null
}

/** The relative path text to look up, or null for rooted, spaced or folder paths. */
export function normalizeWantedPath(pathText: string): string | null {
  const wanted = pathText.replaceAll('\\', '/').replace(/^\.\//, '')
  return !wanted || /\s/.test(wanted) || ROOTED_PATH_PATTERN.test(wanted) || wanted.endsWith('/')
    ? null
    : wanted
}

export function pathBaseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** The workspace path `wanted` names: itself at the root, else the one file it is a suffix of. */
export function matchWorkspacePath(wanted: string, paths: readonly string[]): string | null {
  if (paths.includes(wanted)) {
    return wanted
  }
  const matches = paths.filter((path) => path.endsWith(`/${wanted}`))
  // Why: a name shared by several files has no single place to open.
  return matches.length === 1 ? matches[0] : null
}

/**
 * Workspace-relative paths of files named `name`. A large repo outgrows any full listing cap, so
 * local hosts filter by name; SSH and runtime hosts cannot, and use `fullListing` (capped).
 */
export async function lookUpWorkspaceFilesNamed(
  host: WorkspaceFileLookupHost,
  name: string,
  fullListing: () => Promise<readonly string[]>
): Promise<string[]> {
  const context = getTerminalFileContext(
    host.worktreeId,
    host.worktreePath,
    host.runtimeEnvironmentId
  )
  // Why: with no single host for the workspace, a lookup would silently list this machine.
  if (!context.sourceHostResolved) {
    throw new Error('The workspace host could not be determined')
  }
  const listed =
    context.target.kind !== 'environment' && !context.connectionId
      ? await listRuntimeFiles(context, {
          rootPath: host.worktreePath,
          nameFilter: name,
          maxResults: NAME_LOOKUP_MAX_RESULTS
        })
      : await fullListing()
  return listed
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => pathBaseName(path) === name)
}

export function listWholeWorkspace(host: WorkspaceFileLookupHost): Promise<readonly string[]> {
  return listRuntimeFiles(
    getTerminalFileContext(host.worktreeId, host.worktreePath, host.runtimeEnvironmentId),
    { rootPath: host.worktreePath, maxResults: QUICK_OPEN_LISTING_MAX_RESULTS }
  )
}

const terminalLookups = new Map<string, { at: number; result: Promise<string[]> }>()

/** For terminal links: the workspace file a bare or partial path names; answers stay 30s. */
export async function findWorkspaceFileForTerminal(
  host: WorkspaceFileLookupHost,
  pathText: string
): Promise<string | null> {
  const wanted = normalizeWantedPath(pathText)
  if (!wanted) {
    return null
  }
  const name = pathBaseName(wanted)
  const key = `${host.worktreeId}\0${host.runtimeEnvironmentId ?? ''}\0${name}`
  const now = Date.now()
  let entry = terminalLookups.get(key)
  if (!entry || now - entry.at > TERMINAL_LOOKUP_TTL_MS) {
    entry = {
      at: now,
      result: lookUpWorkspaceFilesNamed(host, name, () => listWholeWorkspace(host)).catch(() => [])
    }
    terminalLookups.set(key, entry)
  }
  return matchWorkspacePath(wanted, await entry.result)
}
