import { useEffect } from 'react'
import { useAppStore } from '@/store'

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
}

export function defaultFoldMarker(collapseKey: string): string {
  return `${DEFAULT_FOLD_MARKER_PREFIX}${collapseKey}`
}

/** Project and repository headers that have never been folded by default yet. */
export function sidebarGroupsToFoldByDefault(
  rows: readonly SidebarRowLike[],
  collapsedGroups: ReadonlySet<string>
): string[] {
  const keys: string[] = []
  for (const row of rows) {
    if (row.type !== 'header' || !(row.repo || row.projectGroup)) {
      continue
    }
    const key = row.collapseKey ?? row.key
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
