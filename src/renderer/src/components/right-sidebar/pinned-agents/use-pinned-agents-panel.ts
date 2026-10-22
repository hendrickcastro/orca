import { useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import {
  movePinnedAgentsPanelItem,
  resolvePinnedAgentsPanelItems,
  togglePinnedAgentsPanelItem,
  type PinnedAgentsPanelItem
} from './pinned-agents-panel-selection'
import {
  selectPinnedWorkspaceCatalog,
  type PinnedWorkspaceCatalogState,
  type PinnedWorkspaceEntry
} from './pinned-workspaces-catalog'

export type PinnedAgentsPanelModel = {
  catalog: PinnedWorkspaceEntry[]
  items: PinnedAgentsPanelItem[]
  shownIds: ReadonlySet<string>
  toggle: (id: string) => void
  remove: (id: string) => void
  /** Drops `activeId` onto `overId`'s position. */
  move: (activeId: string, overId: string) => void
}

/** The panel's rows and the setting that remembers which pinned workspaces it shows, in what order. */
export function usePinnedAgentsPanel(): PinnedAgentsPanelModel {
  // Why: the catalog derives from five slices; select them by identity and derive once.
  const inputs = useAppStore(
    useShallow((s): PinnedWorkspaceCatalogState => ({
      repos: s.repos,
      worktreesByRepo: s.worktreesByRepo,
      folderWorkspaces: s.folderWorkspaces,
      projectGroups: s.projectGroups,
      workspaceLineageByChildKey: s.workspaceLineageByChildKey
    }))
  )
  const storedIds = useAppStore((s) => s.settings?.pinnedAgentsPanelWorkspaceIds)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const catalog = useMemo(() => selectPinnedWorkspaceCatalog(inputs), [inputs])
  const items = useMemo(
    () => resolvePinnedAgentsPanelItems(catalog, storedIds),
    [catalog, storedIds]
  )
  const shownIds = useMemo(() => new Set(items.map((item) => item.entry.id)), [items])
  const toggle = useCallback(
    (id: string) => {
      void updateSettings({
        pinnedAgentsPanelWorkspaceIds: togglePinnedAgentsPanelItem(catalog, storedIds, id)
      })
    },
    [catalog, storedIds, updateSettings]
  )
  const remove = useCallback(
    (id: string) => {
      const current = resolvePinnedAgentsPanelItems(catalog, storedIds).map((item) => item.entry.id)
      void updateSettings({
        pinnedAgentsPanelWorkspaceIds: current.filter((candidate) => candidate !== id)
      })
    },
    [catalog, storedIds, updateSettings]
  )
  const move = useCallback(
    (activeId: string, overId: string) => {
      const current = resolvePinnedAgentsPanelItems(catalog, storedIds).map((item) => item.entry.id)
      void updateSettings({
        pinnedAgentsPanelWorkspaceIds: movePinnedAgentsPanelItem(current, activeId, overId)
      })
    },
    [catalog, storedIds, updateSettings]
  )
  return { catalog, items, shownIds, toggle, remove, move }
}
