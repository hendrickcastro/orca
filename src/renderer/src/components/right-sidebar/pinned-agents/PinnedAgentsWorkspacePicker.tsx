import type React from 'react'
import { ListChecks, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { PinnedWorkspaceEntry } from './pinned-workspaces-catalog'

function PickerRow({
  entry,
  checked,
  nested,
  onToggle
}: {
  entry: PinnedWorkspaceEntry
  checked: boolean
  nested: boolean
  onToggle: (id: string) => void
}): React.JSX.Element {
  const inputId = `pinned-agents-pick-${entry.id}`
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex min-w-0 cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 hover:bg-accent',
        nested && 'ml-4'
      )}
    >
      <Checkbox id={inputId} checked={checked} onCheckedChange={() => onToggle(entry.id)} />
      {entry.kind === 'folder' ? (
        <Workflow className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-foreground">{entry.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {entry.kind === 'folder'
            ? translate('pinnedAgentsPanel.card.task', 'Multi-repository task')
            : entry.projectName}
        </span>
      </span>
    </label>
  )
}

/** Which pinned workspaces the panel follows; tasks list their member worktrees beneath them. */
export function PinnedAgentsWorkspacePicker({
  catalog,
  shownIds,
  onToggle
}: {
  catalog: readonly PinnedWorkspaceEntry[]
  shownIds: ReadonlySet<string>
  onToggle: (id: string) => void
}): React.JSX.Element {
  const label = translate('pinnedAgentsPanel.choose', 'Choose pinned workspaces')
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs" aria-label={label}>
          <ListChecks className="size-3.5" />
          {translate('pinnedAgentsPanel.chooseShort', 'Choose')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="px-1.5 pb-1 text-[11px] font-medium text-muted-foreground">
          {translate('pinnedAgentsPanel.pickerTitle', 'Pinned in the sidebar')}
        </p>
        {catalog.length === 0 ? (
          <p className="px-1.5 py-2 text-[12px] text-muted-foreground">
            {translate(
              'pinnedAgentsPanel.pickerEmpty',
              'Pin a workspace or a multi-repository task from the sidebar and it will be listed here.'
            )}
          </p>
        ) : (
          <div className="scrollbar-sleek max-h-80 space-y-0.5 overflow-y-auto">
            {catalog.map((entry) => (
              <div key={entry.id}>
                <PickerRow
                  entry={entry}
                  checked={shownIds.has(entry.id)}
                  nested={false}
                  onToggle={onToggle}
                />
                {entry.members.map((member) => (
                  <PickerRow
                    key={member.id}
                    entry={member}
                    checked={shownIds.has(member.id)}
                    nested
                    onToggle={onToggle}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
