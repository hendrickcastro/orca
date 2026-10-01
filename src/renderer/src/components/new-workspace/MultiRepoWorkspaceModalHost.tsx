import { useAppStore } from '@/store'
import MultiRepoWorkspaceDialog from './MultiRepoWorkspaceDialog'
import { readMultiRepoInitialValues } from './multi-repo-linked-task'

/** Root-mounted entry so the single-repository composer can hand a task over to several repos. */
export default function MultiRepoWorkspaceModalHost(): React.JSX.Element {
  const modalData = useAppStore((state) => state.modalData)
  const closeModal = useAppStore((state) => state.closeModal)
  return (
    <MultiRepoWorkspaceDialog
      onClose={closeModal}
      initial={readMultiRepoInitialValues(modalData)}
    />
  )
}
