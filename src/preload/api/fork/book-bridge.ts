import { ipcRenderer } from 'electron'
import type {
  BookCatalog,
  BookEntryGenerationRequest,
  BookEntryGenerationResult
} from '../../../shared/fork-book/book-catalog-types'
import type {
  BookContextExportRequest,
  BookContextExportResult,
  BookContextImportPick,
  BookContextMaterializeRequest,
  BookContextMaterializeResult
} from '../../../shared/fork-book/book-context-transfer'

export type ForkBookApi = {
  load: () => Promise<BookCatalog>
  save: (catalog: BookCatalog) => Promise<BookCatalog>
  generate: (request: BookEntryGenerationRequest) => Promise<BookEntryGenerationResult>
  cancelGenerate: () => Promise<void>
  exportContext: (request: BookContextExportRequest) => Promise<BookContextExportResult>
  pickImport: () => Promise<BookContextImportPick>
  materializeImport: (
    request: BookContextMaterializeRequest
  ) => Promise<BookContextMaterializeResult>
}

export const forkBookApi: ForkBookApi = {
  load: () => ipcRenderer.invoke('forkBook:load'),
  save: (catalog) => ipcRenderer.invoke('forkBook:save', catalog),
  generate: (request) => ipcRenderer.invoke('forkBook:generate', request),
  cancelGenerate: () => ipcRenderer.invoke('forkBook:cancelGenerate'),
  exportContext: (request) => ipcRenderer.invoke('forkBook:exportContext', request),
  pickImport: () => ipcRenderer.invoke('forkBook:pickImport'),
  materializeImport: (request) => ipcRenderer.invoke('forkBook:materializeImport', request)
}
