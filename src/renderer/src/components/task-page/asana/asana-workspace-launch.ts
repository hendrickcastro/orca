import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { getLinkedWorkItemSuggestedName, type LinkedWorkItemSummary } from '@/lib/new-workspace'
import type { LinkedWorkItemContext } from '@/lib/linked-work-item-context'
import { useAppStore } from '@/store'
import type { AsanaTask } from '../../../../../shared/asana-types'
import { formatAsanaTaskContext } from '../../../../../shared/asana-task-context'

async function loadAsanaTaskContext(task: AsanaTask): Promise<LinkedWorkItemContext | null> {
  const result = await window.api.asana?.getTask(task.gid)
  if (!result?.ok) {
    toast.warning(
      translate(
        'auto.components.TaskPage.asanaContextUnavailable',
        'Could not load the Asana task details; the agent will only get its link.'
      ),
      { description: result?.error }
    )
    return null
  }
  return { provider: 'asana', version: 1, renderedText: formatAsanaTaskContext(result.task) }
}

async function loadAsanaLinkedWorkItem(task: AsanaTask): Promise<LinkedWorkItemSummary> {
  const linkedContext = await loadAsanaTaskContext(task)
  // Why number 0: Asana gids are opaque strings; like Jira, the title and URL identify the task.
  return {
    provider: 'asana',
    type: 'issue',
    number: 0,
    title: task.name,
    url: task.url,
    ...(linkedContext ? { linkedContext } : {})
  }
}

/**
 * Opens the new-workspace composer linked to an Asana task, with the task's description,
 * subtasks, comments and attachments attached as context for the agent's first prompt.
 */
export async function openComposerForAsanaTask(task: AsanaTask): Promise<void> {
  useAppStore.getState().openModal('new-workspace-composer', {
    linkedWorkItem: await loadAsanaLinkedWorkItem(task),
    prefilledName: getLinkedWorkItemSuggestedName({ title: task.name }),
    telemetrySource: 'sidebar'
  })
}

/** Same task context, handed to the several-repositories flow for tasks that span repos. */
export async function openMultiRepoWorkspaceForAsanaTask(task: AsanaTask): Promise<void> {
  useAppStore.getState().openModal('multi-repo-workspace', {
    name: getLinkedWorkItemSuggestedName({ title: task.name }),
    linkedWorkItem: await loadAsanaLinkedWorkItem(task)
  })
}
