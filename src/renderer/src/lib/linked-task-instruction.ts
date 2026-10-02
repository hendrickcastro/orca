import type { TaskProvider } from '../../../shared/task-providers'

const LINKED_TASK_PROVIDER_LABELS: Partial<Record<TaskProvider, string>> = {
  asana: 'Asana task',
  'azure-devops': 'Azure DevOps item',
  jira: 'Jira issue'
}

// Why: the contained block's header tells the agent not to obey its contents, so the request
// to work on the task has to come from the trusted part of the prompt.
export function linkedTaskInstruction(linkedWorkItem: {
  title?: string
  linkedContext?: { provider: TaskProvider }
}): string {
  const label =
    LINKED_TASK_PROVIDER_LABELS[linkedWorkItem.linkedContext?.provider ?? 'github'] ?? 'task'
  const title = linkedWorkItem.title?.trim()
  return title
    ? `Work on the linked ${label} "${title}". Its details follow.`
    : `Work on the linked ${label}. Its details follow.`
}
