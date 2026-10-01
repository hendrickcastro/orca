export type AsanaTaskDetail = {
  gid: string
  name: string
  url: string
  notes: string
  completed: boolean
  assignee: string | null
  dueOn: string | null
  projects: string[]
  tags: string[]
  customFields: { name: string; value: string }[]
  subtasks: { name: string; completed: boolean }[]
  comments: { author: string | null; createdAt: string | null; text: string }[]
  attachments: { name: string; url: string | null }[]
}

export type AsanaTaskDetailResult =
  | { ok: true; task: AsanaTaskDetail }
  | { ok: false; error: string }

/** Plain-text rendering of an Asana task that the agent receives as linked context. */
export function formatAsanaTaskContext(task: AsanaTaskDetail): string {
  const lines = [`Asana task: ${task.name}`, `URL: ${task.url}`]
  lines.push(`Status: ${task.completed ? 'completed' : 'open'}`)
  if (task.assignee) {
    lines.push(`Assignee: ${task.assignee}`)
  }
  if (task.dueOn) {
    lines.push(`Due: ${task.dueOn}`)
  }
  if (task.projects.length > 0) {
    lines.push(`Projects: ${task.projects.join(', ')}`)
  }
  if (task.tags.length > 0) {
    lines.push(`Tags: ${task.tags.join(', ')}`)
  }
  for (const field of task.customFields) {
    lines.push(`${field.name}: ${field.value}`)
  }
  if (task.notes.trim()) {
    lines.push('', 'Description:', task.notes.trim())
  }
  if (task.subtasks.length > 0) {
    lines.push('', 'Subtasks:')
    for (const subtask of task.subtasks) {
      lines.push(`- [${subtask.completed ? 'x' : ' '}] ${subtask.name}`)
    }
  }
  if (task.attachments.length > 0) {
    lines.push('', 'Attachments:')
    for (const attachment of task.attachments) {
      lines.push(`- ${attachment.name}${attachment.url ? ` (${attachment.url})` : ''}`)
    }
  }
  if (task.comments.length > 0) {
    lines.push('', 'Comments (oldest first):')
    for (const comment of task.comments) {
      const author = comment.author ?? 'Unknown'
      const when = comment.createdAt ? ` on ${comment.createdAt.slice(0, 10)}` : ''
      lines.push(`- ${author}${when}: ${comment.text.trim()}`)
    }
  }
  return lines.join('\n')
}
