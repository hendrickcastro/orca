import { useEffect } from 'react'
import { useAppStore } from '@/store/index'
import { PINNED_GROUP_KEY } from '../../../../shared/sidebar-list/sections/group-keys'

/**
 * Why a marker beside the key: groups start folded only the first time they appear; after that
 * the user's own fold or unfold is what persists. Keeping the marker in collapsedGroups saves it
 * in the same write as the fold, and unknown keys there are ignored by every reader.
 */
const DEFAULT_FOLD_MARKER_PREFIX = 'default-folded:'

type SidebarRowLike = {
  type: string
  key?: string
  collapseKey?: string
  repo?: unknown
  projectGroup?: unknown
  sectionKey?: string
  lineageGroupKey?: string
}

export function defaultFoldMarker(collapseKey: string): string {
  return `${DEFAULT_FOLD_MARKER_PREFIX}${collapseKey}`
}

/** Why pinned tasks too: a multi-repo task in Pinned would otherwise list every member repo. */
function defaultFoldKey(row: SidebarRowLike): string | undefined {
  if (row.type === 'header' && (row.repo || row.projectGroup)) {
    return row.collapseKey ?? row.key
  }
  return row.type === 'folder-workspace' && row.sectionKey === PINNED_GROUP_KEY
    ? row.lineageGroupKey
    : undefined
}

/** Project and repository headers, and pinned tasks, that have never been folded by default yet. */
export function sidebarGroupsToFoldByDefault(
  rows: readonly SidebarRowLike[],
  collapsedGroups: ReadonlySet<string>
): string[] {
  const keys: string[] = []
  for (const row of rows) {
    const key = defaultFoldKey(row)
    if (key && !collapsedGroups.has(defaultFoldMarker(key)) && !keys.includes(key)) {
      keys.push(key)
    }
  }
  return keys
}

/** Folds new project and repository groups once, after the saved fold state has loaded. */
export function useDefaultFoldedSidebarGroups(rows: readonly SidebarRowLike[]): void {
  const persistedUIReady = useAppStore((s) => s.persistedUIReady)
  const collapsedGroups = useAppStore((s) => s.collapsedGroups)
  useEffect(() => {
    if (!persistedUIReady) {
      return
    }
    const keys = sidebarGroupsToFoldByDefault(rows, collapsedGroups)
    if (keys.length === 0) {
      return
    }
    const next = new Set(useAppStore.getState().collapsedGroups)
    for (const key of keys) {
      next.add(key)
      next.add(defaultFoldMarker(key))
    }
    useAppStore.setState({ collapsedGroups: next })
    window.api.ui.set({ collapsedGroups: [...next] }).catch(console.error)
  }, [rows, collapsedGroups, persistedUIReady])
}
