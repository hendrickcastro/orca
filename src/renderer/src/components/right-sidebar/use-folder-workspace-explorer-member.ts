import { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import { getConnectionId } from '@/lib/connection-context'
import { isWindowVisible } from '@/lib/window-visibility-interval'
import { getAttachedWorktreesForFolderWorkspace } from './folder-workspace-attached-worktrees'
import { getFileExplorerOperationOwner } from './file-explorer-operation-owner'
import { getRightSidebarWorktreeRuntimeSettings } from './file-explorer-runtime-owner'
import { refreshGitStatusForWorktree } from './git-status-refresh'

export type FolderWorkspaceExplorerMember = { worktree: Worktree; repo: Repo | null }

// Why: only the active worktree is polled globally; a member browsed from its coordinator needs its own cadence.
const MEMBER_STATUS_INTERVAL_MS = 15_000

function sameOwner(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** One member alone keeps today's single-root explorer; the default is the member the folder already points at. */
export function pickFolderWorkspaceExplorerMember<
  T extends { worktree: Pick<Worktree, 'id' | 'path'> }
>(members: readonly T[], selectedId: string | undefined, folderPath: string | null): T | null {
  if (members.length < 2) {
    return null
  }
  return (
    members.find((member) => member.worktree.id === selectedId) ??
    members.find((member) => member.worktree.path === folderPath) ??
    members[0]
  )
}

/**
 * Lets a folder workspace's explorer browse one of its attached worktrees (e.g. the repositories of a
 * multi-repository task). Only local coordinators and local members qualify, so every file operation
 * keeps passing the explorer's owner check and path-routed git queries hit the chosen member.
 */
export function useFolderWorkspaceExplorerMember(activeWorktreeId: string | null): {
  members: FolderWorkspaceExplorerMember[]
  selected: FolderWorkspaceExplorerMember | null
  select: (worktreeId: string) => void
} {
  const isFolder = activeWorktreeId ? parseWorkspaceKey(activeWorktreeId)?.type === 'folder' : false
  const inputs = useAppStore(
    useShallow((s) => ({
      folderWorkspaces: s.folderWorkspaces,
      workspaceLineageByChildKey: s.workspaceLineageByChildKey,
      worktreeLineageById: s.worktreeLineageById,
      worktreesByRepo: s.worktreesByRepo,
      repos: s.repos
    }))
  )
  const [selectedByWorkspace, setSelectedByWorkspace] = useState<Record<string, string>>({})

  const { members, folderPath } = useMemo(() => {
    if (!isFolder || !activeWorktreeId) {
      return { members: [], folderPath: null }
    }
    const resolution = getAttachedWorktreesForFolderWorkspace({
      activeWorkspaceKey: activeWorktreeId,
      activeWorktreeId,
      folderWorkspaces: inputs.folderWorkspaces,
      workspaceLineageByChildKey: inputs.workspaceLineageByChildKey,
      worktreeLineageById: inputs.worktreeLineageById,
      worktreesByRepo: inputs.worktreesByRepo
    })
    const coordinatorOwner = getFileExplorerOperationOwner(activeWorktreeId)
    // Why: runtime RPCs route by workspace id, not path, so only local coordinators can browse another root.
    if (coordinatorOwner.kind !== 'local') {
      return { members: [], folderPath: null }
    }
    const repoById = new Map(inputs.repos.map((repo) => [repo.id, repo]))
    return {
      folderPath: resolution.folderWorkspace?.folderPath ?? null,
      members: resolution.childWorktrees
        .filter((worktree) =>
          sameOwner(getFileExplorerOperationOwner(worktree.id), coordinatorOwner)
        )
        .map((worktree) => ({ worktree, repo: repoById.get(worktree.repoId) ?? null }))
        .sort((left, right) =>
          (left.repo?.displayName ?? left.worktree.path).localeCompare(
            right.repo?.displayName ?? right.worktree.path
          )
        )
    }
  }, [activeWorktreeId, inputs, isFolder])

  const selectedId = activeWorktreeId ? selectedByWorkspace[activeWorktreeId] : undefined
  const selected = pickFolderWorkspaceExplorerMember(members, selectedId, folderPath)

  const select = useCallback(
    (worktreeId: string) => {
      if (activeWorktreeId) {
        setSelectedByWorkspace((current) => ({ ...current, [activeWorktreeId]: worktreeId }))
      }
    },
    [activeWorktreeId]
  )

  useMemberGitStatusRefresh(members)
  return { members, selected, select }
}

function useMemberGitStatusRefresh(members: readonly FolderWorkspaceExplorerMember[]): void {
  const setGitStatus = useAppStore((s) => s.setGitStatus)
  const updateWorktreeGitIdentity = useAppStore((s) => s.updateWorktreeGitIdentity)
  const setUpstreamStatus = useAppStore((s) => s.setUpstreamStatus)
  const fetchUpstreamStatus = useAppStore((s) => s.fetchUpstreamStatus)
  const memberKey = members
    .map((member) => `${member.worktree.id}\0${member.worktree.path}`)
    .join('\n')

  useEffect(() => {
    if (members.length < 2) {
      return
    }
    const controller = new AbortController()
    const refresh = (): void => {
      if (!isWindowVisible()) {
        return
      }
      for (const { worktree } of members) {
        void refreshGitStatusForWorktree({
          settings: getRightSidebarWorktreeRuntimeSettings(worktree.id),
          worktreeId: worktree.id,
          worktreePath: worktree.path,
          connectionId: getConnectionId(worktree.id) ?? undefined,
          pushTarget: worktree.pushTarget,
          deps: { setGitStatus, updateWorktreeGitIdentity, setUpstreamStatus, fetchUpstreamStatus },
          request: {
            admissionTier: 'background',
            reuseLineStats: true,
            signal: controller.signal,
            shouldApply: () => !controller.signal.aborted
          }
        }).catch(() => {})
      }
    }
    refresh()
    const timer = setInterval(refresh, MEMBER_STATUS_INTERVAL_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- memberKey is the member identity signal; the array changes every render.
  }, [memberKey, fetchUpstreamStatus, setGitStatus, setUpstreamStatus, updateWorktreeGitIdentity])
}
