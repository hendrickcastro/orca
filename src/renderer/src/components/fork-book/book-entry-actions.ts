import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { activateAndRevealWorkspace } from '@/lib/workspace/activation/worktree-activation'
import { upsertBookEntry } from '../../../../shared/fork-book/book-catalog-operations'
import type { BookEntry } from '../../../../shared/fork-book/book-catalog-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { useBookStore, type BookWorkspacePrompt } from './book-store'
import { findBookWorktree } from './book-entry-snapshot'
import { openBookEntry } from './book-conversation-open'
import { handOffBookEntry } from './book-handoff'
import { findImportedContextConversation } from './book-imported-context'
import { applyBookWorkspaceSetup, type BookMemberChoice } from './book-workspace-setup'

function latestEntry(entryId: string): BookEntry | undefined {
  return useBookStore.getState().catalog.entries.find((entry) => entry.id === entryId)
}

function commitEntry(entryId: string, update: (entry: BookEntry) => BookEntry): void {
  useBookStore.getState().commit((catalog) => {
    const entry = catalog.entries.find((candidate) => candidate.id === entryId)
    return entry ? upsertBookEntry(catalog, update(entry)) : catalog
  })
}

/** "Open agent": the saved conversation, or the recreate prompt when the workspace is gone. */
export async function openBookEntryAction(entry: BookEntry): Promise<void> {
  const outcome = await openBookEntry(entry)
  if (outcome === 'workspace-gone') {
    useBookStore.getState().setWorkspacePrompt({ entryId: entry.id, next: 'open' })
  } else if (outcome === 'conversation-missing') {
    await recoverBookConversation(entry)
  }
}

/**
 * The workspace is there but its conversation is not: an imported context resumes the agent that
 * already continued it, else starts one from the context; any other entry offers a new agent.
 */
async function recoverBookConversation(entry: BookEntry): Promise<void> {
  const worktree = findBookWorktree(useAppStore.getState(), entry.workspaceId)
  if (!worktree) {
    return
  }
  if (entry.importedContext) {
    const continued = await findImportedContextConversation(entry, worktree).catch(() => null)
    if (continued) {
      commitEntry(entry.id, (current) => ({
        ...current,
        conversation: continued,
        updatedAt: Date.now()
      }))
      if ((await openBookEntry({ ...entry, conversation: continued })) === 'opened') {
        return
      }
    }
    await handOffBookEntry(entry, worktree)
    return
  }
  activateAndRevealWorkspace(worktree.id)
  toast.error(
    translate('forkBook.conversationMissing', 'The saved conversation was not found in history.'),
    {
      action: {
        label: translate('forkBook.handOff', 'Hand off to a new agent'),
        onClick: () => void handOffBookEntry(entry, worktree)
      }
    }
  )
}

/** "Hand off to a new agent", into the live workspace or one recreated on the saved branch. */
export function handOffBookEntryAction(entry: BookEntry): void {
  const worktree = findBookWorktree(useAppStore.getState(), entry.workspaceId)
  if (worktree) {
    void handOffBookEntry(entry, worktree)
    return
  }
  useBookStore.getState().setWorkspacePrompt({ entryId: entry.id, next: 'handoff' })
}

/**
 * Sets the entry up on the chosen repositories and checkouts, then reopens the conversation. A
 * terminal agent resumes only when its folder is still the workspace's; elsewhere it continues in
 * a new agent. `save` only re-points the entry.
 */
export async function setUpAndContinueBookEntry(
  entryId: string,
  choices: readonly BookMemberChoice[],
  next: BookWorkspacePrompt['next']
): Promise<boolean> {
  const entry = latestEntry(entryId)
  const workspace = entry ? await applyBookWorkspaceSetup(entry, choices) : null
  if (!entry || !workspace) {
    return false
  }
  const updated = latestEntry(entryId) ?? entry
  if (next === 'save') {
    return true
  }
  await (next === 'open' && resumesInPlace(updated, workspace)
    ? openBookEntryAction(updated)
    : handOffBookEntry(updated, workspace))
  return true
}

function resumesInPlace(entry: BookEntry, worktree: Worktree): boolean {
  const conversation = entry.conversation
  if (!conversation || conversation.chatSessionId) {
    return !conversation
  }
  const normalize = (path: string | undefined): string =>
    (path ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return normalize(conversation.cwd ?? entry.path) === normalize(worktree.path)
}
