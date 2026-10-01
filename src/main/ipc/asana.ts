import { ipcMain } from 'electron'
import {
  connectAsana,
  createAsanaTask,
  disconnectAsana,
  getAsanaStatus,
  listAsanaProjects,
  listAsanaTasks
} from '../asana/asana-client'
import { getAsanaTaskDetail } from '../asana/asana-task-detail'
import type { AsanaTaskDetailResult } from '../../shared/asana-task-context'
import type {
  AsanaConnectionStatus,
  AsanaConnectResult,
  AsanaCreateTaskArgs,
  AsanaCreateTaskResult,
  AsanaProject,
  AsanaTaskListArgs,
  AsanaTaskListResult
} from '../../shared/asana-types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function normalizeTaskListArgs(value: unknown): AsanaTaskListArgs | null {
  if (!isRecord(value) || typeof value.workspaceGid !== 'string' || !value.workspaceGid) {
    return null
  }
  return {
    workspaceGid: value.workspaceGid,
    scope: value.scope === 'project' ? 'project' : 'my-tasks',
    projectGid: optionalString(value.projectGid)
  }
}

function normalizeCreateTaskArgs(value: unknown): AsanaCreateTaskArgs | null {
  if (
    !isRecord(value) ||
    typeof value.workspaceGid !== 'string' ||
    !value.workspaceGid ||
    typeof value.name !== 'string'
  ) {
    return null
  }
  const dueOn = optionalString(value.dueOn)
  return {
    workspaceGid: value.workspaceGid,
    name: value.name,
    notes: typeof value.notes === 'string' ? value.notes : undefined,
    projectGid: optionalString(value.projectGid),
    assignToMe: value.assignToMe === true,
    dueOn: dueOn && /^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? dueOn : null
  }
}

export function registerAsanaHandlers(): void {
  ipcMain.handle('asana:status', async (): Promise<AsanaConnectionStatus> => getAsanaStatus())

  ipcMain.handle('asana:connect', async (_event, token: unknown): Promise<AsanaConnectResult> => {
    return typeof token === 'string'
      ? connectAsana(token)
      : { ok: false, error: 'Invalid Asana token' }
  })

  ipcMain.handle('asana:disconnect', async (): Promise<void> => {
    disconnectAsana()
  })

  ipcMain.handle(
    'asana:listProjects',
    async (_event, workspaceGid: unknown): Promise<AsanaProject[]> => {
      if (typeof workspaceGid !== 'string' || !workspaceGid) {
        throw new Error('Invalid Asana workspace')
      }
      return listAsanaProjects(workspaceGid)
    }
  )

  ipcMain.handle('asana:listTasks', async (_event, args: unknown): Promise<AsanaTaskListResult> => {
    const input = normalizeTaskListArgs(args)
    return input ? listAsanaTasks(input) : { tasks: [], error: 'Invalid Asana task request' }
  })

  ipcMain.handle('asana:getTask', async (_event, gid: unknown): Promise<AsanaTaskDetailResult> => {
    return typeof gid === 'string' && /^\d+$/.test(gid)
      ? getAsanaTaskDetail(gid)
      : { ok: false, error: 'Invalid Asana task' }
  })

  ipcMain.handle(
    'asana:createTask',
    async (_event, args: unknown): Promise<AsanaCreateTaskResult> => {
      const input = normalizeCreateTaskArgs(args)
      return input ? createAsanaTask(input) : { ok: false, error: 'Invalid Asana task' }
    }
  )
}
