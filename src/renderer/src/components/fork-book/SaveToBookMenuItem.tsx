import { BookMarked } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import type { Worktree } from '../../../../shared/worktree/types'
import { useBookStore } from './book-store'

/** Workspace context-menu entry that opens the Book editor prefilled from the workspace. */
export function SaveToBookMenuItem({
  worktree,
  disabled
}: {
  worktree: Worktree
  disabled: boolean
}): React.JSX.Element {
  const t = useTranslate()
  const openEditorForWorkspace = useBookStore((s) => s.openEditorForWorkspace)
  return (
    <DropdownMenuItem disabled={disabled} onSelect={() => openEditorForWorkspace(worktree)}>
      <BookMarked className="size-3.5" />
      {t('forkBook.saveToBook', 'Save to Book…')}
    </DropdownMenuItem>
  )
}
