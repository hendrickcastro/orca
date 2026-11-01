import type { WorkspaceLineage } from '../worktree/lineage-types'
import type { Worktree } from '../worktree/types'
import { getWorktreeHostIdentity } from '../worktree/host-qualified-identity'
import { getFolderWorkspaceHostIdentity } from '../folder-workspace-worktree'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../workspace-scope'
import { PINNED_GROUP_KEY } from './group-keys'
import { PINNED_FAVORITES_GROUP_KEY, splitPinnedFavorites } from './pinned-favorites'
import type { RenderableFolderWorkspace } from './folder-workspace-lanes'
import type { PinnedWorktreeDisplayPolicy } from './row-types'
import type { OrderedGroupEntry } from './worktree-group-entry'

/** A pinned folder workspace plus the worktrees its agent works in (a multi-repository task's members). */
export type PinnedFolderWorkspaceSection = {
  pair: RenderableFolderWorkspace
  members: Worktree[]
  /** The occurrence-plan section that lists the members under the task row. */
  sectionKey: string
}

export type PinnedFolderWorkspaceSplit = {
  pinned: PinnedFolderWorkspaceSection[]
  /** Folder workspaces that still render in their natural lanes. */
  natural: RenderableFolderWorkspace[]
  /** Host identities of every member a pinned task lists. */
  memberIdentities: ReadonlySet<string>
}

export function getPinnedTaskSectionKey(pair: RenderableFolderWorkspace): string {
  return `${PINNED_GROUP_KEY}:task:${getFolderWorkspaceHostIdentity(pair.folderWorkspace)}`
}

/**
 * Why: the Pinned section used to read `isPinned` from git worktrees only, so a pinned
 * folder workspace (a multi-repository task) kept its flag but never left its lane.
 * Members follow their coordinator the way lineage children follow a pinned parent.
 */
export function splitPinnedFolderWorkspaces(args: {
  folderWorkspaces: readonly RenderableFolderWorkspace[]
  worktrees: readonly Worktree[]
  workspaceLineageByChildKey: Readonly<Record<string, WorkspaceLineage>>
  policy: PinnedWorktreeDisplayPolicy
}): PinnedFolderWorkspaceSplit {
  const pinnedPairs = args.folderWorkspaces.filter((pair) => pair.folderWorkspace.isPinned)
  const membersByFolderKey = new Map<string, Worktree[]>()
  if (pinnedPairs.length > 0) {
    const pinnedFolderKeys = new Set(
      pinnedPairs.map((pair) => folderWorkspaceKey(pair.folderWorkspace.id))
    )
    for (const worktree of args.worktrees) {
      const parentKey =
        args.workspaceLineageByChildKey[worktreeWorkspaceKey(worktree.id)]?.parentWorkspaceKey
      if (!parentKey || !pinnedFolderKeys.has(parentKey)) {
        continue
      }
      const members = membersByFolderKey.get(parentKey) ?? []
      members.push(worktree)
      membersByFolderKey.set(parentKey, members)
    }
  }
  const pinned = pinnedPairs.map((pair) => ({
    pair,
    members: membersByFolderKey.get(folderWorkspaceKey(pair.folderWorkspace.id)) ?? [],
    sectionKey: getPinnedTaskSectionKey(pair)
  }))
  return {
    pinned,
    natural:
      args.policy === 'duplicate-in-groups'
        ? [...args.folderWorkspaces]
        : args.folderWorkspaces.filter((pair) => !pair.folderWorkspace.isPinned),
    memberIdentities: new Set(
      pinned.flatMap((section) => section.members.map(getWorktreeHostIdentity))
    )
  }
}

/** Favourite workspaces and pinned tasks, which the Pinned rows carry beside the plain pinned worktrees. */
export type PinnedGroupExtras = {
  favoriteWorktrees: Worktree[]
  favoriteTasks: readonly PinnedFolderWorkspaceSection[]
  restTasks: readonly PinnedFolderWorkspaceSection[]
}

export type PinnedSectionsPlan = {
  /** Folder workspaces that still render in their natural lanes. */
  naturalFolders: RenderableFolderWorkspace[]
  /** The natural lanes' worktrees, without the members a pinned task lists under the single-location policy. */
  naturalOf: (natural: readonly Worktree[]) => readonly Worktree[]
  isPinnedSectionKey: (key: string) => boolean
  /** Reveal a task member through the header (Favorites or Pinned) its task renders under. */
  revealParentOf: (key: string) => { key: string } | undefined
  /** Occurrence-plan sections for the pinned worktrees: Favorites, Pinned, then each task's members. */
  groupsOf: (pinned: readonly Worktree[]) => OrderedGroupEntry[]
  extrasOf: (
    sections: readonly { key: string; group: { items: Worktree[] } }[]
  ) => PinnedGroupExtras
}

const NO_WORKSPACE_LINEAGE: Readonly<Record<string, WorkspaceLineage>> = {}
const NO_PINNED_FAVORITES: ReadonlySet<string> = new Set()

export function planPinnedSections(args: {
  folderWorkspaces: readonly RenderableFolderWorkspace[]
  worktrees: readonly Worktree[]
  workspaceLineageByChildKey?: Readonly<Record<string, WorkspaceLineage>>
  policy: PinnedWorktreeDisplayPolicy
  favoriteIds?: ReadonlySet<string>
}): PinnedSectionsPlan {
  const favoriteIds = args.favoriteIds ?? NO_PINNED_FAVORITES
  const split = splitPinnedFolderWorkspaces({
    ...args,
    workspaceLineageByChildKey: args.workspaceLineageByChildKey ?? NO_WORKSPACE_LINEAGE
  })
  const isMember = (worktree: Worktree): boolean =>
    split.memberIdentities.has(getWorktreeHostIdentity(worktree))
  const tasks = splitPinnedFavorites(favoriteIds, [], split.pinned)
  const headerKeyBySectionKey = new Map<string, string>([
    [PINNED_FAVORITES_GROUP_KEY, PINNED_FAVORITES_GROUP_KEY],
    [PINNED_GROUP_KEY, PINNED_GROUP_KEY]
  ])
  for (const task of tasks.favorites.tasks) {
    headerKeyBySectionKey.set(task.sectionKey, PINNED_FAVORITES_GROUP_KEY)
  }
  for (const task of tasks.rest.tasks) {
    headerKeyBySectionKey.set(task.sectionKey, PINNED_GROUP_KEY)
  }
  const groupsOf = (pinned: readonly Worktree[]): OrderedGroupEntry[] => {
    // Why: a task's members render under the task, not again as loose pinned rows.
    const loose = pinned.filter((worktree) => !isMember(worktree))
    const { favorites, rest } = splitPinnedFavorites(favoriteIds, loose, split.pinned)
    const groups: OrderedGroupEntry[] = []
    for (const [key, part] of [
      [PINNED_FAVORITES_GROUP_KEY, favorites],
      [PINNED_GROUP_KEY, rest]
    ] as const) {
      if (part.worktrees.length > 0) {
        groups.push([key, { label: '', items: part.worktrees, repoIds: new Set() }])
      }
      for (const task of part.tasks) {
        groups.push([task.sectionKey, { label: '', items: task.members, repoIds: new Set() }])
      }
    }
    return groups
  }
  return {
    naturalFolders: split.natural,
    naturalOf: (natural) =>
      args.policy === 'duplicate-in-groups' || split.memberIdentities.size === 0
        ? natural
        : natural.filter((worktree) => !isMember(worktree)),
    isPinnedSectionKey: (key) => headerKeyBySectionKey.has(key),
    revealParentOf: (key) => {
      const headerKey = headerKeyBySectionKey.get(key)
      return headerKey === undefined || headerKey === key ? undefined : { key: headerKey }
    },
    groupsOf,
    extrasOf: (sections) => ({
      favoriteWorktrees:
        sections.find((section) => section.key === PINNED_FAVORITES_GROUP_KEY)?.group.items ?? [],
      favoriteTasks: tasks.favorites.tasks,
      restTasks: tasks.rest.tasks
    })
  }
}
