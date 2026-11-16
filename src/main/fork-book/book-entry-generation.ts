import os from 'node:os'
import { existsSync } from 'node:fs'
import { LOCAL_COMMIT_MESSAGE_HOST_KEY } from '../../shared/source-control/ai/generation/commit-message-host-key'
import { textGenerationFailureCodeFields } from '../../shared/text-generation/text-generation-failure-copy'
import { buildBookEntryPrompt, parseBookEntryAnswer } from '../../shared/fork-book/book-entry-text'
import type {
  BookEntryGenerationRequest,
  BookEntryGenerationResult
} from '../../shared/fork-book/book-catalog-types'
import { resolveCommitMessageSettings as resolveTextGenerationParams } from '../text-generation/commit-message-text-generation'
import {
  prepareLocalCommitMessageAgentEnv,
  type CommitMessageAgentEnvironmentResolvers
} from '../text-generation/execution/commit-message-agent-environment'
import { runGenerationRequest } from '../text-generation/agent-generation-request'
import { spawnSourceControlAgent } from '../text-generation/execution/source-control-agent-launch'
import { cancelLocalGeneration } from '../text-generation/execution/source-control-generation-lanes'
import { gitExecFileAsync } from '../git/command-runner/git-exec-file'

export type BookEntryGenerationHost = {
  getSettings: () => Parameters<typeof resolveTextGenerationParams>[0]
  getAgentEnvironment: () => CommitMessageAgentEnvironmentResolvers | undefined
}

// Why: the Book lane borrows the summary operation's tool-free, short-answer agent settings.
const BOOK_GENERATION_OPERATION = 'jira-issue-summary'
const GIT_LOG_TIMEOUT_MS = 5_000
const generationCwd = os.homedir()
let activeRequestId = 0

async function readRecentCommitSubjects(path: string | undefined): Promise<string[]> {
  // Remote and WSL-only paths are not readable here; the notes and task still carry the summary.
  if (!path || !existsSync(path)) {
    return []
  }
  try {
    const { stdout } = await gitExecFileAsync(['log', '--format=%s', '-n', '15'], {
      cwd: path,
      timeout: GIT_LOG_TIMEOUT_MS
    })
    return String(stdout)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export function cancelBookEntryGeneration(): void {
  activeRequestId += 1
  cancelLocalGeneration(BOOK_GENERATION_OPERATION, generationCwd)
}

export async function generateBookEntryText(
  host: BookEntryGenerationHost,
  request: BookEntryGenerationRequest
): Promise<BookEntryGenerationResult> {
  cancelBookEntryGeneration()
  const requestId = activeRequestId
  const canceled = (): BookEntryGenerationResult => ({
    success: false,
    error: 'Generation canceled.',
    canceled: true
  })
  const resolved = resolveTextGenerationParams(
    host.getSettings(),
    LOCAL_COMMIT_MESSAGE_HOST_KEY,
    'branchName',
    null
  )
  if (!resolved.ok) {
    return { success: false, error: resolved.error, ...textGenerationFailureCodeFields(resolved) }
  }
  const [localEnv, gitLog] = await Promise.all([
    prepareLocalCommitMessageAgentEnv(resolved.params.agentId, host.getAgentEnvironment()),
    request.includeGitLog ? readRecentCommitSubjects(request.context.path) : Promise.resolve([])
  ])
  if (requestId !== activeRequestId) {
    return canceled()
  }
  if (!localEnv.ok) {
    return { success: false, error: localEnv.error }
  }
  const result = await runGenerationRequest({
    params: resolved.params,
    prompt: buildBookEntryPrompt(request.context, gitLog, request.language),
    target: { kind: 'local', cwd: generationCwd, ...(localEnv.env ? { env: localEnv.env } : {}) },
    spawnAgent: spawnSourceControlAgent,
    operation: BOOK_GENERATION_OPERATION,
    shouldExecute: () => requestId === activeRequestId
  })
  if (requestId !== activeRequestId) {
    return canceled()
  }
  if (!result.success) {
    return { success: false, error: result.error, canceled: result.canceled }
  }
  const parsed = parseBookEntryAnswer(result.rawOutput)
  return parsed
    ? { success: true, ...parsed, agentLabel: result.agentLabel }
    : { success: false, error: 'The agent answer had no title and description.' }
}
