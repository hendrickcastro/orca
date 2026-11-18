import { toast } from 'sonner'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import { upsertBookEntry } from '../../../../shared/fork-book/book-catalog-operations'
import { isTuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent-config'
import { createNonSecureContextUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import type { BookEntry } from '../../../../shared/fork-book/book-catalog-types'
import {
  hasBookPendingWork,
  type BookPendingWork
} from '../../../../shared/fork-book/book-context-manifest'
import { useBookStore, BOOK_ALL_ENTRIES } from './book-store'
import { findBookWorktree } from './book-entry-snapshot'
import { findBookConversationSession } from './book-conversation-open'
import { createBookWorkspace, findBookRepo } from './book-workspace-recreate'

function pendingWorkMessage(pending: BookPendingWork): string {
  const reasons: string[] = []
  if (pending.uncommittedFiles.length > 0) {
    reasons.push(
      translate('forkBook.exportDirty', '{{count}} uncommitted files', {
        count: pending.uncommittedFiles.length
      })
    )
  }
  if (!pending.branchOnRemote) {
    reasons.push(translate('forkBook.exportNoUpstream', 'the branch is not on the remote'))
  } else if (pending.unpushedCommits > 0) {
    reasons.push(
      translate('forkBook.exportUnpushed', '{{count}} commits not pushed', {
        count: pending.unpushedCommits
      })
    )
  }
  return reasons.join(' · ')
}

/** Exports the entry's AI summary and full conversation; work not on the remote is only flagged. */
export async function exportBookEntryContext(entry: BookEntry): Promise<void> {
  const worktree = findBookWorktree(useAppStore.getState(), entry.workspaceId)
  const workspacePath = worktree?.path ?? entry.path
  if (!workspacePath) {
    toast.error(translate('forkBook.exportNoWorkspace', 'Open the workspace before exporting.'))
    return
  }
  const toastId = toast.loading(
    translate('forkBook.exportPreparing', 'Preparing the context (summary with AI)…')
  )
  try {
    const session = await findBookConversationSession(entry).catch(() => null)
    const conversation = session
      ? { agent: session.agent, sessionId: session.sessionId, filePath: session.filePath }
      : entry.conversation?.providerSessionId
        ? {
            agent: entry.conversation.agent,
            sessionId: entry.conversation.providerSessionId,
            filePath: entry.conversation.transcriptPath
          }
        : undefined
    const result = await window.api.forkBook.exportContext({
      title: entry.title,
      description: entry.description,
      linkedTask: entry.linkedTask,
      repo: entry.repo,
      repoName: entry.repoName,
      workspacePath,
      roots: [workspacePath, entry.path, entry.conversation?.cwd, session?.cwd ?? undefined].filter(
        (root): root is string => Boolean(root)
      ),
      conversation: conversation
        ? { ...conversation, title: entry.conversation?.title }
        : undefined,
      language: getIntlLocale()
    })
    if (result.status === 'exported' && hasBookPendingWork(result.pendingWork)) {
      toast.warning(
        translate(
          'forkBook.exportedWithPending',
          'Context exported. Code not on the remote does not travel with it.'
        ),
        { id: toastId, description: pendingWorkMessage(result.pendingWork) }
      )
    } else if (result.status === 'exported') {
      toast.success(translate('forkBook.exported', 'Context exported.'), {
        id: toastId,
        description: result.summaryPath
      })
    } else if (result.status === 'no-conversation') {
      toast.error(
        translate(
          'forkBook.exportNoConversation',
          'This entry has no readable conversation. Edit it and pick the conversation to export.'
        ),
        { id: toastId }
      )
    } else if (result.status === 'failed') {
      toast.error(translate('forkBook.exportFailed', 'Could not export the context.'), {
        id: toastId,
        description: result.error
      })
    } else {
      toast.dismiss(toastId)
    }
  } catch (error) {
    toast.error(translate('forkBook.exportFailed', 'Could not export the context.'), {
      id: toastId,
      description: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Imports an exported context: finds the clone of the same repository, opens the branch
 * (reusing a checkout already on it), files a Book entry and offers to continue in a new agent.
 */
export async function importBookContext(): Promise<void> {
  const picked = await window.api.forkBook.pickImport()
  if (picked.status === 'canceled') {
    return
  }
  if (picked.status === 'invalid') {
    toast.error(translate('forkBook.importInvalid', 'This file cannot be imported.'), {
      description: picked.error
    })
    return
  }
  const { manifest } = picked
  const state = useAppStore.getState()
  const repo = findBookRepo(state.repos, manifest.repo, manifest.repoName)
  if (!repo) {
    toast.error(
      translate('forkBook.repoMissing', 'The repository is not open in Orca on this computer.'),
      { description: manifest.repo?.remoteUrl ?? manifest.repoName }
    )
    return
  }
  const worktree = await createBookWorkspace({
    ref: { ...manifest.repo, repoId: repo.id },
    repoName: manifest.repoName,
    branch: manifest.branch,
    displayName: manifest.title,
    allowNewBranch: true
  })
  if (!worktree) {
    return
  }
  const files = await window.api.forkBook.materializeImport({
    summaryPath: picked.summaryPath,
    conversationPath: picked.conversationPath,
    worktreePath: worktree.path,
    folderName: manifest.title
  })
  const now = Date.now()
  const entryId = createNonSecureContextUuid()
  const book = useBookStore.getState()
  await book.ensureLoaded()
  book.commit((catalog) =>
    upsertBookEntry(catalog, {
      id: entryId,
      folderId: book.selectedFolder === BOOK_ALL_ENTRIES ? null : book.selectedFolder,
      title: manifest.title,
      description: manifest.description,
      workspaceId: worktree.id,
      workspaceName: worktree.displayName || manifest.title,
      repoName: manifest.repoName ?? repo.displayName,
      branch: manifest.branch,
      path: worktree.path,
      linkedTask: manifest.linkedTask,
      repo: { ...manifest.repo, repoId: repo.id },
      createdAt: now,
      updatedAt: now
    })
  )
  book.setContinuation({
    entryId,
    sourceWorkingDirectory: worktree.path,
    request: {
      source: {
        sourceAgent: manifest.agent && isTuiAgent(manifest.agent) ? manifest.agent : null,
        capturedText: files.summaryText,
        sourceTitle: manifest.conversationTitle ?? manifest.title,
        sourceWorkingDirectory: worktree.path,
        transcriptPath: files.summaryPath
      },
      worktreeId: worktree.id,
      workspacePath: worktree.path,
      initialCwd: worktree.path,
      launchSource: 'sidebar'
    }
  })
}
