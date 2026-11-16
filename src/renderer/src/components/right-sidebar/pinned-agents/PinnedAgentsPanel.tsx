import { useMemo } from 'react'
import type React from 'react'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { PinnedAgentsPanelItem } from './pinned-agents-panel-selection'
import { PinnedAgentsWorkspaceCard } from './PinnedAgentsWorkspaceCard'
import { PinnedIdleWorkspaceChip } from './PinnedIdleWorkspaceChip'
import { flattenPinnedWorkspaces, usePinnedLiveAgentRows } from './pinned-live-agents'
import { usePinnedAgentsPanel } from './use-pinned-agents-panel'

function PanelMessage({ title, copy }: { title: string; copy: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-2 max-w-[16rem] text-xs leading-5 text-muted-foreground">{copy}</div>
    </div>
  )
}

/** A pinned workspace's card, only while one of its agents is live. */
function LiveWorkspaceCard({ item }: { item: PinnedAgentsPanelItem }): React.JSX.Element | null {
  const rows = usePinnedLiveAgentRows(item.entry.id)
  return rows.length > 0 ? <PinnedAgentsWorkspaceCard item={item} /> : null
}

/** The live agents of every pinned workspace, from any project, independent of the active one. */
export default function PinnedAgentsPanel(): React.JSX.Element {
  const { catalog } = usePinnedAgentsPanel()
  const items = useMemo(() => flattenPinnedWorkspaces(catalog), [catalog])
  const setActiveView = useAppStore((s) => s.setActiveView)
  const openCentreLabel = translate('pinnedAgentsPanel.workbench.open', 'Show in the centre')

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
                'pinnedAgentsPanel.liveSubtitle',
                'Agents working in your pinned workspaces'
              )}
            </div>
          </div>
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
      {items.length === 0 ? (
        <PanelMessage
          title={translate('pinnedAgentsPanel.workbench.noPinnedTitle', 'Nothing pinned yet')}
          copy={translate(
            'pinnedAgentsPanel.workbench.noPinnedCopy',
            'Pin workspaces or multi-repository tasks in the sidebar. Their agents appear here as soon as they start working.'
          )}
        />
      ) : (
        <>
          <div
            data-pinned-agents-cards=""
            className="scrollbar-sleek min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2 empty:hidden"
          >
            {items.map((item) => (
              <LiveWorkspaceCard key={item.entry.id} item={item} />
            ))}
          </div>
          <div className="hidden flex-1 [[data-pinned-agents-cards]:empty+&]:flex">
            <PanelMessage
              title={translate(
                'pinnedAgentsPanel.workbench.noLiveTitle',
                'No agent is working right now'
              )}
              copy={translate(
                'pinnedAgentsPanel.workbench.noLiveCopy',
                'When an agent starts in one of your pinned workspaces, its terminal or chat appears here.'
              )}
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border px-3 py-2 [&:not(:has(button))]:hidden">
            <span className="text-[11px] text-muted-foreground">
              {translate('pinnedAgentsPanel.workbench.idleLabel', 'No agents:')}
            </span>
            {items.map((item) => (
              <PinnedIdleWorkspaceChip key={item.entry.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
