import type { LinkedWorkItemSummary } from '@/lib/new-workspace'
import { buildAgentPromptWithContext } from '@/lib/agent-prompt-with-linked-context'
import { getLinkedWorkItemPromptContext } from '@/lib/linked-work-item-context'

/** Values the single-repository composer hands over when the user switches to several repositories. */
export type MultiRepoInitialValues = {
  name?: string
  prompt?: string
  linkedWorkItem?: LinkedWorkItemSummary | null
}

function isLinkedWorkItemSummary(value: unknown): value is LinkedWorkItemSummary {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof value.title === 'string' &&
    'url' in value &&
    typeof value.url === 'string' &&
    'number' in value &&
    typeof value.number === 'number' &&
    'type' in value &&
    (value.type === 'issue' || value.type === 'pr' || value.type === 'mr')
  )
}

export function readMultiRepoInitialValues(data: Record<string, unknown>): MultiRepoInitialValues {
  return {
    name: typeof data.name === 'string' ? data.name : undefined,
    prompt: typeof data.prompt === 'string' ? data.prompt : undefined,
    linkedWorkItem: isLinkedWorkItemSummary(data.linkedWorkItem) ? data.linkedWorkItem : null
  }
}

/** Task name for the coordinator: the user's name, else the linked task's title. */
export function defaultMultiRepoTaskName(initial: MultiRepoInitialValues): string {
  return initial.name?.trim() || initial.linkedWorkItem?.title.trim() || ''
}

/** The coordinator prompt: the user's instructions, then the linked task link and its contained details. */
export function buildMultiRepoPromptWithLinkedTask(
  prompt: string,
  linkedWorkItem: LinkedWorkItemSummary | null
): string {
  if (!linkedWorkItem) {
    return prompt
  }
  const context = getLinkedWorkItemPromptContext(linkedWorkItem)
  return buildAgentPromptWithContext(prompt, [], context.linkedUrls, context.linkedContextBlocks)
}
