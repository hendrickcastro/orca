import { useEffect, useMemo, useState } from 'react'
import { BookMarked, FileUp, FolderPlus, LoaderCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store/index'
import {
  bookEntryMatchesQuery,
  folderPath,
  folderSubtreeIds
} from '../../../../shared/fork-book/book-catalog-operations'
import { BOOK_ALL_ENTRIES, useBookStore } from './book-store'
import { BookFolderTree, type FolderEditing } from './BookFolderTree'
import { BookEntryRow } from './BookEntryRow'
import { BookFolderSelect } from './BookFolderSelect'
import { importBookContext } from './book-context-actions'
import { findBookWorktree } from './book-entry-snapshot'

function useLiveWorkspaceIds(workspaceIds: string[]): Set<string> {
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  return useMemo(
    () =>
      new Set(
        workspaceIds.filter(
          (id) => findBookWorktree({ worktreesByRepo, folderWorkspaces }, id) !== null
        )
      ),
    [workspaceIds, worktreesByRepo, folderWorkspaces]
  )
}

/** Book: a catalogue of finished agent work, organised in nested folders and searchable. */
export default function BookPage(): React.JSX.Element {
  const catalog = useBookStore((s) => s.catalog)
  const loadState = useBookStore((s) => s.loadState)
  const ensureLoaded = useBookStore((s) => s.ensureLoaded)
  const selectedFolder = useBookStore((s) => s.selectedFolder)
  const query = useBookStore((s) => s.query)
  const setQuery = useBookStore((s) => s.setQuery)
  const [editing, setEditing] = useState<FolderEditing | null>(null)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  const searching = query.trim().length > 0
  const visibleEntries = useMemo(() => {
    const inFolder =
      searching || selectedFolder === BOOK_ALL_ENTRIES
        ? catalog.entries
        : selectedFolder === null
          ? catalog.entries.filter((entry) => entry.folderId === null)
          : (() => {
              const ids = folderSubtreeIds(catalog, selectedFolder)
              return catalog.entries.filter((entry) => entry.folderId && ids.has(entry.folderId))
            })()
    return inFolder
      .filter((entry) => bookEntryMatchesQuery(entry, query))
      .sort((left, right) => right.updatedAt - left.updatedAt)
  }, [catalog, query, searching, selectedFolder])
  const workspaceIds = useMemo(
    () => visibleEntries.map((entry) => entry.workspaceId),
    [visibleEntries]
  )
  const liveIds = useLiveWorkspaceIds(workspaceIds)

  const heading = searching
    ? translate('forkBook.searchResults', 'Search results')
    : selectedFolder === BOOK_ALL_ENTRIES
      ? translate('forkBook.allEntries', 'All entries')
      : selectedFolder === null
        ? translate('forkBook.unfiled', 'Unfiled')
        : folderPath(catalog, selectedFolder)
            .map((folder) => folder.name)
            .join(' / ')

  return (
    <div className="@container/book flex h-full min-h-0 flex-1 flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <BookMarked className="size-5 text-muted-foreground" />
        <h1 className="text-base font-semibold">{translate('forkBook.pageTitle', 'Book')}</h1>
        <div className="ml-2 flex max-w-md min-w-0 flex-1 items-center gap-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={translate(
              'forkBook.searchPlaceholder',
              'Search titles, descriptions, branches, tasks…'
            )}
            aria-label={translate(
              'forkBook.searchPlaceholder',
              'Search titles, descriptions, branches, tasks…'
            )}
            className="h-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          aria-label={translate('forkBook.importContext', 'Import context')}
          onClick={() => void importBookContext()}
        >
          <FileUp className="size-4" />
          <span className="@max-[760px]/book:hidden">
            {translate('forkBook.importContext', 'Import context')}
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label={translate('forkBook.newFolder', 'New folder')}
          onClick={() => {
            const parentId =
              selectedFolder === BOOK_ALL_ENTRIES || selectedFolder === null ? null : selectedFolder
            setEditing({ mode: 'create', parentId })
          }}
        >
          <FolderPlus className="size-4" />
          <span className="@max-[760px]/book:hidden">
            {translate('forkBook.newFolder', 'New folder')}
          </span>
        </Button>
      </header>
      <div className="@container flex min-h-0 flex-1">
        <nav className="scrollbar-sleek w-64 shrink-0 overflow-y-auto border-r border-border p-2 @max-[640px]:hidden">
          <BookFolderTree editing={editing} setEditing={setEditing} />
        </nav>
        <main className="scrollbar-sleek min-w-0 flex-1 overflow-y-auto px-4 py-4 @[640px]:px-6">
          <div className="mb-3 @[640px]:hidden">
            <BookFolderSelect className="w-full" />
          </div>
          {editing ? (
            // Why: narrow pages hide the tree, so the new-folder name field shows above the list.
            <div className="mb-3 @[640px]:hidden">
              <BookFolderTree editing={editing} setEditing={setEditing} />
            </div>
          ) : null}
          <h2 className="mb-3 text-2xs font-semibold tracking-wider text-muted-foreground uppercase @max-[640px]:hidden">
            {heading}
          </h2>
          {loadState === 'loading' || loadState === 'idle' ? (
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          ) : loadState === 'error' ? (
            <p className="text-sm text-destructive">
              {translate('forkBook.loadFailed', 'Book could not be loaded.')}
            </p>
          ) : visibleEntries.length === 0 ? (
            <p className="max-w-md text-sm text-muted-foreground">
              {searching
                ? translate('forkBook.noMatches', 'No entries match this search.')
                : translate(
                    'forkBook.emptyHint',
                    'Nothing here yet. Right-click a workspace in the sidebar and choose “Save to Book”, or drag entries onto a folder.'
                  )}
            </p>
          ) : (
            <div className="flex max-w-4xl flex-col gap-2">
              {visibleEntries.map((entry) => (
                <BookEntryRow
                  key={entry.id}
                  entry={entry}
                  live={liveIds.has(entry.workspaceId)}
                  showFolder={searching || selectedFolder === BOOK_ALL_ENTRIES}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
