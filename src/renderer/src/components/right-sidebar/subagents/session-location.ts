import type { AgentDotState } from '@/components/AgentStateDot'
import type { AppState } from '@/store/types'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import { parseWorkspaceKey } from '../../../../../shared/workspace-scope'
import { findSessionPane } from './session-pane-navigation'

type LocationInputs = Pick<
  AppState,
  'agentStatusByPaneKey' | 'tabsByWorktree' | 'worktreesByRepo' | 'repos' | 'folderWorkspaces'
>

function comparablePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function workspaceLabel(state: LocationInputs, workspaceId: string): string | null {
  const scope = parseWorkspaceKey(workspaceId)
  if (scope?.type === 'folder') {
    return (
      state.folderWorkspaces.find((workspace) => workspace.id === scope.folderWorkspaceId)?.name ??
      null
    )
  }
  for (const [repoId, worktrees] of Object.entries(state.worktreesByRepo)) {
    const worktree = worktrees.find((candidate) => candidate.id === workspaceId)
    if (worktree) {
      const repo = state.repos.find((candidate) => candidate.id === repoId)
      return repo ? `${repo.displayName} / ${worktree.displayName}` : worktree.displayName
    }
  }
  return null
}

function cwdLabel(state: LocationInputs, cwd: string | null): string | null {
  if (!cwd) {
    return null
  }
  const target = comparablePath(cwd)
  for (const [repoId, worktrees] of Object.entries(state.worktreesByRepo)) {
    const worktree = worktrees.find((candidate) => comparablePath(candidate.path) === target)
    if (worktree) {
      const repo = state.repos.find((candidate) => candidate.id === repoId)
      return repo ? `${repo.displayName} / ${worktree.displayName}` : worktree.displayName
    }
  }
  return target.split('/').pop() || null
}

/** "Project / workspace" where the session's agent runs: its terminal's owner, else its folder. */
export function selectSessionLocationLabel(
  state: LocationInputs,
  session: Pick<AiVaultSession, 'sessionId' | 'filePath' | 'cwd'>
): string | null {
  const pane = findSessionPane(state, session)
  return (pane && workspaceLabel(state, pane.worktreeId)) ?? cwdLabel(state, session.cwd)
}

/** The parent agent's live state when Orca tracks its terminal. */
export function selectSessionAgentDotState(
  state: LocationInputs,
  session: Pick<AiVaultSession, 'sessionId' | 'filePath'>
): AgentDotState | null {
  const pane = findSessionPane(state, session)
  return pane ? (state.agentStatusByPaneKey[pane.paneKey]?.state ?? null) : null
}
