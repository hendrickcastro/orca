import type React from 'react'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import {
  PINNED_AGENTS_WORKBENCH_COLUMN_ARRANGEMENTS,
  PINNED_AGENTS_WORKBENCH_ROW_HEIGHTS,
  PINNED_AGENTS_WORKBENCH_SHAPED_ARRANGEMENTS,
  normalizePinnedAgentsWorkbenchArrangement,
  normalizePinnedAgentsWorkbenchRowHeight,
  type PinnedAgentsWorkbenchArrangement,
  type PinnedAgentsWorkbenchRowHeight
} from './pinned-agents-workbench-layout'

function arrangementLabel(arrangement: PinnedAgentsWorkbenchArrangement): string {
  switch (arrangement) {
    case 'auto':
      return translate('pinnedAgentsPanel.workbench.layout.columnsAuto', 'Automatic')
    case 'columns-1':
      return translate('pinnedAgentsPanel.workbench.layout.columnsOne', '1 column')
    case 'columns-2':
      return translate('pinnedAgentsPanel.workbench.layout.columnsTwo', '2 columns')
    case 'columns-3':
      return translate('pinnedAgentsPanel.workbench.layout.columnsThree', '3 columns')
    case 'columns-4':
      return translate('pinnedAgentsPanel.workbench.layout.columnsFour', '4 columns')
    case 'one-top-two-bottom':
      return translate(
        'pinnedAgentsPanel.workbench.layout.oneTopTwoBottom',
        'One on top, two below'
      )
    case 'two-top-one-bottom':
      return translate(
        'pinnedAgentsPanel.workbench.layout.twoTopOneBottom',
        'Two on top, one below'
      )
    case 'one-left-two-right':
      return translate(
        'pinnedAgentsPanel.workbench.layout.oneLeftTwoRight',
        'One on the left, two on the right'
      )
    case 'two-left-one-right':
      return translate(
        'pinnedAgentsPanel.workbench.layout.twoLeftOneRight',
        'Two on the left, one on the right'
      )
  }
}

function rowHeightLabel(rowHeight: PinnedAgentsWorkbenchRowHeight): string {
  switch (rowHeight) {
    case 'compact':
      return translate('pinnedAgentsPanel.workbench.layout.rowsCompact', 'Compact')
    case 'normal':
      return translate('pinnedAgentsPanel.workbench.layout.rowsNormal', 'Normal')
    case 'tall':
      return translate('pinnedAgentsPanel.workbench.layout.rowsTall', 'Tall')
  }
}

/** Arrangement and pane height for the centre grid. */
export function PinnedAgentsWorkbenchLayoutMenu({
  arrangement,
  rowHeight,
  onChange
}: {
  arrangement: PinnedAgentsWorkbenchArrangement
  rowHeight: PinnedAgentsWorkbenchRowHeight
  onChange: (next: {
    arrangement?: PinnedAgentsWorkbenchArrangement
    rowHeight?: PinnedAgentsWorkbenchRowHeight
  }) => void
}): React.JSX.Element {
  const label = translate('pinnedAgentsPanel.workbench.layout.title', 'Layout')
  const renderArrangement = (option: PinnedAgentsWorkbenchArrangement): React.JSX.Element => (
    <DropdownMenuRadioItem key={option} value={option}>
      {arrangementLabel(option)}
    </DropdownMenuRadioItem>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="xs" aria-label={label}>
          <LayoutGrid className="size-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {translate('pinnedAgentsPanel.workbench.layout.columns', 'Columns')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={arrangement}
          onValueChange={(value) =>
            onChange({ arrangement: normalizePinnedAgentsWorkbenchArrangement(value) })
          }
        >
          {PINNED_AGENTS_WORKBENCH_COLUMN_ARRANGEMENTS.map(renderArrangement)}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>
            {translate('pinnedAgentsPanel.workbench.layout.shapes', 'Arrangements')}
          </DropdownMenuLabel>
          {PINNED_AGENTS_WORKBENCH_SHAPED_ARRANGEMENTS.map(renderArrangement)}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          {translate('pinnedAgentsPanel.workbench.layout.rows', 'Pane height')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={rowHeight}
          onValueChange={(value) =>
            onChange({ rowHeight: normalizePinnedAgentsWorkbenchRowHeight(value) })
          }
        >
          {PINNED_AGENTS_WORKBENCH_ROW_HEIGHTS.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {rowHeightLabel(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
