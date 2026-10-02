import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { basename } from '@/lib/path'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { FileExplorerMemberPicker } from './FileExplorerMemberSelect'
import { useFolderWorkspaceExplorerMember } from './use-folder-workspace-explorer-member'

/** What the explorer browses: the workspace itself, or the member worktree a coordinator picked. */
export function useFileExplorerMemberView<W extends Worktree, R extends Repo>(
  activeWorktreeId: string | null,
  workspaceWorktree: W | null,
  workspaceRepo: R | null | undefined
): {
  activeWorktree: Worktree | null
  activeRepo: Repo | null
  gitStatusWorktreeId: string | null
  memberPicker: FileExplorerMemberPicker | null
} {
  // Why: a coordinator (folder workspace) browses one member worktree at a time; files still open in the coordinator.
  const member = useFolderWorkspaceExplorerMember(activeWorktreeId)
  const gitStatusByWorktree = useAppStore((s) => s.gitStatusByWorktree)
  const memberPicker = useMemo((): FileExplorerMemberPicker | null => {
    if (!member.selected) {
      return null
    }
    return {
      value: member.selected.worktree.id,
      onValueChange: member.select,
      options: member.members.map(({ worktree, repo }) => ({
        value: worktree.id,
        label: repo?.displayName ?? basename(worktree.path),
        changedCount: gitStatusByWorktree[worktree.id]?.length ?? null
      }))
    }
  }, [gitStatusByWorktree, member])
  return {
    activeWorktree: member.selected?.worktree ?? workspaceWorktree,
    activeRepo: member.selected ? member.selected.repo : (workspaceRepo ?? null),
    gitStatusWorktreeId: member.selected?.worktree.id ?? activeWorktreeId,
    memberPicker
  }
}
