import { createContext } from 'react'
import type { WorkspaceFileFinder } from '@/components/sidebar/comment-markdown-native-chat-file-links'
import {
  listWholeWorkspace,
  lookUpWorkspaceFilesNamed,
  matchWorkspacePath,
  normalizeWantedPath,
  pathBaseName,
  type WorkspaceFileLookupHost
} from '@/components/file-link-preview/workspace-file-name-lookup'

const NOTIFY_DELAY_MS = 50

export type NativeChatWorkspaceFileIndexHost = WorkspaceFileLookupHost

export type NativeChatWorkspaceFileIndex = {
  subscribe: (listener: () => void) => () => void
  /** A new finder each time a looked-up name's answer arrives. */
  getFinder: () => WorkspaceFileFinder
  /** The agent may have added files: forget every answer and look again. */
  refresh: () => void
}

export const NativeChatWorkspaceFileIndexContext =
  createContext<NativeChatWorkspaceFileIndex | null>(null)

/** Finder over a complete listing of workspace-relative paths. */
export function createWorkspaceFileFinder(relativePaths: readonly string[]): WorkspaceFileFinder {
  const byName = new Map<string, string[]>()
  for (const path of relativePaths) {
    const normalized = path.replaceAll('\\', '/')
    const list = byName.get(pathBaseName(normalized))
    if (list) {
      list.push(normalized)
    } else {
      byName.set(pathBaseName(normalized), [normalized])
    }
  }
  return (pathText) => {
    const wanted = normalizeWantedPath(pathText)
    return wanted ? matchWorkspacePath(wanted, byName.get(pathBaseName(wanted)) ?? []) : null
  }
}

/**
 * Looks up only the names messages ask about. A large repo outgrows any full listing cap, so local
 * hosts filter by name; SSH and runtime hosts cannot, and fall back to one capped listing.
 */
export function createNativeChatWorkspaceFileIndex(
  host: NativeChatWorkspaceFileIndexHost
): NativeChatWorkspaceFileIndex {
  const listeners = new Set<() => void>()
  let pathsByName = new Map<string, readonly string[]>()
  const pending = new Set<string>()
  let fullListing: Promise<readonly string[]> | null = null
  let notifyTimer: ReturnType<typeof setTimeout> | undefined

  const lookUp = (name: string): Promise<readonly string[]> =>
    lookUpWorkspaceFilesNamed(host, name, () => (fullListing ??= listWholeWorkspace(host)))

  const notifySoon = (): void => {
    clearTimeout(notifyTimer)
    notifyTimer = setTimeout(() => {
      finder = createFinder()
      for (const listener of listeners) {
        listener()
      }
    }, NOTIFY_DELAY_MS)
  }

  const request = (name: string): void => {
    if (pending.has(name)) {
      return
    }
    pending.add(name)
    const answers = pathsByName
    void lookUp(name)
      // Why: an unanswered lookup keeps today's behaviour; the name stays unlinked.
      .catch((): readonly string[] => [])
      .then((paths) => {
        pending.delete(name)
        // Why: a refresh since then started over; this answer may predate the agent's edits.
        if (answers === pathsByName) {
          pathsByName.set(name, paths)
          notifySoon()
        }
      })
  }

  const createFinder = (): WorkspaceFileFinder => (pathText) => {
    const wanted = normalizeWantedPath(pathText)
    if (!wanted) {
      return null
    }
    const paths = pathsByName.get(pathBaseName(wanted))
    if (!paths) {
      request(pathBaseName(wanted))
      return null
    }
    return matchWorkspacePath(wanted, paths)
  }

  let finder = createFinder()

  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getFinder: () => finder,
    refresh: () => {
      pathsByName = new Map()
      pending.clear()
      fullListing = null
      notifySoon()
    }
  }
}
