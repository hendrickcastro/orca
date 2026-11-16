import type React from 'react'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import type { WorktreeRow } from '../../../../../shared/sidebar-list/row-types'

const stopRowGesture = (event: React.SyntheticEvent): void => event.stopPropagation()

/** Names a Pinned project block above its first card; a caption, not a control. */
export function PinnedProjectLabel({ row }: { row: WorktreeRow }): React.JSX.Element | null {
  if (!row.pinnedProjectLabel) {
    return null
  }
  return (
    <div
      className="flex h-6 items-center gap-1.5 pt-1 pl-2.5 text-2xs font-semibold tracking-wider text-worktree-sidebar-foreground/45 uppercase"
      onClick={stopRowGesture}
      onPointerDown={stopRowGesture}
    >
      {row.repo ? (
        <RepoIconGlyph repoIcon={row.repo.repoIcon} className="size-3" iconClassName="size-3" />
      ) : null}
      <span className="min-w-0 truncate">{row.pinnedProjectLabel}</span>
    </div>
  )
}
