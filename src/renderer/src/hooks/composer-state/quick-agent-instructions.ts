import { resolveQuickCreateLinkedWorkItemPrompt } from '@/lib/linked-work-item-context'

type LinkedWorkItemArg = Parameters<typeof resolveQuickCreateLinkedWorkItemPrompt>[0]

/**
 * Quick-create startup prompt: the user's instructions first, then the note and the linked task.
 * With no linked task the instructions alone become the draft, so typed guidance is never lost.
 */
export function resolveQuickCreateAgentPrompt(args: {
  hasAgent: boolean
  linkedWorkItem: LinkedWorkItemArg
  instructions: string
  note: string
}): { prompt: string; draftPrompt: string | null } {
  const instructions = args.hasAgent ? args.instructions.trim() : ''
  const resolved = resolveQuickCreateLinkedWorkItemPrompt(
    args.hasAgent ? args.linkedWorkItem : null,
    [instructions, args.note.trim()].filter(Boolean).join('\n\n')
  )
  return {
    prompt: resolved.prompt,
    draftPrompt: resolved.draftPrompt ?? (instructions || null)
  }
}
