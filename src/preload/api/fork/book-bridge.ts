import { ipcRenderer } from 'electron'
import type {
  BookCatalog,
  BookEntryGenerationRequest,
  BookEntryGenerationResult
} from '../../../shared/fork-book/book-catalog-types'

export type ForkBookApi = {
  load: () => Promise<BookCatalog>
  save: (catalog: BookCatalog) => Promise<BookCatalog>
  generate: (request: BookEntryGenerationRequest) => Promise<BookEntryGenerationResult>
  cancelGenerate: () => Promise<void>
}

export const forkBookApi: ForkBookApi = {
  load: () => ipcRenderer.invoke('forkBook:load'),
  save: (catalog) => ipcRenderer.invoke('forkBook:save', catalog),
  generate: (request) => ipcRenderer.invoke('forkBook:generate', request),
  cancelGenerate: () => ipcRenderer.invoke('forkBook:cancelGenerate')
}
