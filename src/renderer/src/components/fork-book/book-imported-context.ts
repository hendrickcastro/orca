import type { AgentSessionContinuationRequest } from '@/lib/agent-session/context/agent-session-continuation'
import { isTuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent-config'
import type { Worktree } from '../../../../shared/worktree/types'
import type { BookConversation, BookEntry } from '../../../../shared/fork-book/book-catalog-types'
import { listBookHistoryConversations } from './use-book-history-conversations'

/** A new agent in `worktree` that starts from the imported summary, which points to the full file. */
export async function importedContextRequest(
  entry: BookEntry,
  worktree: Worktree
): Promise<AgentSessionContinuationRequest | null> {
  const imported = entry.importedContext
  if (!imported) {
    return null
  }
  const files = await window.api.forkBook.materializeImport({
    summaryPath: imported.summaryPath,
    conversationPath: imported.conversationPath,
    worktreePath: worktree.path,
    folderName: entry.title
  })
  return {
    source: {
      sourceAgent: imported.agent && isTuiAgent(imported.agent) ? imported.agent : null,
      capturedText: files.summaryText,
      sourceTitle: entry.title,
      sourceWorkingDirectory: worktree.path,
      transcriptPath: files.summaryPath
    },
    worktreeId: worktree.id,
    workspacePath: worktree.path,
    initialCwd: worktree.path,
    launchSource: 'sidebar'
  }
}

/** The conversation begun in the workspace after the import: the one that already continued it. */
export async function findImportedContextConversation(
  entry: BookEntry,
  worktree: Worktree
): Promise<BookConversation | null> {
  if (!entry.importedContext) {
    return null
  }
  const candidates = await listBookHistoryConversations(worktree.path)
  return (
    candidates.find((candidate) => (candidate.startedAt ?? 0) >= entry.createdAt)?.conversation ??
    null
  )
}
