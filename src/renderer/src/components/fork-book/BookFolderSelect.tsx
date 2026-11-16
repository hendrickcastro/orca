import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { BOOK_ALL_ENTRIES, useBookStore } from './book-store'
import { BOOK_ROOT_FOLDER_VALUE, flattenBookFolders } from './book-folder-options'

/** Folder picker that replaces the folder tree when the page is too narrow to show both. */
export function BookFolderSelect({ className }: { className?: string }): React.JSX.Element {
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
        <SelectItem value={BOOK_ALL_ENTRIES}>
          {translate('forkBook.allEntries', 'All entries')}
        </SelectItem>
        <SelectItem value={BOOK_ROOT_FOLDER_VALUE}>
          {translate('forkBook.unfiled', 'Unfiled')}
        </SelectItem>
        {flattenBookFolders(catalog).map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span style={{ paddingLeft: option.depth * 12 }}>{option.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
