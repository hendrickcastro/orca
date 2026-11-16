import { childFolders } from '../../../../shared/fork-book/book-catalog-operations'
import type { BookCatalog } from '../../../../shared/fork-book/book-catalog-types'

export type BookFolderOption = { id: string; name: string; depth: number }

/** Depth-first folder list, for pickers that show nesting by indentation. */
export function flattenBookFolders(catalog: BookCatalog): BookFolderOption[] {
  const options: BookFolderOption[] = []
  const visit = (parentId: string | null, depth: number): void => {
    for (const folder of childFolders(catalog, parentId)) {
      options.push({ id: folder.id, name: folder.name, depth })
      visit(folder.id, depth + 1)
    }
  }
  visit(null, 0)
  return options
}

export const BOOK_ROOT_FOLDER_VALUE = '__root__'
