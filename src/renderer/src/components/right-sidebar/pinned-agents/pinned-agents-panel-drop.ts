import { useAppStore } from '@/store'
import { PINNED_GROUP_KEY } from '@/components/sidebar/worktree-list/grouping/group-keys'
import {
  expandPinnedAgentsPanelDropIds,
  resolvePinnedAgentsPanelItems
} from './pinned-agents-panel-selection'
import { selectPinnedWorkspaceCatalog } from './pinned-workspaces-catalog'

/** Marks the surface a sidebar card can be dropped on to follow its agents in the Pinned panel. */
export const PINNED_AGENTS_DROP_TARGET_ATTR = 'data-pinned-agents-drop-target'
const DRAG_OVER_ATTR = 'data-pinned-agents-drag-over'

/** Why an attribute: the drop cover is CSS-driven, so no React surface needs to subscribe to drag frames. */
function setDragOver(next: boolean, target: HTMLElement | null): void {
  for (const element of document.querySelectorAll<HTMLElement>(`[${DRAG_OVER_ATTR}]`)) {
    if (element !== target) {
      element.removeAttribute(DRAG_OVER_ATTR)
    }
  }
  if (next && target) {
    target.setAttribute(DRAG_OVER_ATTR, '')
  }
}

export function findPinnedAgentsPanelDropTarget(x: number, y: number): HTMLElement | null {
  // Why: the floating drag preview is pointer-events: none, so the point resolves to what is beneath it.
  const element = document.elementFromPoint(x, y)
  return element instanceof Element
    ? element.closest<HTMLElement>(`[${PINNED_AGENTS_DROP_TARGET_ATTR}]`)
    : null
}

/** Highlights the panel while a pointer drag hovers it; true when the point is over it. */
export function updatePinnedAgentsPanelDropVisual(x: number, y: number): boolean {
  const target = findPinnedAgentsPanelDropTarget(x, y)
  setDragOver(target !== null, target)
  return target !== null
}

export function clearPinnedAgentsPanelDropVisual(): void {
  setDragOver(false, null)
}

/** The native-drag twin of updatePinnedAgentsPanelDropVisual: dragover already names the target. */
export function markPinnedAgentsPanelDropTarget(target: HTMLElement): void {
  setDragOver(true, target)
}

/** Only cards dragged out of the sidebar's Pinned section can land on the panel. */
export function isPinnedSectionDrag(drag: { sourceGroupKey: string }): boolean {
  return drag.sourceGroupKey === PINNED_GROUP_KEY
}

/**
 * Why: the board preview that opens on every card drag covers the right sidebar on most
 * screens, so a drag out of the Pinned section, headed for the panel, must not open it.
 */
export function shouldSkipWorkspaceBoardDragPreview(drag: { sourceGroupKey: string }): boolean {
  return isPinnedSectionDrag(drag)
}

/** One pointer-drag frame: highlights the panel under a Pinned-section drag; true while over it. */
export function trackPinnedAgentsPanelPointerDrag(drag: {
  sourceGroupKey: string
  currentX: number
  currentY: number
}): boolean {
  if (!isPinnedSectionDrag(drag)) {
    return false
  }
  return updatePinnedAgentsPanelDropVisual(drag.currentX, drag.currentY)
}

export type PinnedAgentsPanelDropActions = {
  pinWorktrees: (worktreeIds: readonly string[]) => void
  updateSettings: (updates: { pinnedAgentsPanelWorkspaceIds: string[] }) => void
  showPanel: () => void
}

/** Pins the dropped workspaces, lists them (and a task's members) after the current rows, and shows the panel. */
export function commitPinnedAgentsPanelDrop(
  worktreeIds: readonly string[],
  actions: PinnedAgentsPanelDropActions,
  currentRowIds: readonly string[]
): void {
  if (worktreeIds.length === 0) {
    return
  }
  actions.pinWorktrees(worktreeIds)
  const next = [...currentRowIds]
  for (const id of worktreeIds) {
    if (!next.includes(id)) {
      next.push(id)
    }
  }
  actions.updateSettings({ pinnedAgentsPanelWorkspaceIds: next })
  actions.showPanel()
}

/** Everything the store needs for a drop, read once at release time. */
export function pinnedAgentsPanelDropFromStore(
  pinWorktrees: (worktreeIds: readonly string[]) => void
): {
  actions: PinnedAgentsPanelDropActions
  currentRowIds: string[]
  expand: (ids: readonly string[]) => string[]
} {
  const state = useAppStore.getState()
  const catalog = selectPinnedWorkspaceCatalog(state)
  const storedIds = state.settings?.pinnedAgentsPanelWorkspaceIds
  return {
    actions: {
      pinWorktrees,
      updateSettings: (updates) => void state.updateSettings(updates),
      // Why the centre: the point of the drop is to watch the agents work, which needs room.
      showPanel: () => state.setActiveView('pinned-agents')
    },
    currentRowIds: resolvePinnedAgentsPanelItems(catalog, storedIds).map((item) => item.entry.id),
    expand: (ids) => expandPinnedAgentsPanelDropIds(state.workspaceLineageByChildKey, ids)
  }
}

/** The pointer-drag release path: true when the drop landed on the Pinned panel and was handled. */
export function commitPinnedAgentsPanelPointerDrop(
  point: { clientX: number; clientY: number },
  drag: { draggedIds: readonly string[]; sourceGroupKey: string },
  pinWorktrees: (worktreeIds: readonly string[]) => void
): boolean {
  if (
    !isPinnedSectionDrag(drag) ||
    !findPinnedAgentsPanelDropTarget(point.clientX, point.clientY)
  ) {
    return false
  }
  const { actions, currentRowIds, expand } = pinnedAgentsPanelDropFromStore(pinWorktrees)
  commitPinnedAgentsPanelDrop(
    drag.draggedIds,
    {
      ...actions,
      updateSettings: (updates) =>
        actions.updateSettings({
          pinnedAgentsPanelWorkspaceIds: expand(updates.pinnedAgentsPanelWorkspaceIds)
        })
    },
    currentRowIds
  )
  clearPinnedAgentsPanelDropVisual()
  return true
}
