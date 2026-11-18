import { useEffect, useState } from 'react'
import { createNonSecureContextUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import type { AiVaultSession } from '../../../../shared/ai-vault/contracts/ai-vault-types'
import type { BookConversationCandidate } from './book-conversations'

const HISTORY_CANDIDATE_LIMIT = 15

function toCandidate(session: AiVaultSession): BookConversationCandidate {
  return {
    conversation: {
      agent: session.agent,
      providerSessionId: session.sessionId,
      chatSessionId: session.structuredSession?.sessionId,
      title: session.title,
      cwd: session.cwd ?? undefined,
      transcriptPath: session.filePath || undefined
    },
    lastActiveAt: Date.parse(session.updatedAt ?? session.modifiedAt) || 0,
    startedAt: session.createdAt ? Date.parse(session.createdAt) || undefined : undefined
  }
}

/** Past conversations that ran in the workspace, newest first. */
export async function listBookHistoryConversations(
  path: string
): Promise<BookConversationCandidate[]> {
  const listed = await window.api.aiVault.listSessions({
    scopePaths: [path],
    scopeOnly: true,
    requestToken: createNonSecureContextUuid()
  })
  return listed.sessions
    .filter((session) => !session.subagent)
    .map(toCandidate)
    .sort((left, right) => right.lastActiveAt - left.lastActiveAt)
    .slice(0, HISTORY_CANDIDATE_LIMIT)
}

/** The workspace's past conversations, for when its agent was closed before saving. */
export function useBookHistoryConversations(path: string | undefined): BookConversationCandidate[] {
  const [candidates, setCandidates] = useState<BookConversationCandidate[]>([])
  useEffect(() => {
    if (!path) {
      setCandidates([])
      return
    }
    let current = true
    void listBookHistoryConversations(path)
      .then((listed) => {
        if (current) {
          setCandidates(listed)
        }
      })
      .catch(() => {
        if (current) {
          setCandidates([])
        }
      })
    return () => {
      current = false
    }
  }, [path])
  return candidates
}
