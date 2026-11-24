import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { writePluginFileAtomically } from '../plugins/installation/plugin-atomic-file-write'
import {
  getOrcaProfileDirectory,
  getOrcaProfileIndexPath,
  getProfileUserDataPath
} from '../orca-profiles/profile-storage-paths'
import { readProfileIndex } from '../orca-profiles/profile-index-store'
import { normalizeBookCatalog } from '../../shared/fork-book/book-catalog-normalization'
import { EMPTY_BOOK_CATALOG, type BookCatalog } from '../../shared/fork-book/book-catalog-types'

const BOOK_CATALOG_FILE_NAME = 'book-catalog.json'

/** One catalog per Orca profile, next to that profile's own state. */
export function bookCatalogPath(userDataPath = getProfileUserDataPath()): string {
  const activeProfileId = readProfileIndex(getOrcaProfileIndexPath(userDataPath))?.activeProfileId
  return activeProfileId
    ? join(getOrcaProfileDirectory(activeProfileId, userDataPath), BOOK_CATALOG_FILE_NAME)
    : join(userDataPath, BOOK_CATALOG_FILE_NAME)
}

export async function readBookCatalog(path = bookCatalogPath()): Promise<BookCatalog> {
  try {
    return normalizeBookCatalog(JSON.parse(await readFile(path, 'utf-8')))
  } catch {
    // Why: a missing, hand-edited or truncated file must not take the page down; the next save rewrites it.
    return EMPTY_BOOK_CATALOG
  }
}

// Saves run in order so a slow earlier write cannot land after a newer one.
let pendingWrite: Promise<unknown> = Promise.resolve()

export function writeBookCatalog(catalog: unknown, path = bookCatalogPath()): Promise<BookCatalog> {
  const normalized = normalizeBookCatalog(catalog)
  const write = pendingWrite
    .catch(() => undefined)
    .then(async () => {
      await mkdir(dirname(path), { recursive: true })
      await writePluginFileAtomically(path, `${JSON.stringify(normalized, null, 2)}\n`)
      return normalized
    })
  pendingWrite = write
  return write
}
