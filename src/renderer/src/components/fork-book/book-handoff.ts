import { prepareAiVaultSessionContinuation } from '@/components/right-sidebar/ai-vault/session-actions/ai-vault-session-continuation'
import type { AgentSessionContinuationRequest } from '@/lib/agent-session/context/agent-session-continuation'
import { isTuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent-config'
import type { Worktree } from '../../../../shared/worktree/types'
import type { BookEntry } from '../../../../shared/fork-book/book-catalog-types'
import { findBookConversationSession } from './book-conversation-open'
import { importedContextRequest } from './book-imported-context'
import { useBookStore } from './book-store'

function entryOnlyRequest(entry: BookEntry, target: Worktree): AgentSessionContinuationRequest {
  const conversation = entry.conversation
  return {
    source: {
      sourceAgent: conversation && isTuiAgent(conversation.agent) ? conversation.agent : null,
      capturedText: [entry.title, entry.description].filter(Boolean).join('\n\n'),
      sourceTitle: conversation?.title ?? entry.title,
      sourceWorkingDirectory: conversation?.cwd ?? entry.path ?? null,
      transcriptPath: conversation?.transcriptPath ?? null
    },
    worktreeId: target.id,
    workspacePath: target.path,
    initialCwd: target.path,
    launchSource: 'sidebar'
  }
}

/**
 * Opens Orca's "continue in a new agent" dialog for a saved or imported conversation, into `target`.
 * The new agent always starts in `target`: the original folder may be the removed workspace.
 */
export async function handOffBookEntry(entry: BookEntry, target: Worktree): Promise<void> {
  const { setContinuation } = useBookStore.getState()
  setContinuation({ entryId: entry.id, request: null })
  let request: AgentSessionContinuationRequest
  try {
    const session = await findBookConversationSession(entry)
    request = session
      ? {
          ...prepareAiVaultSessionContinuation({
            session,
            targetWorktreeId: target.id,
            targetWorkspacePath: target.path
          }),
          initialCwd: target.path
        }
      : ((await importedContextRequest(entry, target)) ?? entryOnlyRequest(entry, target))
  } catch {
    request = entryOnlyRequest(entry, target)
  }
  // The user may have closed the dialog while history loaded.
  if (useBookStore.getState().continuation?.entryId === entry.id) {
    setContinuation({
      entryId: entry.id,
      request,
      sourceWorkingDirectory: entry.conversation?.cwd ?? entry.path
    })
  }
}
