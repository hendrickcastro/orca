import { Suspense } from 'react'
import { TerminalFileLinkPreview } from '@/components/file-link-preview/TerminalFileLinkPreview'
import { MultiRepoWorkspaceRootModal } from './multi-repo-workspace-root-modal'

/** Fork-only root surfaces, mounted with one line so upstream's App/AppRootSurfaces stay untouched. */
export function ForkRootSurfaces(): React.JSX.Element {
  return (
    <>
      <TerminalFileLinkPreview />
      <Suspense fallback={null}>
        <MultiRepoWorkspaceRootModal />
      </Suspense>
    </>
  )
}
