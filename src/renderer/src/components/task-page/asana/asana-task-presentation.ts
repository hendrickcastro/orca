import type { AsanaTask, AsanaTaskStatusFilter } from '../../../../../shared/asana-types'

export type AsanaTaskState = 'done' | 'overdue' | 'open'

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Asana marks an open task whose due day has passed as overdue (red date). */
export function getAsanaTaskState(task: AsanaTask, now: Date = new Date()): AsanaTaskState {
  if (task.completed) {
    return 'done'
  }
  return task.dueOn && task.dueOn < localDateKey(now) ? 'overdue' : 'open'
}

export function filterAsanaTasksByStatus(
  tasks: readonly AsanaTask[],
  filter: AsanaTaskStatusFilter
): AsanaTask[] {
  if (filter === 'all') {
    return [...tasks]
  }
  return tasks.filter((task) => (filter === 'done' ? task.completed : !task.completed))
}

/** `2026-09-28` → "28 sep", read as a calendar day so time zones never shift it. */
export function formatAsanaDueDate(dueOn: string | null, locale?: string): string {
  const match = dueOn?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return ''
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' })
  })
}
