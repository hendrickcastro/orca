import type React from 'react'
import { Workflow } from 'lucide-react'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { translate } from '@/i18n/i18n'
import type { PinnedAgentsPanelItem } from './pinned-agents-panel-selection'
import { usePinnedLiveAgentRows } from './pinned-live-agents'

/** A pinned workspace with no live agent, as one small chip instead of an empty pane. */
export function PinnedIdleWorkspaceChip({
  item
}: {
  item: PinnedAgentsPanelItem
}): React.JSX.Element | null {
  const rows = usePinnedLiveAgentRows(item.entry.id)
  if (rows.length > 0) {
    return null
  }
  const { entry, parent } = item
  const label = parent ? `${entry.projectName} · ${parent.name}` : entry.name
  return (
    <button
      type="button"
      title={translate('pinnedAgentsPanel.workbench.openWorkspace', 'Open its workspace')}
      onClick={() => activateAndRevealWorktree(entry.id)}
      className="inline-flex max-w-[16rem] items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {entry.kind === 'folder' ? <Workflow className="size-3 shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{label}</span>
    </button>
  )
}
