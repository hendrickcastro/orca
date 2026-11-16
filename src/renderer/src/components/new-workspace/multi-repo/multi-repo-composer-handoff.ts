import { useCallback } from 'react'
import { useAppStore } from '@/store'
import type { ComposerModalData } from '../composer/composer-modal-data'
import type { NewWorkspaceComposerCardProps } from '../composer/new-workspace-composer-card-props'

type HandoffCardProps = Pick<NewWorkspaceComposerCardProps, 'agentPrompt' | 'smartNameSelection'>

// Replacing the modal slot hands the task and typed instructions to the multi-repo flow.
export function useMultiRepoComposerHandoff(
  cardProps: HandoffCardProps,
  modalData: ComposerModalData
): () => void {
  const openModal = useAppStore((s) => s.openModal)
  const { agentPrompt, smartNameSelection } = cardProps
  const linkedWorkItem = modalData.linkedWorkItem ?? null
  return useCallback((): void => {
    openModal('multi-repo-workspace', {
      prompt: agentPrompt,
      linkedWorkItem: smartNameSelection ? linkedWorkItem : null
    })
  }, [agentPrompt, smartNameSelection, linkedWorkItem, openModal])
}
