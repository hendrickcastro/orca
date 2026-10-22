import type React from 'react'
import { Pin } from 'lucide-react'
import { translate } from '@/i18n/i18n'

/**
 * The "drop here" cover for a surface that accepts a Pinned-section drag. It renders always and
 * shows itself through CSS while its parent carries the drag-over attribute, so each surface
 * (the right sidebar, the centre area) lights up only when the drag is actually over it.
 */
export function PinnedAgentsDropOverlay(): React.JSX.Element {
  return (
    <div
      data-pinned-agents-drop-overlay=""
      className="pointer-events-none absolute inset-0 z-20 hidden items-center justify-center bg-background/80 p-3 [[data-pinned-agents-drag-over]>&]:flex"
    >
      <div className="flex max-w-[18rem] flex-col items-center gap-2 rounded-md border-2 border-dashed border-ring px-5 py-6 text-center">
        <Pin className="size-5 text-foreground" aria-hidden="true" />
        <span className="text-sm font-medium text-foreground">
          {translate('pinnedAgentsPanel.dropHint', 'Drop to follow its agents here')}
        </span>
      </div>
    </div>
  )
}
