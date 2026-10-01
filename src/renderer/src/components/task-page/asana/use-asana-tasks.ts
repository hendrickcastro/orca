import { useEffect, useState } from 'react'
import type { AsanaTask } from '../../../../../shared/asana-types'
import { translate } from '@/i18n/i18n'
import { applyAsanaStatus, patchAsanaTaskView, useAsanaTaskView } from './asana-task-view-store'

export async function reloadAsanaStatus(): Promise<void> {
  const api = window.api.asana
  if (!api) {
    applyAsanaStatus({
      connected: false,
      userName: null,
      workspaces: [],
      error: translate(
        'auto.components.TaskPage.asanaUnavailable',
        'Asana is not available in this client.'
      )
    })
    return
  }
  patchAsanaTaskView({ statusLoading: true })
  try {
    applyAsanaStatus(await api.status())
  } catch (error) {
    applyAsanaStatus({
      connected: false,
      userName: null,
      workspaces: [],
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/** Loads the connection once per mount, then tasks and projects for the selected workspace. */
export function useAsanaTasks(): { tasks: AsanaTask[]; error: string | null } {
  const { status, workspaceGid, scope, projectGid, refreshNonce } = useAsanaTaskView()
  const [tasks, setTasks] = useState<AsanaTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const connected = status?.connected === true

  useEffect(() => {
    void reloadAsanaStatus()
  }, [])

  useEffect(() => {
    if (!connected || !workspaceGid) {
      return
    }
    let stale = false
    void window.api.asana
      ?.listProjects(workspaceGid)
      .then((projects) => {
        if (!stale) {
          patchAsanaTaskView({ projects })
        }
      })
      .catch(() => {
        if (!stale) {
          patchAsanaTaskView({ projects: [] })
        }
      })
    return () => {
      stale = true
    }
  }, [connected, workspaceGid])

  useEffect(() => {
    if (!connected || !workspaceGid || (scope === 'project' && !projectGid)) {
      setTasks([])
      setError(null)
      return
    }
    let stale = false
    patchAsanaTaskView({ loading: true })
    setError(null)
    void window.api.asana
      ?.listTasks({ workspaceGid, scope, projectGid })
      .then((result) => {
        if (!stale) {
          setTasks(result.tasks)
          setError(result.error ?? null)
        }
      })
      .catch((cause: unknown) => {
        if (!stale) {
          setTasks([])
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      })
      .finally(() => {
        if (!stale) {
          patchAsanaTaskView({ loading: false })
        }
      })
    return () => {
      stale = true
    }
  }, [connected, workspaceGid, scope, projectGid, refreshNonce])

  return { tasks, error }
}
