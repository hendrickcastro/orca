import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import type { AiVaultSession } from '../../../../../shared/ai-vault-types'
import {
  buildSubagentResultMarkdown,
  withSubagentActivity,
  type SubagentResultDocumentLabels
} from './subagent-result-document'

function documentLabels(): SubagentResultDocumentLabels {
  return {
    fallbackTitle: translate('subagentsPanel.document.fallbackTitle', 'Subagent result'),
    agent: translate('subagentsPanel.document.agent', 'Agent'),
    parentTask: translate('subagentsPanel.document.parentTask', 'Launched by'),
    status: translate('subagentsPanel.document.status', 'Status'),
    finished: translate('subagentsPanel.document.finished', 'Finished'),
    failed: translate('subagentsPanel.document.failed', 'Failed'),
    inProgress: translate('subagentsPanel.document.inProgress', 'In progress'),
    result: translate('subagentsPanel.document.result', 'Result'),
    noResult: translate('subagentsPanel.document.noResult', 'No final answer yet.'),
    prompt: translate('subagentsPanel.document.prompt', 'Assignment'),
    recentActivity: translate('subagentsPanel.document.recentActivity', 'Recent activity')
  }
}

function reportOpenFailure(): void {
  toast.error(translate('subagentsPanel.openFailed', "Couldn't open this subagent's result."))
}

/** Renders a subagent's answer into a read-only Markdown tab; a repeat open refreshes that tab. */
export async function openSubagentResult(
  subagent: Pick<AiVaultSession, 'filePath' | 'executionHostId' | 'title'>,
  parentTitle: string | null
): Promise<void> {
  if (!useAppStore.getState().activeWorktreeId) {
    return
  }
  const target = { filePath: subagent.filePath, executionHostId: subagent.executionHostId }
  try {
    const read = await window.api.subagentResults.read(target)
    if (!read.ok) {
      reportOpenFailure()
      return
    }
    const markdown = buildSubagentResultMarkdown({
      detail: {
        ...withSubagentActivity(read.detail),
        description: read.detail.description ?? subagent.title,
        finishedAt: read.detail.finishedAt
          ? new Date(read.detail.finishedAt).toLocaleString()
          : null
      },
      parentTitle,
      labels: documentLabels()
    })
    const written = await window.api.subagentResults.writeDocument({ ...target, markdown })
    if (!written.ok) {
      reportOpenFailure()
      return
    }
    const state = useAppStore.getState()
    // Why: read after the awaits so a workspace switch mid-load opens the tab where the user now is.
    const worktreeId = state.activeWorktreeId
    if (!worktreeId) {
      return
    }
    // Why: a preview tab keeps the content it first loaded; reopening is how a newer answer shows.
    const stale = state.openFiles.find(
      (file) =>
        file.mode === 'markdown-preview' &&
        file.filePath === written.path &&
        file.worktreeId === worktreeId
    )
    if (stale) {
      state.closeFile(stale.id)
    }
    useAppStore.getState().openMarkdownPreview(
      {
        filePath: written.path,
        // Why: the document lives outside the workspace; keep the external-file contract exact.
        relativePath: written.path,
        worktreeId,
        runtimeEnvironmentId: null,
        language: 'markdown'
      },
      { targetGroupId: state.activeGroupIdByWorktree?.[worktreeId] ?? undefined }
    )
  } catch {
    reportOpenFailure()
  }
}
