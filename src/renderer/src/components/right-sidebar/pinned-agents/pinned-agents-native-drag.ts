import { useMemo } from 'react'
import type React from 'react'
import { useAppStore } from '@/store'
import { PINNED_GROUP_KEY } from '@/components/sidebar/worktree-list/grouping/group-keys'
import {
  readWorkspaceDragDataIds,
  WORKSPACE_STATUS_DRAG_IDS_TYPE,
  WORKSPACE_STATUS_DRAG_TYPE,
  writeWorkspaceDragData
} from '@/components/sidebar/workspace-status-drag-data'
import {
  clearPinnedAgentsPanelDropVisual,
  commitPinnedAgentsPanelDrop,
  markPinnedAgentsPanelDropTarget,
  PINNED_AGENTS_DROP_TARGET_ATTR,
  pinnedAgentsPanelDropFromStore
} from './pinned-agents-panel-drop'

/** Why types only: during dragover the browser hides the payload, so only the type list says what is being dragged. */
export function isWorkspaceNativeDrag(types: readonly string[]): boolean {
  return (
    types.includes(WORKSPACE_STATUS_DRAG_IDS_TYPE) || types.includes(WORKSPACE_STATUS_DRAG_TYPE)
  )
}

export type PinnedAgentsDragSourceProps = {
  draggable: true
  onDragStart: (event: React.DragEvent<HTMLElement>) => void
}

/**
 * Native drag source for a workspace that the sidebar's pointer drag cannot pick up: a card's
 * inline agent list (its rows swallow pointer events so a click opens the agent, not the card)
 * and a folder workspace row (a multi-repository task), which belongs to no reorder group.
 */
export function pinnedAgentsDragSourceProps(worktreeId: string): PinnedAgentsDragSourceProps {
  return {
    draggable: true,
    onDragStart: (event) => {
      event.stopPropagation()
      // Why: only the Pinned section feeds the panel; elsewhere the row keeps its ordinary behavior.
      if (!isInsidePinnedSidebarSection(event.currentTarget)) {
        event.preventDefault()
        return
      }
      writeWorkspaceDragData(event.dataTransfer, [worktreeId])
    }
  }
}

function isInsidePinnedSidebarSection(element: Element): boolean {
  return (
    element.closest('[data-worktree-section-key]')?.getAttribute('data-worktree-section-key') ===
    PINNED_GROUP_KEY
  )
}

export function usePinnedAgentsDragSourceProps(worktreeId: string): PinnedAgentsDragSourceProps {
  return useMemo(() => pinnedAgentsDragSourceProps(worktreeId), [worktreeId])
}

export type PinnedAgentsNativeDropProps = {
  [PINNED_AGENTS_DROP_TARGET_ATTR]: ''
  onDragOverCapture: (event: React.DragEvent<HTMLElement>) => void
  onDragLeave: (event: React.DragEvent<HTMLElement>) => void
  onDropCapture: (event: React.DragEvent<HTMLElement>) => void
}

/**
 * Accepts a native workspace drag on the right sidebar: pins it and follows its agents in the
 * Pinned panel. Why capture: the file explorer's rows handle drops of their own and stop them
 * from bubbling, so a workspace drag must be claimed before any panel content sees it.
 */
export function usePinnedAgentsNativeDropProps(): PinnedAgentsNativeDropProps {
  return useMemo(
    () => ({
      [PINNED_AGENTS_DROP_TARGET_ATTR]: '',
      onDragOverCapture: (event) => {
        if (!isWorkspaceNativeDrag(Array.from(event.dataTransfer.types))) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        event.dataTransfer.dropEffect = 'move'
        markPinnedAgentsPanelDropTarget(event.currentTarget)
      },
      onDragLeave: (event) => {
        const next = event.relatedTarget
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          clearPinnedAgentsPanelDropVisual()
        }
      },
      onDropCapture: (event) => {
        if (!isWorkspaceNativeDrag(Array.from(event.dataTransfer.types))) {
          return
        }
        clearPinnedAgentsPanelDropVisual()
        const ids = readWorkspaceDragDataIds(event.dataTransfer)
        if (ids.length === 0) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        const { actions, currentRowIds, expand } = pinnedAgentsPanelDropFromStore((worktreeIds) =>
          useAppStore.getState().setWorktreesPinnedAndReveal(worktreeIds, true)
        )
        commitPinnedAgentsPanelDrop(
          ids,
          {
            ...actions,
            updateSettings: (updates) =>
              actions.updateSettings({
                pinnedAgentsPanelWorkspaceIds: expand(updates.pinnedAgentsPanelWorkspaceIds)
              })
          },
          currentRowIds
        )
      }
    }),
    []
  )
}
