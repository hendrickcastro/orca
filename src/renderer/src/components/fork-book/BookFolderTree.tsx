import { useMemo, useState } from 'react'
import { createNonSecureContextUuid } from '../../../../shared/identifiers/non-secure-context-uuid'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Inbox,
  Library,
  MoreHorizontal,
  Pencil,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/class-names'
import { useTranslate } from '@/i18n/use-translate'
import {
  addBookFolder,
  childFolders,
  deleteBookFolder,
  folderSubtreeIds,
  moveBookEntry,
  moveBookFolder,
  renameBookFolder
} from '../../../../shared/fork-book/book-catalog-operations'
import type { BookCatalog, BookFolder } from '../../../../shared/fork-book/book-catalog-types'
import { BOOK_ALL_ENTRIES, useBookStore, type BookFolderSelection } from './book-store'
import { isBookDrag, readBookDrag, startBookDrag } from './book-drag'

type FolderEditing = { mode: 'create'; parentId: string | null } | { mode: 'rename'; id: string }

function useDropToFolder(folderId: string | null): {
  over: boolean
  props: Pick<React.HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDragLeave' | 'onDrop'>
} {
  const commit = useBookStore((s) => s.commit)
  const [over, setOver] = useState(false)
  return {
    over,
    props: {
      onDragOver: (event) => {
        if (!isBookDrag(event)) {
          return
        }
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (event) => {
        setOver(false)
        const item = readBookDrag(event)
        if (!item) {
          return
        }
        event.preventDefault()
        commit((catalog) =>
          item.kind === 'entry'
            ? moveBookEntry(catalog, item.id, folderId, Date.now())
            : item.id === folderId
              ? catalog
              : moveBookFolder(catalog, item.id, folderId)
        )
      }
    }
  }
}

function FolderNameInput({
  initial,
  onDone
}: {
  initial: string
  onDone: (name: string | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  const [value, setValue] = useState(initial)
  return (
    <Input
      autoFocus
      value={value}
      className="h-7"
      placeholder={t('forkBook.folderNamePlaceholder', 'Folder name')}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onDone(value)
        } else if (event.key === 'Escape') {
          onDone(null)
        }
      }}
    />
  )
}

function rowClass(active: boolean, over: boolean): string {
  return cn(
    'group flex h-8 w-full items-center gap-1.5 rounded-md pr-1 text-left text-[13px] transition-colors',
    active ? 'bg-accent text-accent-foreground' : 'text-foreground/80 hover:bg-accent/60',
    over && 'ring-1 ring-ring'
  )
}

function FolderNode(props: {
  folder: BookFolder
  depth: number
  catalog: BookCatalog
  counts: Map<string, number>
  editing: FolderEditing | null
  setEditing: (editing: FolderEditing | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  const { folder, depth, catalog, counts, editing, setEditing } = props
  const selected = useBookStore((s) => s.selectedFolder)
  const setSelected = useBookStore((s) => s.setSelectedFolder)
  const commit = useBookStore((s) => s.commit)
  const [open, setOpen] = useState(true)
  const drop = useDropToFolder(folder.id)
  const children = childFolders(catalog, folder.id)
  const active = selected === folder.id
  const indent = { paddingLeft: 6 + depth * 14 }
  const creatingHere = editing?.mode === 'create' && editing.parentId === folder.id

  if (editing?.mode === 'rename' && editing.id === folder.id) {
    return (
      <div style={indent} className="py-0.5 pr-1">
        <FolderNameInput
          initial={folder.name}
          onDone={(name) => {
            setEditing(null)
            if (name !== null) {
              commit((current) => renameBookFolder(current, folder.id, name))
            }
          }}
        />
      </div>
    )
  }
  return (
    <div>
      <div
        role="treeitem"
        aria-selected={active}
        aria-expanded={children.length > 0 ? open : undefined}
        tabIndex={0}
        draggable
        onDragStart={(event) => startBookDrag(event, { kind: 'folder', id: folder.id })}
        onClick={() => setSelected(folder.id)}
        onKeyDown={(event) => event.key === 'Enter' && setSelected(folder.id)}
        style={indent}
        className={rowClass(active, drop.over)}
        {...drop.props}
      >
        <button
          type="button"
          aria-label={open ? t('forkBook.collapse', 'Collapse') : t('forkBook.expand', 'Expand')}
          className={cn('rounded p-0.5', children.length === 0 && 'invisible')}
          onClick={(event) => {
            event.stopPropagation()
            setOpen(!open)
          }}
        >
          <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        {active ? (
          <FolderOpen className="size-4 shrink-0" />
        ) : (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate">{folder.name}</span>
        <span className="text-2xs text-muted-foreground tabular-nums">
          {counts.get(folder.id) ?? 0}
        </span>
        <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t('forkBook.folderActions', 'Folder actions')}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setOpen(true)
                  setEditing({ mode: 'create', parentId: folder.id })
                }}
              >
                <FolderPlus className="size-3.5" />
                {t('forkBook.newSubfolder', 'New subfolder')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setEditing({ mode: 'rename', id: folder.id })}>
                <Pencil className="size-3.5" />
                {t('forkBook.renameFolder', 'Rename')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  if (selected === folder.id) {
                    setSelected(folder.parentId)
                  }
                  commit((current) => deleteBookFolder(current, folder.id))
                }}
              >
                <Trash2 className="size-3.5" />
                {t('forkBook.deleteFolder', 'Delete folder (keeps its entries)')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      {open ? (
        <div role="group">
          {children.map((child) => (
            <FolderNode key={child.id} {...props} folder={child} depth={depth + 1} />
          ))}
          {creatingHere ? (
            <NewFolderInput parentId={folder.id} depth={depth + 1} setEditing={setEditing} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function NewFolderInput(props: {
  parentId: string | null
  depth: number
  setEditing: (editing: FolderEditing | null) => void
}): React.JSX.Element {
  const commit = useBookStore((s) => s.commit)
  const setSelected = useBookStore((s) => s.setSelectedFolder)
  return (
    <div style={{ paddingLeft: 6 + props.depth * 14 }} className="py-0.5 pr-1">
      <FolderNameInput
        initial=""
        onDone={(name) => {
          props.setEditing(null)
          if (!name?.trim()) {
            return
          }
          const id = createNonSecureContextUuid()
          commit((catalog) =>
            addBookFolder(catalog, { id, name, parentId: props.parentId, createdAt: Date.now() })
          )
          setSelected(id)
        }}
      />
    </div>
  )
}

function TopLevelRow(props: {
  value: BookFolderSelection
  icon: React.ReactNode
  label: string
  count: number
}): React.JSX.Element {
  const selected = useBookStore((s) => s.selectedFolder)
  const setSelected = useBookStore((s) => s.setSelectedFolder)
  const drop = useDropToFolder(props.value === BOOK_ALL_ENTRIES ? null : props.value)
  const active = selected === props.value
  return (
    <button
      type="button"
      onClick={() => setSelected(props.value)}
      style={{ paddingLeft: 8 }}
      className={rowClass(active, drop.over)}
      {...(props.value === BOOK_ALL_ENTRIES ? {} : drop.props)}
    >
      {props.icon}
      <span className="min-w-0 flex-1 truncate">{props.label}</span>
      <span className="pr-1 text-2xs text-muted-foreground tabular-nums">{props.count}</span>
    </button>
  )
}

/** Folder navigation for Book: All, unfiled entries, then the nested folders. */
export function BookFolderTree({
  editing,
  setEditing
}: {
  editing: FolderEditing | null
  setEditing: (editing: FolderEditing | null) => void
}): React.JSX.Element {
  const t = useTranslate()
  const catalog = useBookStore((s) => s.catalog)
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const folder of catalog.folders) {
      const ids = folderSubtreeIds(catalog, folder.id)
      map.set(
        folder.id,
        catalog.entries.filter((entry) => entry.folderId && ids.has(entry.folderId)).length
      )
    }
    return map
  }, [catalog])
  const unfiled = catalog.entries.filter((entry) => entry.folderId === null).length
  return (
    <div role="tree" className="flex flex-col gap-0.5">
      <TopLevelRow
        value={BOOK_ALL_ENTRIES}
        icon={<Library className="size-4 shrink-0 text-muted-foreground" />}
        label={t('forkBook.allEntries', 'All entries')}
        count={catalog.entries.length}
      />
      <TopLevelRow
        value={null}
        icon={<Inbox className="size-4 shrink-0 text-muted-foreground" />}
        label={t('forkBook.unfiled', 'Unfiled')}
        count={unfiled}
      />
      <div className="my-1 h-px bg-border" />
      {childFolders(catalog, null).map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          depth={0}
          catalog={catalog}
          counts={counts}
          editing={editing}
          setEditing={setEditing}
        />
      ))}
      {editing?.mode === 'create' && editing.parentId === null ? (
        <NewFolderInput parentId={null} depth={0} setEditing={setEditing} />
      ) : null}
    </div>
  )
}

export type { FolderEditing }
