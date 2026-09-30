import React from 'react'
import { Workflow } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import WorktreeCardAgents from './WorktreeCardAgents'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'
import { useWorktreeCoordinator } from './worktree-coordinator'

/** The coordinator's agents, shown on each worktree it works in; rows activate the coordinator. */
export function WorktreeCardCoordinatorAgents({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const coordinator = useWorktreeCoordinator(worktreeId)
  const agents = useWorktreeAgentRows(coordinator?.key ?? '', coordinator !== null)
  if (!coordinator || agents.length === 0) {
    return null
  }
  return (
    <div className="mt-0.5 min-w-0">
      <p className="flex min-w-0 items-center gap-1 text-[10.5px] text-muted-foreground">
        <Workflow className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {translate('sidebar.worktreeCoordinator.agentsHeading', 'Coordinator · {{value0}}', {
            value0: coordinator.name
          })}
        </span>
      </p>
      <WorktreeCardAgents worktreeId={coordinator.key} agents={agents} className="mt-0" />
    </div>
  )
}
