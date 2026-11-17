import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslate } from '@/i18n/use-translate'
import { BOOK_ALL_ENTRIES, useBookStore } from './book-store'
import { BOOK_ROOT_FOLDER_VALUE, flattenBookFolders } from './book-folder-options'

/** Folder picker that replaces the folder tree when the page is too narrow to show both. */
export function BookFolderSelect({ className }: { className?: string }): React.JSX.Element {
  const t = useTranslate()
  const catalog = useBookStore((s) => s.catalog)
  const selected = useBookStore((s) => s.selectedFolder)
  const setSelected = useBookStore((s) => s.setSelectedFolder)
  const value = selected ?? BOOK_ROOT_FOLDER_VALUE
  return (
    <Select
      value={value}
      onValueChange={(next) => setSelected(next === BOOK_ROOT_FOLDER_VALUE ? null : next)}
    >
      <SelectTrigger size="sm" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={BOOK_ALL_ENTRIES}>{t('forkBook.allEntries', 'All entries')}</SelectItem>
        <SelectItem value={BOOK_ROOT_FOLDER_VALUE}>{t('forkBook.unfiled', 'Unfiled')}</SelectItem>
        {flattenBookFolders(catalog).map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span style={{ paddingLeft: option.depth * 12 }}>{option.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
