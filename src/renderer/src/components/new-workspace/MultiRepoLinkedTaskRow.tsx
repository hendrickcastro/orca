import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { LinkedWorkItemSummary } from '@/lib/new-workspace'
import { buildWorkspaceSourceSelection } from '../../../../shared/new-workspace/workspace-source'
import { SelectionIcon } from './smart-workspace-source-row-content'

/** The task carried over from the Tasks page; its details are sent to the coordinator. */
export function MultiRepoLinkedTaskRow({
  item,
  onRemove
}: {
  item: LinkedWorkItemSummary
  onRemove: () => void
}): React.JSX.Element {
  const selection = buildWorkspaceSourceSelection({ linkedWorkItem: item })
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 text-sm">
      {selection ? <SelectionIcon kind={selection.kind} /> : null}
      <span className="min-w-0 flex-1 truncate">{selection?.label ?? item.title}</span>
      {item.linkedContext ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {translate('multiRepo.linkedTaskDetails', 'Details included')}
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label={translate('multiRepo.removeLinkedTask', 'Remove the linked task')}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
