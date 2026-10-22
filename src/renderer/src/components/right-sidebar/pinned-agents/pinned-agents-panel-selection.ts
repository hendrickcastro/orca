import type { WorkspaceLineage } from '../../../../../shared/worktree/lineage-types'
import { parseWorkspaceKey } from '../../../../../shared/workspace-scope'
import type { PinnedWorkspaceEntry } from './pinned-workspaces-catalog'

export type PinnedAgentsPanelItem = {
  entry: PinnedWorkspaceEntry
  /** The task a member worktree belongs to. */
  parent: PinnedWorkspaceEntry | null
}

/** Catalog order, one row per workspace: a task, then its members, then pinned worktrees. */
export function flattenPinnedCatalog(
  catalog: readonly PinnedWorkspaceEntry[]
): PinnedAgentsPanelItem[] {
  return catalog.flatMap((entry) => [
    { entry, parent: null },
    ...entry.members.map((member) => ({ entry: member, parent: entry }))
  ])
}

/**
 * The rows the panel shows: the stored ids, in that order, minus the ones no longer pinned.
 * Why empty by default: the panel is composed by dropping cards on it, so a drop must always
 * add something visible; listing everything pinned up front made a drop look like a no-op.
 */
export function resolvePinnedAgentsPanelItems(
  catalog: readonly PinnedWorkspaceEntry[],
  storedIds: readonly string[] | undefined
): PinnedAgentsPanelItem[] {
  const byId = new Map(flattenPinnedCatalog(catalog).map((item) => [item.entry.id, item]))
  const seen = new Set<string>()
  const items: PinnedAgentsPanelItem[] = []
  for (const id of storedIds ?? []) {
    const item = byId.get(id)
    if (item && !seen.has(id)) {
      seen.add(id)
      items.push(item)
    }
  }
  return items
}

/** Adds or removes one workspace, keeping the stored order. */
export function togglePinnedAgentsPanelItem(
  catalog: readonly PinnedWorkspaceEntry[],
  storedIds: readonly string[] | undefined,
  id: string
): string[] {
  const current = resolvePinnedAgentsPanelItems(catalog, storedIds).map((item) => item.entry.id)
  return current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
}

/** A dropped task brings the worktrees its agent works in, so every repo of the task is followed. */
export function expandPinnedAgentsPanelDropIds(
  workspaceLineageByChildKey: Readonly<Record<string, WorkspaceLineage>>,
  ids: readonly string[]
): string[] {
  const expanded: string[] = []
  for (const id of ids) {
    expanded.push(id)
    if (parseWorkspaceKey(id)?.type !== 'folder') {
      continue
    }
    for (const [childKey, lineage] of Object.entries(workspaceLineageByChildKey)) {
      const child = parseWorkspaceKey(childKey)
      if (lineage.parentWorkspaceKey === id && child?.type === 'worktree') {
        expanded.push(child.worktreeId)
      }
    }
  }
  return expanded
}

export function movePinnedAgentsPanelItem(
  ids: readonly string[],
  activeId: string,
  overId: string
): string[] {
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from === -1 || to === -1 || from === to) {
    return [...ids]
  }
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
