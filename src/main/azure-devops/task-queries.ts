import type {
  AzureDevOpsPullRequestFilter,
  AzureDevOpsTaskItem,
  AzureDevOpsTaskListResult,
  AzureDevOpsWorkItemFilter
} from '../../shared/azure-devops-tasks'
import { requestAzureDevOpsJson, requestAzureDevOpsJsonAtBase } from './azure-devops-api-request'
import { parseAzureDevOpsRepoRef, type AzureDevOpsRepoRef } from './repository-ref'

const TASK_LIST_LIMIT = 50
const TASK_REQUEST_TIMEOUT_MS = 15_000
// Why: WIQL has no portable "open" state category across process templates; these are the
// terminal states of the Agile, Scrum, CMMI and Basic templates.
const CLOSED_WORK_ITEM_STATES = ['Closed', 'Done', 'Removed', 'Resolved', 'Completed', 'Cut']
const WORK_ITEM_FIELDS = [
  'System.Id',
  'System.Title',
  'System.WorkItemType',
  'System.State',
  'System.AssignedTo',
  'System.ChangedDate'
]

type RawIdentity = { displayName?: string | null; uniqueName?: string | null } | null

type RawWorkItem = {
  id?: number
  fields?: Record<string, unknown>
}

type RawPullRequest = {
  pullRequestId?: number
  title?: string | null
  status?: string | null
  isDraft?: boolean | null
  createdBy?: RawIdentity
  creationDate?: string | null
  sourceRefName?: string | null
}

function wiqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function buildAzureDevOpsWorkItemWiql(
  project: string,
  filter: AzureDevOpsWorkItemFilter
): string {
  const clauses = [
    `[System.TeamProject] = ${wiqlString(project)}`,
    `[System.State] NOT IN (${CLOSED_WORK_ITEM_STATES.map(wiqlString).join(', ')})`
  ]
  if (filter === 'assigned-to-me') {
    clauses.push('[System.AssignedTo] = @Me')
  }
  return `SELECT [System.Id] FROM WorkItems WHERE ${clauses.join(' AND ')} ORDER BY [System.ChangedDate] DESC`
}

/** Organization/collection base: the project-level API base without its project segment. */
function organizationBaseUrl(repo: AzureDevOpsRepoRef): string {
  return repo.apiBaseUrl.replace(/\/+$/, '').replace(/\/[^/]+$/, '')
}

/** `…/_git/<repo>` → project web URL, where work-item links live. */
function projectWebUrl(repo: AzureDevOpsRepoRef): string {
  return repo.webBaseUrl.replace(/\/_git\/[^/]+\/?$/, '')
}

function projectKey(repo: AzureDevOpsRepoRef): string {
  return `${organizationBaseUrl(repo).toLowerCase()}|${repo.project.toLowerCase()}`
}

function identityName(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const displayName = 'displayName' in value ? value.displayName : null
  const uniqueName = 'uniqueName' in value ? value.uniqueName : null
  return typeof displayName === 'string' && displayName
    ? displayName
    : typeof uniqueName === 'string' && uniqueName
      ? uniqueName
      : null
}

function stringField(fields: Record<string, unknown>, name: string): string | null {
  const value = fields[name]
  return typeof value === 'string' && value ? value : null
}

export function mapAzureDevOpsWorkItem(
  raw: RawWorkItem,
  repo: AzureDevOpsRepoRef,
  repoId: string
): AzureDevOpsTaskItem | null {
  const fields = raw.fields ?? {}
  const id = typeof raw.id === 'number' ? raw.id : null
  const title = stringField(fields, 'System.Title')
  if (id === null || !title) {
    return null
  }
  return {
    kind: 'work-item',
    id,
    title,
    typeLabel: stringField(fields, 'System.WorkItemType') ?? 'Work item',
    state: stringField(fields, 'System.State') ?? '',
    person: identityName(fields['System.AssignedTo']),
    updatedAt: stringField(fields, 'System.ChangedDate'),
    url: `${projectWebUrl(repo)}/_workitems/edit/${id}`,
    projectKey: projectKey(repo),
    repoId
  }
}

export function mapAzureDevOpsTaskPullRequest(
  raw: RawPullRequest,
  repo: AzureDevOpsRepoRef,
  repoId: string
): AzureDevOpsTaskItem | null {
  const id = typeof raw.pullRequestId === 'number' ? raw.pullRequestId : null
  if (id === null || !raw.title) {
    return null
  }
  return {
    kind: 'pull-request',
    id,
    title: raw.title,
    typeLabel: 'Pull request',
    state: raw.isDraft ? 'draft' : (raw.status ?? 'active'),
    person: identityName(raw.createdBy),
    updatedAt: raw.creationDate ?? null,
    url: `${repo.webBaseUrl.replace(/\/+$/, '')}/pullrequest/${id}`,
    // Why: PR ids are per project, but a PR belongs to one repository; key it there.
    projectKey: `${projectKey(repo)}|${repo.repository.toLowerCase()}`,
    repoId,
    ...(raw.sourceRefName ? { sourceBranch: raw.sourceRefName.replace(/^refs\/heads\//, '') } : {})
  }
}

function failure(error: unknown): AzureDevOpsTaskListResult {
  const message = error instanceof Error ? error.message : String(error)
  // Why: a bad or under-scoped PAT surfaces as 401/403, or as a 203 HTML sign-in page that fails JSON parsing.
  const isAuth = /HTTP (401|403)\b|JSON|Unexpected token/i.test(message)
  return {
    items: [],
    error: isAuth
      ? {
          type: 'auth',
          message:
            'Azure DevOps rejected the credentials. Check the organization PAT in Settings and that it has the Work Items (Read) and Code (Read) scopes.'
        }
      : {
          type: 'request',
          message: message.startsWith('Azure DevOps')
            ? message
            : `Azure DevOps request failed: ${message}`
        }
  }
}

function resolveRepo(remoteUrl: string): AzureDevOpsRepoRef | null {
  return remoteUrl ? parseAzureDevOpsRepoRef(remoteUrl) : null
}

const notAzureDevOps: AzureDevOpsTaskListResult = {
  items: [],
  error: { type: 'not_azure_devops', message: 'The repository is not hosted on Azure DevOps.' }
}

export async function listAzureDevOpsWorkItems(args: {
  repoId: string
  remoteUrl: string
  filter: AzureDevOpsWorkItemFilter
}): Promise<AzureDevOpsTaskListResult> {
  const repo = resolveRepo(args.remoteUrl)
  if (!repo) {
    return notAzureDevOps
  }
  try {
    const query = await requestAzureDevOpsJson<{ workItems?: { id?: number }[] }>(
      repo,
      '/_apis/wit/wiql',
      {
        searchParams: { $top: TASK_LIST_LIMIT },
        body: { query: buildAzureDevOpsWorkItemWiql(repo.project, args.filter) },
        timeoutMs: TASK_REQUEST_TIMEOUT_MS
      },
      true
    )
    const ids = (query?.workItems ?? [])
      .map((entry) => entry.id)
      .filter((id): id is number => typeof id === 'number')
      .slice(0, TASK_LIST_LIMIT)
    if (ids.length === 0) {
      return { items: [] }
    }
    const batch = await requestAzureDevOpsJson<{ value?: RawWorkItem[] }>(
      repo,
      '/_apis/wit/workitemsbatch',
      { body: { ids, fields: WORK_ITEM_FIELDS }, timeoutMs: TASK_REQUEST_TIMEOUT_MS },
      true
    )
    const byId = new Map((batch?.value ?? []).map((item) => [item.id, item]))
    // Why: the batch endpoint does not preserve WIQL order; keep "most recently changed" first.
    const items = ids
      .map((id) => byId.get(id))
      .map((raw) => (raw ? mapAzureDevOpsWorkItem(raw, repo, args.repoId) : null))
      .filter((item): item is AzureDevOpsTaskItem => item !== null)
    return { items }
  } catch (error) {
    return failure(error)
  }
}

async function authenticatedUserId(repo: AzureDevOpsRepoRef): Promise<string | null> {
  const connection = await requestAzureDevOpsJsonAtBase<{
    authenticatedUser?: { id?: string | null } | null
  }>(
    organizationBaseUrl(repo),
    '/_apis/connectionData',
    { timeoutMs: TASK_REQUEST_TIMEOUT_MS },
    true
  )
  return connection?.authenticatedUser?.id ?? null
}

export async function listAzureDevOpsPullRequests(args: {
  repoId: string
  remoteUrl: string
  filter: AzureDevOpsPullRequestFilter
}): Promise<AzureDevOpsTaskListResult> {
  const repo = resolveRepo(args.remoteUrl)
  if (!repo) {
    return notAzureDevOps
  }
  try {
    const searchParams: Record<string, string | number> = {
      'searchCriteria.status': 'active',
      $top: TASK_LIST_LIMIT
    }
    if (args.filter !== 'active') {
      const userId = await authenticatedUserId(repo)
      if (!userId) {
        return failure(new Error('HTTP 401'))
      }
      searchParams[
        args.filter === 'created-by-me' ? 'searchCriteria.creatorId' : 'searchCriteria.reviewerId'
      ] = userId
    }
    const response = await requestAzureDevOpsJson<{ value?: RawPullRequest[] }>(
      repo,
      `/_apis/git/repositories/${encodeURIComponent(repo.repository)}/pullrequests`,
      { searchParams, timeoutMs: TASK_REQUEST_TIMEOUT_MS },
      true
    )
    const items = (response?.value ?? [])
      .map((raw) => mapAzureDevOpsTaskPullRequest(raw, repo, args.repoId))
      .filter((item): item is AzureDevOpsTaskItem => item !== null)
    return { items }
  } catch (error) {
    return failure(error)
  }
}
