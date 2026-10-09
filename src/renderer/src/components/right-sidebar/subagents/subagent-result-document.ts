import type { SubagentResultDetail } from '../../../../../shared/subagent-results-types'

export type SubagentResultDocumentLabels = {
  fallbackTitle: string
  agent: string
  parentTask: string
  status: string
  finished: string
  failed: string
  inProgress: string
  result: string
  noResult: string
  prompt: string
}

function statusLabel(
  detail: Pick<SubagentResultDetail, 'finished' | 'failed'>,
  labels: SubagentResultDocumentLabels
): string {
  if (detail.failed) {
    return labels.failed
  }
  return detail.finished ? labels.finished : labels.inProgress
}

/** The read-only Markdown the result tab shows: the answer first, then the task it answers. */
export function buildSubagentResultMarkdown(args: {
  detail: SubagentResultDetail
  parentTitle: string | null
  labels: SubagentResultDocumentLabels
}): string {
  const { detail, labels } = args
  const meta = [
    detail.agentType ? `**${labels.agent}:** ${detail.agentType}` : null,
    args.parentTitle ? `**${labels.parentTask}:** ${args.parentTitle}` : null,
    `**${labels.status}:** ${statusLabel(detail, labels)}${
      detail.finishedAt ? ` · ${detail.finishedAt}` : ''
    }`
  ].filter((line) => line !== null)
  const sections = [
    `# ${detail.description ?? labels.fallbackTitle}`,
    meta.join('  \n'),
    `## ${labels.result}`,
    detail.result?.trim() || `_${labels.noResult}_`
  ]
  if (detail.prompt?.trim()) {
    sections.push(`## ${labels.prompt}`, detail.prompt.trim())
  }
  return `${sections.join('\n\n')}\n`
}
