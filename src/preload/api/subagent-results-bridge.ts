import { ipcRenderer } from 'electron'
import type {
  SubagentResultDocumentArgs,
  SubagentResultDocumentResult,
  SubagentResultReadResult,
  SubagentResultSummariesArgs,
  SubagentResultSummariesResult,
  SubagentResultTarget
} from '../../shared/subagent-results-types'
import type { PreloadApi } from '../api-types'

export type SubagentResultsApi = {
  summaries: (args: SubagentResultSummariesArgs) => Promise<SubagentResultSummariesResult>
  read: (args: SubagentResultTarget) => Promise<SubagentResultReadResult>
  writeDocument: (args: SubagentResultDocumentArgs) => Promise<SubagentResultDocumentResult>
}

export const subagentResultsApi = {
  summaries: (args) => ipcRenderer.invoke('subagentResults:summaries', args),
  read: (args) => ipcRenderer.invoke('subagentResults:read', args),
  writeDocument: (args) => ipcRenderer.invoke('subagentResults:writeDocument', args)
} satisfies PreloadApi['subagentResults']
