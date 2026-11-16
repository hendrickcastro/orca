import React from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'

/** Set for a folder workspace coordinating several worktrees: picks which one the explorer browses. */
export type FileExplorerMemberPicker = {
  options: { value: string; label: string; changedCount: number | null }[]
  value: string
  onValueChange: (value: string) => void
}

function changedCountLabel(count: number | null): string | null {
  if (!count) {
    return null
  }
  return translate('fileExplorer.member.changed', '{{value0}} changed', { value0: count })
}

export function FileExplorerMemberSelect({
  picker,
  repoName
}: {
  picker: FileExplorerMemberPicker
  repoName: string
}): React.JSX.Element {
  const selectedCount = picker.options.find((option) => option.value === picker.value)?.changedCount
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="min-w-0 flex-1 justify-start"
          aria-label={translate('fileExplorer.member.label', 'Repository to browse')}
        >
          <span className="truncate">{repoName}</span>
          {changedCountLabel(selectedCount ?? null) ? (
            <span className="shrink-0 text-muted-foreground">
              {changedCountLabel(selectedCount ?? null)}
            </span>
          ) : null}
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={8}
        className="w-72 max-w-[calc(100vw-1rem)]"
      >
        <DropdownMenuRadioGroup value={picker.value} onValueChange={picker.onValueChange}>
          {picker.options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {changedCountLabel(option.changedCount) ? (
                <span className="shrink-0 text-muted-foreground">
                  {changedCountLabel(option.changedCount)}
                </span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
