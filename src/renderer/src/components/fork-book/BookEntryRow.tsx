import {
  ExternalLink,
  FolderInput,
  Inbox,
  MoreHorizontal,
  Pencil,
  SquareArrowOutUpRight,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { getIntlLocale, translate } from '@/i18n/i18n'
import {
  folderPath,
  moveBookEntry,
  removeBookEntry
} from '../../../../shared/fork-book/book-catalog-operations'
import type { BookEntry } from '../../../../shared/fork-book/book-catalog-types'
import { useBookStore } from './book-store'
import { flattenBookFolders } from './book-folder-options'
import { openBookEntry } from './book-entry-open'
import { startBookDrag } from './book-drag'

/** One saved piece of work: what it was, where it lives, and the way back to its agent. */
export function BookEntryRow({
  entry,
  live,
  showFolder
}: {
  entry: BookEntry
  live: boolean
  showFolder: boolean
}): React.JSX.Element {
  const catalog = useBookStore((s) => s.catalog)
  const commit = useBookStore((s) => s.commit)
  const openEditorForEntry = useBookStore((s) => s.openEditorForEntry)
  const folderLabel = showFolder
    ? folderPath(catalog, entry.folderId)
        .map((folder) => folder.name)
        .join(' / ')
    : ''
  const meta = [
    entry.repoName,
    entry.branch,
    entry.linkedTask?.label,
    new Date(entry.updatedAt).toLocaleDateString(getIntlLocale())
  ].filter(Boolean)

  return (
    <article
      draggable
      onDragStart={(event) => startBookDrag(event, { kind: 'entry', id: entry.id })}
      className="group @container rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/40"
    >
      <div className="flex gap-3 @min-[400px]:items-start @max-[400px]:flex-col">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{entry.title}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {folderLabel ? `${folderLabel} — ` : ''}
            {meta.join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={!live}
            title={
              live
                ? undefined
                : translate('forkBook.workspaceGone', 'This workspace no longer exists.')
            }
            onClick={() => openBookEntry(entry)}
          >
            <SquareArrowOutUpRight className="size-4" />
            {translate('forkBook.openAgent', 'Open agent')}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={translate('forkBook.editEntry', 'Edit')}
            onClick={() => openEditorForEntry(entry)}
          >
            <Pencil className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={translate('forkBook.entryActions', 'More actions')}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput className="size-3.5" />
                  {translate('forkBook.moveTo', 'Move to')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onSelect={() =>
                      commit((current) => moveBookEntry(current, entry.id, null, Date.now()))
                    }
                  >
                    <Inbox className="size-3.5" />
                    {translate('forkBook.rootFolder', 'No folder')}
                  </DropdownMenuItem>
                  {flattenBookFolders(catalog).map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      disabled={option.id === entry.folderId}
                      onSelect={() =>
                        commit((current) => moveBookEntry(current, entry.id, option.id, Date.now()))
                      }
                    >
                      <span style={{ paddingLeft: option.depth * 12 }}>{option.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {entry.linkedTask?.url ? (
                <DropdownMenuItem
                  onSelect={() => {
                    if (entry.linkedTask?.url) {
                      void window.api.shell.openUrl(entry.linkedTask.url)
                    }
                  }}
                >
                  <ExternalLink className="size-3.5" />
                  {translate('forkBook.openTask', 'Open task')}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => commit((current) => removeBookEntry(current, entry.id))}
              >
                <Trash2 className="size-3.5" />
                {translate('forkBook.removeEntry', 'Remove from Book')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {entry.description ? (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-[13px] leading-relaxed text-foreground/80">
          {entry.description}
        </p>
      ) : null}
    </article>
  )
}
