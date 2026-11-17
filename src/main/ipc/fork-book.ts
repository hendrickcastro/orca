import { BrowserWindow, ipcMain } from 'electron'
import { z } from 'zod'
import type { Store } from '../persistence/loading-store/store'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/execution/commit-message-agent-environment'
import { readBookCatalog, writeBookCatalog } from '../fork-book/book-catalog-store'
import {
  cancelBookEntryGeneration,
  generateBookEntryText
} from '../fork-book/book-entry-generation'
import type {
  BookCatalog,
  BookEntryGenerationResult
} from '../../shared/fork-book/book-catalog-types'
import {
  exportBookContext,
  materializeBookContextImport,
  pickBookContextImport
} from '../fork-book/book-context-transfer'

const ShortText = z.string().max(500)
const LongText = z.string().max(20_000)

const PathText = z.string().min(1).max(4096)

const LinkedTask = z.object({
  provider: ShortText,
  label: ShortText,
  title: ShortText.optional(),
  url: PathText.optional()
})

const ExportBookContextRequest = z.object({
  title: ShortText,
  description: LongText,
  linkedTask: LinkedTask.optional(),
  repo: z
    .object({
      repoId: ShortText.optional(),
      projectId: ShortText.optional(),
      remoteUrl: PathText.optional()
    })
    .optional(),
  repoName: ShortText.optional(),
  workspacePath: PathText,
  roots: z.array(PathText).max(20),
  conversation: z
    .object({
      agent: ShortText,
      sessionId: ShortText,
      filePath: PathText.optional(),
      title: ShortText.optional()
    })
    .optional(),
  language: z.string().max(35)
})

const MaterializeBookContextRequest = z.object({
  summaryPath: PathText,
  conversationPath: PathText.optional(),
  worktreePath: PathText,
  folderName: ShortText
})

const GenerateBookEntryRequest = z.object({
  includeGitLog: z.boolean(),
  language: z.string().max(35),
  context: z.object({
    workspaceName: ShortText,
    repoName: ShortText.optional(),
    branch: ShortText.optional(),
    path: z.string().max(4096).optional(),
    comment: LongText.optional(),
    linkedTask: z
      .object({
        provider: ShortText,
        label: ShortText,
        title: ShortText.optional(),
        url: z.string().max(4096).optional()
      })
      .optional(),
    agentTitles: z.array(ShortText).max(50),
    memberWorkspaces: z
      .array(
        z.object({ name: ShortText, repoName: ShortText.optional(), branch: ShortText.optional() })
      )
      .max(50)
  })
})

/** Book catalog persistence and AI drafting; the renderer owns the catalog edits. */
export function registerForkBookHandlers(
  store: Pick<Store, 'getSettings'>,
  commitMessageAgentEnv?: CommitMessageAgentEnvironmentResolvers
): void {
  ipcMain.handle('forkBook:load', (): Promise<BookCatalog> => readBookCatalog())
  ipcMain.handle('forkBook:save', (_event, catalog: unknown): Promise<BookCatalog> =>
    writeBookCatalog(catalog)
  )
  ipcMain.handle('forkBook:generate', (_event, args: unknown): Promise<BookEntryGenerationResult> =>
    generateBookEntryText(
      {
        getSettings: () => store.getSettings(),
        getAgentEnvironment: () => commitMessageAgentEnv
      },
      GenerateBookEntryRequest.parse(args)
    )
  )
  ipcMain.handle('forkBook:cancelGenerate', () => cancelBookEntryGeneration())
  ipcMain.handle('forkBook:exportContext', (event, args: unknown) =>
    exportBookContext(
      { getSettings: () => store.getSettings(), getAgentEnvironment: () => commitMessageAgentEnv },
      BrowserWindow.fromWebContents(event.sender),
      ExportBookContextRequest.parse(args)
    )
  )
  ipcMain.handle('forkBook:pickImport', (event) =>
    pickBookContextImport(BrowserWindow.fromWebContents(event.sender))
  )
  ipcMain.handle('forkBook:materializeImport', (_event, args: unknown) =>
    materializeBookContextImport(MaterializeBookContextRequest.parse(args))
  )
}
