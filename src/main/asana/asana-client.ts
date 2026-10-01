import { net } from 'electron'
import type {
  AsanaConnectionStatus,
  AsanaConnectResult,
  AsanaCreateTaskArgs,
  AsanaCreateTaskResult,
  AsanaProject,
  AsanaTask,
  AsanaTaskListArgs,
  AsanaTaskListResult,
  AsanaWorkspace
} from '../../shared/asana-types'
import { clearAsanaToken, hasAsanaToken, readAsanaToken, saveAsanaToken } from './asana-token-store'

const ASANA_API_BASE = 'https://app.asana.com/api/1.0'
const REQUEST_TIMEOUT_MS = 15_000
const TASK_PAGE_SIZE = 100
const TASK_MAX_PAGES = 3
// Why: incomplete tasks always come back; completed ones only within this window, so the list
// can flag recently finished work without paging through a workspace's whole history.
const COMPLETED_TASK_WINDOW_DAYS = 90
const TASK_FIELDS =
  'name,completed,completed_at,created_at,assignee.name,due_on,modified_at,permalink_url,projects.name'

type RawTask = {
  gid?: string
  name?: string | null
  completed?: boolean | null
  completed_at?: string | null
  created_at?: string | null
  assignee?: { name?: string | null } | null
  due_on?: string | null
  modified_at?: string | null
  permalink_url?: string | null
  projects?: { name?: string | null }[] | null
}

export class AsanaRequestError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.status = status
  }
}

type AsanaRequestOptions = { searchParams?: Record<string, string | number>; body?: unknown }

async function asanaRequestPage<T>(
  token: string,
  path: string,
  options: AsanaRequestOptions = {}
): Promise<{ data: T; nextOffset: string | null }> {
  const url = new URL(`${ASANA_API_BASE}${path}`)
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    url.searchParams.set(key, String(value))
  }
  const hasBody = options.body !== undefined
  const response = await net.fetch(url.toString(), {
    method: hasBody ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(hasBody ? { 'Content-Type': 'application/json' } : {})
    },
    ...(hasBody ? { body: JSON.stringify({ data: options.body }) } : {}),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  const payload: unknown = await response.json().catch(() => null)
  const envelope = payload && typeof payload === 'object' ? payload : null
  const data = envelope && 'data' in envelope ? envelope.data : undefined
  if (!response.ok || data === undefined) {
    const errors = envelope && 'errors' in envelope ? envelope.errors : null
    const first: unknown = Array.isArray(errors) ? errors[0] : null
    const detail =
      first && typeof first === 'object' && 'message' in first && typeof first.message === 'string'
        ? first.message
        : null
    throw new AsanaRequestError(
      response.status === 401
        ? 'Asana rejected the personal access token. Reconnect Asana with a valid token.'
        : `Asana request failed${detail ? `: ${detail}` : ` (HTTP ${response.status})`}`,
      response.status
    )
  }
  const nextPage = envelope && 'next_page' in envelope ? envelope.next_page : null
  const nextOffset =
    nextPage &&
    typeof nextPage === 'object' &&
    'offset' in nextPage &&
    typeof nextPage.offset === 'string'
      ? nextPage.offset
      : null
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Asana wraps every success body in `data`; callers name the documented shape and map fields defensively.
  return { data: data as T, nextOffset }
}

export async function asanaRequest<T>(
  token: string,
  path: string,
  options: AsanaRequestOptions = {}
): Promise<T> {
  return (await asanaRequestPage<T>(token, path, options)).data
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function mapAsanaTask(raw: RawTask): AsanaTask | null {
  if (!raw.gid || !raw.name) {
    return null
  }
  return {
    gid: raw.gid,
    name: raw.name,
    completed: raw.completed === true,
    completedAt: raw.completed_at ?? null,
    createdAt: raw.created_at ?? null,
    assignee: raw.assignee?.name ?? null,
    dueOn: raw.due_on ?? null,
    modifiedAt: raw.modified_at ?? null,
    projects: (raw.projects ?? []).map((project) => project.name ?? '').filter(Boolean),
    url: raw.permalink_url ?? `https://app.asana.com/0/0/${raw.gid}`
  }
}

async function loadStatus(token: string): Promise<AsanaConnectionStatus> {
  const me = await asanaRequest<{ name?: string | null; workspaces?: AsanaWorkspace[] | null }>(
    token,
    '/users/me',
    { searchParams: { opt_fields: 'name,workspaces.name' } }
  )
  return {
    connected: true,
    userName: me.name ?? null,
    workspaces: (me.workspaces ?? []).filter((workspace) => workspace.gid && workspace.name),
    error: null
  }
}

const disconnected: AsanaConnectionStatus = {
  connected: false,
  userName: null,
  workspaces: [],
  error: null
}

export async function getAsanaStatus(): Promise<AsanaConnectionStatus> {
  if (!hasAsanaToken()) {
    return disconnected
  }
  const token = readAsanaToken()
  if (!token) {
    return { ...disconnected, error: 'The saved Asana token could not be decrypted.' }
  }
  try {
    return await loadStatus(token)
  } catch (error) {
    return { ...disconnected, error: errorMessage(error) }
  }
}

export async function connectAsana(token: string): Promise<AsanaConnectResult> {
  const trimmed = token.trim()
  if (!trimmed) {
    return { ok: false, error: 'Enter an Asana personal access token.' }
  }
  try {
    // Why: verify before saving so a typo never replaces a working token.
    const status = await loadStatus(trimmed)
    saveAsanaToken(trimmed)
    return { ok: true, status }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

export function disconnectAsana(): void {
  clearAsanaToken()
}

export function requireAsanaToken(): string {
  const token = readAsanaToken()
  if (!token) {
    throw new AsanaRequestError('Asana is not connected.', null)
  }
  return token
}

export async function listAsanaProjects(workspaceGid: string): Promise<AsanaProject[]> {
  const projects = await asanaRequest<AsanaProject[]>(requireAsanaToken(), '/projects', {
    searchParams: { workspace: workspaceGid, archived: 'false', opt_fields: 'name', limit: 100 }
  })
  return projects.filter((project) => project.gid && project.name)
}

export async function listAsanaTasks(args: AsanaTaskListArgs): Promise<AsanaTaskListResult> {
  try {
    const token = requireAsanaToken()
    const completedSince = new Date(Date.now() - COMPLETED_TASK_WINDOW_DAYS * 86_400_000)
    const searchParams: Record<string, string | number> = {
      completed_since: completedSince.toISOString(),
      opt_fields: TASK_FIELDS,
      limit: TASK_PAGE_SIZE
    }
    if (args.scope === 'project' && args.projectGid) {
      searchParams.project = args.projectGid
    } else {
      searchParams.assignee = 'me'
      searchParams.workspace = args.workspaceGid
    }
    const raw: RawTask[] = []
    for (let page = 0; page < TASK_MAX_PAGES; page += 1) {
      const result = await asanaRequestPage<RawTask[]>(token, '/tasks', { searchParams })
      raw.push(...result.data)
      if (!result.nextOffset) {
        break
      }
      searchParams.offset = result.nextOffset
    }
    const tasks = raw.map(mapAsanaTask).filter((task): task is AsanaTask => task !== null)
    // Why: Asana's /tasks order is not creation order; newest-created first is what users scan for.
    tasks.sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''))
    return { tasks }
  } catch (error) {
    return { tasks: [], error: errorMessage(error) }
  }
}

export async function createAsanaTask(args: AsanaCreateTaskArgs): Promise<AsanaCreateTaskResult> {
  const name = args.name.trim()
  if (!name) {
    return { ok: false, error: 'A task name is required.' }
  }
  try {
    const raw = await asanaRequest<RawTask>(requireAsanaToken(), '/tasks', {
      searchParams: { opt_fields: TASK_FIELDS },
      body: {
        name,
        ...(args.notes?.trim() ? { notes: args.notes.trim() } : {}),
        // Why: Asana takes either a workspace or projects; a project already implies its workspace.
        ...(args.projectGid ? { projects: [args.projectGid] } : { workspace: args.workspaceGid }),
        ...(args.assignToMe ? { assignee: 'me' } : {}),
        ...(args.dueOn ? { due_on: args.dueOn } : {})
      }
    })
    const task = mapAsanaTask(raw)
    return task ? { ok: true, task } : { ok: false, error: 'Asana returned an unexpected task.' }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}
