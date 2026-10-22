import { useCallback } from 'react'
import type React from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { PinnedAgentsWorkspaceCard } from './PinnedAgentsWorkspaceCard'
import { PinnedAgentsWorkspacePicker } from './PinnedAgentsWorkspacePicker'
import { usePinnedAgentsPanel } from './use-pinned-agents-panel'

function PanelMessage({ title, copy }: { title: string; copy: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-2 max-w-[16rem] text-xs leading-5 text-muted-foreground">{copy}</div>
    </div>
  )
}

/** Agents of the pinned workspaces the user chose, from any project, independent of the active one. */
export default function PinnedAgentsPanel(): React.JSX.Element {
  const { catalog, items, shownIds, toggle, remove, move } = usePinnedAgentsPanel()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const openCentreLabel = translate('pinnedAgentsPanel.workbench.open', 'Show in the centre')
  // Why the distance: a plain click on the handle must not start a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const overId = event.over?.id
      if (typeof overId === 'string' && overId !== event.active.id) {
        move(String(event.active.id), overId)
      }
    },
    [move]
  )

  let body: React.JSX.Element
  if (catalog.length === 0) {
    body = (
      <PanelMessage
        title={translate('pinnedAgentsPanel.noPinnedTitle', 'Nothing here yet')}
        copy={translate(
          'pinnedAgentsPanel.noPinnedCopy',
          'Drag a workspace or a multi-repository task from the sidebar and drop it on this panel. Its agents will show here, whichever project you are in.'
        )}
      />
    )
  } else if (items.length === 0) {
    body = (
      <PanelMessage
        title={translate('pinnedAgentsPanel.emptyTitle', 'Nothing selected')}
        copy={translate(
          'pinnedAgentsPanel.emptyCopy',
          'Drop a card from the sidebar here, or use Choose to pick pinned workspaces.'
        )}
      />
    )
  } else {
    body = (
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={items.map((item) => item.entry.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item) => (
                <PinnedAgentsWorkspaceCard key={item.entry.id} item={item} onRemove={remove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {translate('pinnedAgentsPanel.title', 'Pinned')}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {translate(
                'pinnedAgentsPanel.subtitle',
                'Agents of your pinned workspaces, from any project'
              )}
            </div>
          </div>
          <PinnedAgentsWorkspacePicker catalog={catalog} shownIds={shownIds} onToggle={toggle} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label={openCentreLabel}
                onClick={() => setActiveView('pinned-agents')}
              >
                <LayoutGrid className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{openCentreLabel}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {body}
    </div>
  )
}
