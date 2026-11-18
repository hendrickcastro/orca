import { useAppStore } from '@/store/index'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import { revealTerminalPane } from '@/lib/workspace/activation/reveal-terminal-pane'
import { activateAiVaultStructuredSession } from '@/lib/agent-session/open/activate-ai-vault-structured-session'
import { buildAiVaultResumeStartupForWorktree } from '@/lib/agent-session/resume/history/ai-vault-resume-command'
import {
  dropDeletedRemoteResumeCwd,
  prepareAiVaultSessionForTerminalResume
} from '@/lib/agent-session/resume/history/ai-vault-session-resume-preparation'
import { launchAiVaultSessionAndReveal } from '@/lib/agent-session/resume/history/launch-ai-vault-session-and-reveal'
import { collectAgentPaneConversations } from '@/lib/agent-session/identity/pane-agent-conversations'
import { parsePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import type { AgentType } from '../../../../shared/agent-status/contracts/agent-status-types'
import { createNonSecureContextUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import type { AiVaultSession } from '../../../../shared/ai-vault/contracts/ai-vault-types'
import type { BookConversation, BookEntry } from '../../../../shared/fork-book/book-catalog-types'
import { findBookWorktree } from './book-entry-snapshot'

/** `conversation-missing`: the workspace is there but the saved conversation could not be reopened. */
export type BookOpenOutcome = 'opened' | 'workspace-gone' | 'conversation-missing' | 'failed'

function matchesConversation(session: AiVaultSession, conversation: BookConversation): boolean {
  if (session.subagent) {
    return false
  }
  return conversation.chatSessionId
    ? session.structuredSession?.sessionId === conversation.chatSessionId
    : session.agent === conversation.agent && session.sessionId === conversation.providerSessionId
}

/** The saved conversation's AI Vault row: scoped to where it ran first, then the recent list. */
export async function findBookConversationSession(
  entry: BookEntry
): Promise<AiVaultSession | null> {
  const conversation = entry.conversation
  if (!conversation) {
    return null
  }
  const scopePaths = [conversation.cwd, entry.path].filter((path): path is string => Boolean(path))
  const attempts = scopePaths.length > 0 ? [{ scopePaths, scopeOnly: true }, {}] : [{}]
  for (const args of attempts) {
    const listed = await window.api.aiVault.listSessions({
      ...args,
      requestToken: createNonSecureContextUuid()
    })
    const match = listed.sessions.find((session) => matchesConversation(session, conversation))
    if (match) {
      return match
    }
  }
  return null
}

/** Focuses the conversation only while its agent still runs in an open tab. */
function focusLivePane(conversation: BookConversation): boolean {
  const isSavedAgent = (agent: AgentType | null | undefined): agent is AgentType =>
    agent === conversation.agent
  const live = collectAgentPaneConversations(useAppStore.getState(), isSavedAgent, {
    runningAgentsOnly: true
  }).find((candidate) => candidate.providerSession.id === conversation.providerSessionId)
  const pane = live ? parsePaneKey(live.paneKey) : null
  if (!live || !pane) {
    return false
  }
  return revealTerminalPane({
    worktreeId: live.worktreeId,
    tabId: live.tabId,
    leafId: pane.leafId,
    executionHostId: live.executionHostId
  })
}

async function resumeInTerminal(worktreeId: string, session: AiVaultSession): Promise<boolean> {
  const prepared = await prepareAiVaultSessionForTerminalResume(session).then(
    dropDeletedRemoteResumeCwd
  )
  const state = useAppStore.getState()
  const startup = buildAiVaultResumeStartupForWorktree({
    state,
    worktreeId,
    session: prepared,
    commandOverride: state.settings?.agentCmdOverrides?.[session.agent]
  })
  return (
    (await launchAiVaultSessionAndReveal({ agent: session.agent, worktreeId, ...startup })) !== null
  )
}

/**
 * Returns to the saved conversation: its open tab, else a resume from history in the same
 * workspace. A removed workspace is reported so the caller can offer to recreate it.
 */
export async function openBookEntry(entry: BookEntry): Promise<BookOpenOutcome> {
  const worktree = findBookWorktree(useAppStore.getState(), entry.workspaceId)
  if (!worktree) {
    return 'workspace-gone'
  }
  const conversation = entry.conversation
  if (!conversation) {
    if (entry.importedContext) {
      return 'conversation-missing'
    }
    return activateAndRevealWorkspace(worktree.id) === false ? 'failed' : 'opened'
  }
  if (conversation.chatSessionId) {
    const opened = await activateAiVaultStructuredSession({
      structuredSession: { sessionId: conversation.chatSessionId, workspaceId: worktree.id },
      agent: conversation.agent
    })
    return opened ? 'opened' : 'failed'
  }
  if (focusLivePane(conversation)) {
    return 'opened'
  }
  try {
    const session = await findBookConversationSession(entry)
    if (session && (await resumeInTerminal(worktree.id, session))) {
      return 'opened'
    }
  } catch {
    // Fall through: the caller explains the conversation is missing and offers a new agent.
  }
  return 'conversation-missing'
}
