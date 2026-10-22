import type { WorkspaceLineage } from '../../../../../../shared/worktree/lineage-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../../../shared/worktree/host-qualified-identity'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../../../../../../shared/workspace-scope'
import type { RenderableFolderWorkspace } from './folder-workspace-lanes'
import type { PinnedWorktreeDisplayPolicy } from './row-types'

/** A pinned folder workspace plus the worktrees its agent works in (a multi-repository task's members). */
export type PinnedFolderWorkspaceSection = {
  pair: RenderableFolderWorkspace
  members: Worktree[]
}

export type PinnedFolderWorkspaceSplit = {
  pinned: PinnedFolderWorkspaceSection[]
  /** Folder workspaces that still render in their natural lanes. */
  natural: RenderableFolderWorkspace[]
  /** Pinned worktrees that are not already listed under a pinned folder workspace. */
  pinnedWorktrees: Worktree[]
  /** Host identities of every worktree the Pinned section lists, members included. */
  pinnedSectionIdentities: Set<string>
}

/**
 * Why: the Pinned section used to read `isPinned` from git worktrees only, so a pinned
 * folder workspace (a multi-repository task) kept its flag but never left its lane.
 * Members follow their coordinator the way lineage children follow a pinned parent.
 */
export function splitPinnedFolderWorkspaces(args: {
  folderWorkspaces: readonly RenderableFolderWorkspace[]
  worktrees: readonly Worktree[]
  pinnedSectionWorktrees: readonly Worktree[]
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
    members: membersByFolderKey.get(folderWorkspaceKey(pair.folderWorkspace.id)) ?? []
  }))
  const memberIdentities = new Set(
    pinned.flatMap((section) => section.members.map(getWorktreeHostIdentity))
  )
  const pinnedWorktrees = args.pinnedSectionWorktrees.filter(
    (worktree) => !memberIdentities.has(getWorktreeHostIdentity(worktree))
  )
  const pinnedSectionIdentities = new Set([
    ...memberIdentities,
    ...pinnedWorktrees.map(getWorktreeHostIdentity)
  ])
  return {
    pinned,
    natural:
      args.policy === 'duplicate-in-groups'
        ? [...args.folderWorkspaces]
        : args.folderWorkspaces.filter((pair) => !pair.folderWorkspace.isPinned),
    pinnedWorktrees,
    pinnedSectionIdentities
  }
}
