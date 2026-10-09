import { app } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { getAiVaultWslHomeDirs } from '../ai-vault/cached-session-list'
import { readSubagentMeta } from '../ai-vault/session-scanner-claude-subagents'
import { claudeProjectsRootDirs } from '../ai-vault/session-scanner-roots'
import {
  isSubagentTranscriptFileName,
  SUBAGENT_DIR_NAME
} from '../ai-vault/session-scanner-subagent-transcripts'
import { wslGatedReadFile, wslGatedStat } from '../native-chat/wsl-transcript-fs-access'
import { isPathInsideOrEqual } from '../../shared/cross-platform-path'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import {
  SUBAGENT_RESULT_DOCUMENT_MAX_BYTES,
  SUBAGENT_RESULT_PREVIEW_MAX_LENGTH,
  SUBAGENT_RESULT_SUMMARIES_MAX_PATHS,
  type SubagentResultDocumentArgs,
  type SubagentResultDocumentResult,
  type SubagentResultReadResult,
  type SubagentResultSummariesArgs,
  type SubagentResultSummariesResult,
  type SubagentResultSummary,
  type SubagentResultTarget
} from '../../shared/subagent-results-types'
import {
  readSubagentTranscriptResult,
  type SubagentTranscriptResult
} from './subagent-transcript-result'

const TRANSCRIPT_MAX_BYTES = 64 * 1024 * 1024
const PARSED_CACHE_MAX_ENTRIES = 256
const DOCUMENTS_DIR_NAME = 'subagent-results'
const DOCUMENTS_KEPT = 200

type ParsedTranscript = { mtimeMs: number; size: number; parsed: SubagentTranscriptResult }
const parsedByPath = new Map<string, ParsedTranscript>()

/** Only a local Claude subagent transcript under a known projects root may be read; the path
 *  comes from the renderer, so anything else resolves to null. */
export async function resolveSubagentTranscriptPath(
  target: SubagentResultTarget | undefined
): Promise<string | null> {
  if (!target || typeof target.filePath !== 'string' || !target.filePath.trim()) {
    return null
  }
  if ((target.executionHostId ?? LOCAL_EXECUTION_HOST_ID) !== LOCAL_EXECUTION_HOST_ID) {
    return null
  }
  // resolve() collapses `..` before the textual containment check.
  const filePath = resolve(target.filePath)
  if (
    !isSubagentTranscriptFileName(basename(filePath), true) ||
    basename(dirname(filePath)) !== SUBAGENT_DIR_NAME
  ) {
    return null
  }
  const roots = claudeProjectsRootDirs({ wslHomeDirs: await getAiVaultWslHomeDirs() })
  return roots.some((root) => isPathInsideOrEqual(resolve(root), filePath)) ? filePath : null
}

async function readParsedTranscript(filePath: string): Promise<SubagentTranscriptResult> {
  const fileStat = await wslGatedStat(filePath, 'exact')
  const cached = parsedByPath.get(filePath)
  if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
    return cached.parsed
  }
  if (fileStat.size > TRANSCRIPT_MAX_BYTES) {
    throw new Error('Subagent transcript is too large to read')
  }
  const parsed = readSubagentTranscriptResult(await wslGatedReadFile(filePath, 'utf-8', 'exact'))
  parsedByPath.delete(filePath)
  parsedByPath.set(filePath, { mtimeMs: fileStat.mtimeMs, size: fileStat.size, parsed })
  if (parsedByPath.size > PARSED_CACHE_MAX_ENTRIES) {
    const oldest = parsedByPath.keys().next().value
    if (oldest !== undefined) {
      parsedByPath.delete(oldest)
    }
  }
  return parsed
}

function previewOf(result: string | null): string | undefined {
  const flat = result?.replace(/\s+/g, ' ').trim()
  if (!flat) {
    return undefined
  }
  return flat.length > SUBAGENT_RESULT_PREVIEW_MAX_LENGTH
    ? `${flat.slice(0, SUBAGENT_RESULT_PREVIEW_MAX_LENGTH - 1)}…`
    : flat
}

export async function summarizeSubagentResults(
  args: SubagentResultSummariesArgs | undefined
): Promise<SubagentResultSummariesResult> {
  if (!args || !Array.isArray(args.filePaths)) {
    return { summaries: [] }
  }
  const filePaths = args.filePaths.slice(0, SUBAGENT_RESULT_SUMMARIES_MAX_PATHS)
  const summaries = await Promise.all(
    filePaths.map(async (requested): Promise<SubagentResultSummary | null> => {
      if (typeof requested !== 'string') {
        return null
      }
      const filePath = await resolveSubagentTranscriptPath({
        filePath: requested,
        executionHostId: args.executionHostId
      })
      if (!filePath) {
        return null
      }
      try {
        const parsed = await readParsedTranscript(filePath)
        const preview = previewOf(parsed.result)
        return {
          // Echo the caller's spelling so it can key rows by the path it sent.
          filePath: requested,
          finished: parsed.finished,
          ...(parsed.failed ? { failed: true } : {}),
          ...(preview ? { preview } : {}),
          ...(parsed.finishedAt ? { finishedAt: parsed.finishedAt } : {})
        }
      } catch {
        return null
      }
    })
  )
  return { summaries: summaries.filter((summary) => summary !== null) }
}

export async function readSubagentResult(
  target: SubagentResultTarget | undefined
): Promise<SubagentResultReadResult> {
  const filePath = await resolveSubagentTranscriptPath(target)
  if (!filePath) {
    return { ok: false, reason: 'unavailable' }
  }
  try {
    const [parsed, meta] = await Promise.all([
      readParsedTranscript(filePath),
      readSubagentMeta(filePath)
    ])
    return { ok: true, detail: { ...parsed, ...meta } }
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
}

function documentFileName(filePath: string, description: string | null): string {
  const slug = (description ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  const hash = createHash('sha256').update(filePath).digest('hex').slice(0, 10)
  return `${slug || 'subagent'}-${hash}.md`
}

async function pruneDocuments(dir: string): Promise<void> {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.md'))
  if (names.length <= DOCUMENTS_KEPT) {
    return
  }
  const dated = await Promise.all(
    names.map(async (name) => ({ name, mtimeMs: (await stat(join(dir, name))).mtimeMs }))
  )
  dated.sort((a, b) => b.mtimeMs - a.mtimeMs)
  await Promise.all(dated.slice(DOCUMENTS_KEPT).map(({ name }) => unlink(join(dir, name))))
}

/** Writes the rendered result into Orca's own data folder so the editor can open it as a
 *  read-only Markdown preview; transcripts themselves are never written. */
export async function writeSubagentResultDocument(
  args: SubagentResultDocumentArgs | undefined
): Promise<SubagentResultDocumentResult> {
  const filePath = await resolveSubagentTranscriptPath(args)
  if (!filePath || typeof args?.markdown !== 'string') {
    return { ok: false, reason: 'unavailable' }
  }
  if (Buffer.byteLength(args.markdown, 'utf8') > SUBAGENT_RESULT_DOCUMENT_MAX_BYTES) {
    return { ok: false, reason: 'too-large' }
  }
  try {
    const dir = join(app.getPath('userData'), DOCUMENTS_DIR_NAME)
    await mkdir(dir, { recursive: true })
    const meta = await readSubagentMeta(filePath)
    const documentPath = join(dir, documentFileName(filePath, meta.description))
    await writeFile(documentPath, args.markdown, 'utf8')
    // Why: best effort; a stale document is harmless and must not fail the open.
    await pruneDocuments(dir).catch(() => undefined)
    return { ok: true, path: documentPath }
  } catch {
    return { ok: false, reason: 'write-failed' }
  }
}
