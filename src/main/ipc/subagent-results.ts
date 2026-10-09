import { ipcMain } from 'electron'
import {
  readSubagentResult,
  summarizeSubagentResults,
  writeSubagentResultDocument
} from '../subagent-results/subagent-result-service'
import type {
  SubagentResultDocumentArgs,
  SubagentResultDocumentResult,
  SubagentResultReadResult,
  SubagentResultSummariesArgs,
  SubagentResultSummariesResult,
  SubagentResultTarget
} from '../../shared/subagent-results-types'

export function registerSubagentResultHandlers(): void {
  ipcMain.handle(
    'subagentResults:summaries',
    (_event, args?: SubagentResultSummariesArgs): Promise<SubagentResultSummariesResult> =>
      summarizeSubagentResults(args)
  )
  ipcMain.handle(
    'subagentResults:read',
    (_event, args?: SubagentResultTarget): Promise<SubagentResultReadResult> =>
      readSubagentResult(args)
  )
  ipcMain.handle(
    'subagentResults:writeDocument',
    (_event, args?: SubagentResultDocumentArgs): Promise<SubagentResultDocumentResult> =>
      writeSubagentResultDocument(args)
  )
}
