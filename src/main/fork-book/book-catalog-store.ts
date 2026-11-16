import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { writeFileAtomically } from '../filesystem/atomic-file-publication'
import {
  getOrcaProfileDirectory,
  getOrcaProfileIndexPath,
  getProfileUserDataPath
} from '../orca-profiles/profile-storage-paths'
import { readProfileIndex } from '../orca-profiles/profile-index-store'
import { normalizeBookCatalog } from '../../shared/fork-book/book-catalog-operations'
import { EMPTY_BOOK_CATALOG, type BookCatalog } from '../../shared/fork-book/book-catalog-types'

const BOOK_CATALOG_FILE_NAME = 'book-catalog.json'

/** One catalog per Orca profile, next to that profile's own state. */
export function bookCatalogPath(userDataPath = getProfileUserDataPath()): string {
  const activeProfileId = readProfileIndex(getOrcaProfileIndexPath(userDataPath))?.activeProfileId
  return activeProfileId
    ? join(getOrcaProfileDirectory(activeProfileId, userDataPath), BOOK_CATALOG_FILE_NAME)
    : join(userDataPath, BOOK_CATALOG_FILE_NAME)
}

export function readBookCatalog(path = bookCatalogPath()): BookCatalog {
  if (!existsSync(path)) {
    return EMPTY_BOOK_CATALOG
  }
  try {
    return normalizeBookCatalog(JSON.parse(readFileSync(path, 'utf-8')))
  } catch {
    // Why: a hand-edited or truncated file must not take the whole page down; the next save rewrites it.
    return EMPTY_BOOK_CATALOG
  }
}

export function writeBookCatalog(catalog: unknown, path = bookCatalogPath()): BookCatalog {
  const normalized = normalizeBookCatalog(catalog)
  mkdirSync(dirname(path), { recursive: true })
  writeFileAtomically(path, `${JSON.stringify(normalized, null, 2)}\n`)
  return normalized
}
