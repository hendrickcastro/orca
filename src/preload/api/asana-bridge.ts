import { ipcRenderer } from 'electron'
import type {
  AsanaConnectionStatus,
  AsanaConnectResult,
  AsanaCreateTaskArgs,
  AsanaCreateTaskResult,
  AsanaProject,
  AsanaTaskListArgs,
  AsanaTaskListResult
} from '../../shared/asana-types'
import type { AsanaTaskDetailResult } from '../../shared/asana-task-context'
import type { PreloadApi } from '../api-types'

export type AsanaApi = {
  status: () => Promise<AsanaConnectionStatus>
  connect: (token: string) => Promise<AsanaConnectResult>
  disconnect: () => Promise<void>
  listProjects: (workspaceGid: string) => Promise<AsanaProject[]>
  listTasks: (args: AsanaTaskListArgs) => Promise<AsanaTaskListResult>
  createTask: (args: AsanaCreateTaskArgs) => Promise<AsanaCreateTaskResult>
  getTask: (gid: string) => Promise<AsanaTaskDetailResult>
}

export const asanaApi = {
  status: () => ipcRenderer.invoke('asana:status'),
  connect: (token) => ipcRenderer.invoke('asana:connect', token),
  disconnect: () => ipcRenderer.invoke('asana:disconnect'),
  listProjects: (workspaceGid) => ipcRenderer.invoke('asana:listProjects', workspaceGid),
  listTasks: (args) => ipcRenderer.invoke('asana:listTasks', args),
  createTask: (args) => ipcRenderer.invoke('asana:createTask', args),
  getTask: (gid) => ipcRenderer.invoke('asana:getTask', gid)
} satisfies PreloadApi['asana']
