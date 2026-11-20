import type { AppState } from '@/store/types'
import { getProjectIdentityKey } from '../../../../shared/project/host-setup/project-host-setup-projection'
import { structuredAgentSessionPaneKey } from '../../../../shared/agent-session/view/structured-agent-session-projection'
import type { Worktree } from '../../../../shared/worktree/types'
import type { BookConversation, BookRepoRef } from '../../../../shared/fork-book/book-catalog-types'

type ConversationState = Pick<AppState, 'agentStatusByPaneKey' | 'unifiedTabsByWorktree' | 'repos'>

export type BookConversationCandidate = {
  conversation: BookConversation
  /** Most recent activity, so the default pick is the conversation the user last worked in. */
  lastActiveAt: number
  /** When the conversation began, when history knows it. */
  startedAt?: number
}

/** Every agent conversation open in the workspace (and its multi-repo members), newest first. */
export function listBookConversationCandidates(
  state: ConversationState,
  worktreeIds: readonly string[]
): BookConversationCandidate[] {
  const ids = new Set(worktreeIds)
  const candidates: BookConversationCandidate[] = []
  const seen = new Set<string>()
  const tabTitle = (
    worktreeId: string | undefined,
    tabId: string | undefined
  ): string | undefined => {
    if (!worktreeId || !tabId) {
      return undefined
    }
    const tab = state.unifiedTabsByWorktree[worktreeId]?.find((candidate) => candidate.id === tabId)
    return (
      (tab?.customLabel ?? tab?.aiVaultTitle?.title ?? tab?.generatedLabel ?? tab?.label) ||
      undefined
    )
  }

  for (const worktreeId of ids) {
    for (const tab of state.unifiedTabsByWorktree[worktreeId] ?? []) {
      if (tab.contentType !== 'agent-session' || !tab.entityId) {
        continue
      }
      seen.add(`chat:${tab.entityId}`)
      const provider = state.agentStatusByPaneKey.get(
        structuredAgentSessionPaneKey(tab.id, tab.entityId)
      )?.providerSession
      if (provider?.id) {
        seen.add(`cli:${tab.agentSessionAgent ?? 'claude'}:${provider.id}`)
      }
      candidates.push({
        conversation: {
          agent: tab.agentSessionAgent ?? 'claude',
          chatSessionId: tab.entityId,
          providerSessionId: provider?.id,
          title: tabTitle(worktreeId, tab.id),
          cwd: provider?.cwd,
          transcriptPath: provider?.transcriptPath
        },
        lastActiveAt: tab.lastFocusedAt ?? tab.createdAt
      })
    }
  }

  for (const entry of state.agentStatusByPaneKey.values()) {
    const providerId = entry.providerSession?.id
    if (!entry.worktreeId || !ids.has(entry.worktreeId) || !providerId || !entry.agentType) {
      continue
    }
    const key = `cli:${entry.agentType}:${providerId}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    candidates.push({
      conversation: {
        agent: entry.agentType,
        providerSessionId: providerId,
        paneKey: entry.paneKey,
        title: tabTitle(entry.worktreeId, entry.tabId) ?? entry.terminalTitle,
        cwd: entry.providerSession?.cwd,
        transcriptPath: entry.providerSession?.transcriptPath
      },
      lastActiveAt: entry.updatedAt
    })
  }
  return candidates.sort((left, right) => right.lastActiveAt - left.lastActiveAt)
}

/** How to find this checkout again, here or on another computer with a clone of the same remote. */
export function bookRepoRefFor(
  state: Pick<AppState, 'repos'>,
  worktree: Worktree
): BookRepoRef | undefined {
  const repo = state.repos.find((candidate) => candidate.id === worktree.repoId)
  if (!repo) {
    return undefined
  }
  return {
    repoId: repo.id,
    projectId: getProjectIdentityKey(repo),
    remoteUrl: repo.gitRemoteIdentity?.remoteUrl
  }
}
