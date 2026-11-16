const ENTRY_MIME = 'application/x-orca-book-entry'
const FOLDER_MIME = 'application/x-orca-book-folder'

export type BookDragItem = { kind: 'entry' | 'folder'; id: string }

export function startBookDrag(event: React.DragEvent, item: BookDragItem): void {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(item.kind === 'entry' ? ENTRY_MIME : FOLDER_MIME, item.id)
}

/** Only Book's own drags may land on a folder; files and tabs dragged in from elsewhere are ignored. */
export function isBookDrag(event: React.DragEvent): boolean {
  const types = event.dataTransfer.types
  return types.includes(ENTRY_MIME) || types.includes(FOLDER_MIME)
}

export function readBookDrag(event: React.DragEvent): BookDragItem | null {
  const entryId = event.dataTransfer.getData(ENTRY_MIME)
  if (entryId) {
    return { kind: 'entry', id: entryId }
  }
  const folderId = event.dataTransfer.getData(FOLDER_MIME)
  return folderId ? { kind: 'folder', id: folderId } : null
}
