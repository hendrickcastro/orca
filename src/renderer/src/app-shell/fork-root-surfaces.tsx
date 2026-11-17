import { Suspense } from 'react'
import { TerminalFileLinkPreview } from '@/components/file-link-preview/TerminalFileLinkPreview'
import { MultiRepoWorkspaceRootModal } from './multi-repo-workspace-root-modal'
import { BookEntryEditorDialog } from '@/components/fork-book/BookEntryEditorDialog'
import { BookConversationDialogs } from '@/components/fork-book/BookConversationDialogs'

/** Fork-only root surfaces, mounted with one line so upstream's App/AppRootSurfaces stay untouched. */
export function ForkRootSurfaces(): React.JSX.Element {
  return (
    <>
      <TerminalFileLinkPreview />
      <BookEntryEditorDialog />
      <BookConversationDialogs />
      <Suspense fallback={null}>
        <MultiRepoWorkspaceRootModal />
      </Suspense>
    </>
  )
}
