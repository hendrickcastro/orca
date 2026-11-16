import type { TaskProvider } from '../../../../shared/work-items/task-providers'
import {
  buildLinearLaunchContextBlock,
  buildLinkedTaskContextBlocks,
  isLinearWorkItemReference,
  type LinkedWorkItemContext
} from './linked-work-item-context'

/** Fork: launch context for a linked task (URL plus contained provider prose) used by multi-repo tasks. */
export function getLinkedWorkItemPromptContext(
  linkedWorkItem:
    | (Pick<
        { provider?: TaskProvider; url: string; title?: string; linearIdentifier?: string },
        'provider' | 'url' | 'title' | 'linearIdentifier'
      > & { linkedContext?: LinkedWorkItemContext })
    | null
    | undefined
): { linkedUrls: string[]; linkedContextBlocks: string[] } {
  if (isLinearWorkItemReference(linkedWorkItem)) {
    const linearBlock = buildLinearLaunchContextBlock({
      provider: linkedWorkItem?.provider,
      identifier: linkedWorkItem?.linearIdentifier,
      title: linkedWorkItem?.title,
      url: linkedWorkItem?.url
    })
    return linearBlock
      ? { linkedUrls: [], linkedContextBlocks: [linearBlock] }
      : { linkedUrls: [], linkedContextBlocks: [] }
  }
  const linkedUrl = linkedWorkItem?.url?.trim()
  const linkedContextBlocks = linkedWorkItem ? buildLinkedTaskContextBlocks(linkedWorkItem) : []
  return { linkedUrls: linkedUrl ? [linkedUrl] : [], linkedContextBlocks }
}
