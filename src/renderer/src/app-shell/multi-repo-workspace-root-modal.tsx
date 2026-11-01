import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import { useAppStore } from '../store'
import { ModalBoundary } from './app-root-surface-boundaries'

const MultiRepoWorkspaceModalHost = lazy(
  () => import('../components/new-workspace/MultiRepoWorkspaceModalHost')
)

/** Root-hosted so the composer and the task page can both hand a task to the multi-repo flow. */
export function MultiRepoWorkspaceRootModal(): React.JSX.Element | null {
  const open = useAppStore((s) => s.activeModal === 'multi-repo-workspace')
  return open ? (
    <ModalBoundary boundaryId="modal.multi-repo-workspace" resetKey>
      <MultiRepoWorkspaceModalHost />
    </ModalBoundary>
  ) : null
}
