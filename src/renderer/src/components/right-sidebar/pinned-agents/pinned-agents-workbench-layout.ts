import type React from 'react'

/** How the panes are arranged. Shaped presets place the first three panes; any others flow after them. */
export type PinnedAgentsWorkbenchArrangement =
  | 'auto'
  | 'columns-1'
  | 'columns-2'
  | 'columns-3'
  | 'columns-4'
  | 'one-top-two-bottom'
  | 'two-top-one-bottom'
  | 'one-left-two-right'
  | 'two-left-one-right'
export type PinnedAgentsWorkbenchRowHeight = 'compact' | 'normal' | 'tall'

export const PINNED_AGENTS_WORKBENCH_COLUMN_ARRANGEMENTS: readonly PinnedAgentsWorkbenchArrangement[] =
  ['auto', 'columns-1', 'columns-2', 'columns-3', 'columns-4']
export const PINNED_AGENTS_WORKBENCH_SHAPED_ARRANGEMENTS: readonly PinnedAgentsWorkbenchArrangement[] =
  ['one-top-two-bottom', 'two-top-one-bottom', 'one-left-two-right', 'two-left-one-right']
export const PINNED_AGENTS_WORKBENCH_ROW_HEIGHTS: readonly PinnedAgentsWorkbenchRowHeight[] = [
  'compact',
  'normal',
  'tall'
]

const ROW_MIN_HEIGHT_PX: Record<PinnedAgentsWorkbenchRowHeight, number> = {
  compact: 260,
  normal: 360,
  tall: 540
}

/**
 * Why classes: the grid's children are the panes in order, so nth-child places the shaped
 * presets without the renderer having to know a pane's index across workspaces.
 */
const GRID_CLASS_NAME: Record<PinnedAgentsWorkbenchArrangement, string> = {
  auto: '',
  'columns-1': 'grid-cols-1',
  'columns-2': 'grid-cols-2',
  'columns-3': 'grid-cols-3',
  'columns-4': 'grid-cols-4',
  'one-top-two-bottom': 'grid-cols-2 [&>:nth-child(1)]:col-span-2',
  'two-top-one-bottom': 'grid-cols-2 [&>:nth-child(3)]:col-span-2',
  'one-left-two-right': 'grid-cols-2 [&>:nth-child(1)]:row-span-2',
  'two-left-one-right':
    'grid-cols-2 [&>:nth-child(1)]:col-start-1 [&>:nth-child(2)]:col-start-1 [&>:nth-child(3)]:col-start-2 [&>:nth-child(3)]:row-start-1 [&>:nth-child(3)]:row-span-2'
}

export function normalizePinnedAgentsWorkbenchArrangement(
  value: unknown
): PinnedAgentsWorkbenchArrangement {
  return (
    [
      ...PINNED_AGENTS_WORKBENCH_COLUMN_ARRANGEMENTS,
      ...PINNED_AGENTS_WORKBENCH_SHAPED_ARRANGEMENTS
    ].find((arrangement) => arrangement === value) ?? 'auto'
  )
}

export function normalizePinnedAgentsWorkbenchRowHeight(
  value: unknown
): PinnedAgentsWorkbenchRowHeight {
  return value === 'compact' || value === 'tall' ? value : 'normal'
}

export function pinnedAgentsWorkbenchGridClassName(
  arrangement: PinnedAgentsWorkbenchArrangement
): string {
  return GRID_CLASS_NAME[arrangement]
}

/** The auto arrangement flows panes to as many columns as fit; the others fix their columns through classes. */
export function pinnedAgentsWorkbenchGridStyle(args: {
  arrangement: PinnedAgentsWorkbenchArrangement
  rowHeight: PinnedAgentsWorkbenchRowHeight
}): React.CSSProperties {
  return {
    ...(args.arrangement === 'auto'
      ? { gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }
      : {}),
    gridAutoRows: `minmax(${ROW_MIN_HEIGHT_PX[args.rowHeight]}px, 1fr)`
  }
}
