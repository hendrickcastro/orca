export type AsanaWorkspace = { gid: string; name: string }

export type AsanaProject = { gid: string; name: string }

export type AsanaConnectionStatus = {
  connected: boolean
  userName: string | null
  workspaces: AsanaWorkspace[]
  /** Set when a token is stored but Asana rejected it or could not be reached. */
  error: string | null
}

export type AsanaConnectResult =
  | { ok: true; status: AsanaConnectionStatus }
  | { ok: false; error: string }

export type AsanaTaskScope = 'my-tasks' | 'project'

export type AsanaTaskStatusFilter = 'all' | 'open' | 'done'

export type AsanaTask = {
  gid: string
  name: string
  completed: boolean
  completedAt: string | null
  createdAt: string | null
  assignee: string | null
  dueOn: string | null
  modifiedAt: string | null
  projects: string[]
  url: string
}

export type AsanaTaskListArgs = {
  workspaceGid: string
  scope: AsanaTaskScope
  projectGid?: string | null
}

export type AsanaTaskListResult = { tasks: AsanaTask[]; error?: string }

export type AsanaCreateTaskArgs = {
  workspaceGid: string
  name: string
  notes?: string
  projectGid?: string | null
  assignToMe: boolean
  dueOn?: string | null
}

export type AsanaCreateTaskResult = { ok: true; task: AsanaTask } | { ok: false; error: string }
