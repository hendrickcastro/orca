import type React from 'react'
import { ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { LineageToggleHandler } from '../worktree-lineage-toggle-handler-cache'

/**
 * Folds a pinned task's repos from the row's own left gutter. Why not the card's child chip:
 * that chip adds a second line to every task even while folded.
 */
export function PinnedTaskDisclosure({
  left,
  open,
  onToggle
}: {
  /** Offset from the row edge, so the arrow follows the card's indent. */
  left: number
  open: boolean
  onToggle: LineageToggleHandler
}): React.JSX.Element {
  const label = open
    ? translate('pinnedFavorites.hideRepos', 'Hide its repositories')
    : translate('pinnedFavorites.showRepos', 'Show its repositories')
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onToggle(event)
      }}
      // Why: the row starts a pointer drag and activates the task on press; the toggle must do neither.
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      style={{ left }}
      className="pointer-events-auto absolute top-[9px] z-10 flex size-3.5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
    </button>
  )
}
