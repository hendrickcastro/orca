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
    lastActiveAt: Date.parse(session.updatedAt ?? session.modifiedAt) || 0
  }
}

/** Past conversations that ran in the workspace, newest first, for when its agent was closed. */
export function useBookHistoryConversations(path: string | undefined): BookConversationCandidate[] {
  const [candidates, setCandidates] = useState<BookConversationCandidate[]>([])
  useEffect(() => {
    if (!path) {
      setCandidates([])
      return
    }
    let current = true
    void window.api.aiVault
      .listSessions({
        scopePaths: [path],
        scopeOnly: true,
        requestToken: createNonSecureContextUuid()
      })
      .then((listed) => {
        if (current) {
          setCandidates(
            listed.sessions
              .filter((session) => !session.subagent)
              .map(toCandidate)
              .sort((left, right) => right.lastActiveAt - left.lastActiveAt)
              .slice(0, HISTORY_CANDIDATE_LIMIT)
          )
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
