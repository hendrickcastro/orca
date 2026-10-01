import { describe, expect, it } from 'vitest'
import type { AsanaTask } from '../../../../../shared/asana-types'
import {
  filterAsanaTasksByStatus,
  formatAsanaDueDate,
  getAsanaTaskState
} from './asana-task-presentation'

function task(overrides: Partial<AsanaTask>): AsanaTask {
  return {
    gid: '1',
    name: 'Task',
    completed: false,
    completedAt: null,
    createdAt: null,
    assignee: null,
    dueOn: null,
    modifiedAt: null,
    projects: [],
    url: 'https://app.asana.com/0/0/1',
    ...overrides
  }
}

const now = new Date(2026, 8, 30, 10, 0, 0)

describe('Asana task presentation', () => {
  it('flags done, overdue and open tasks like Asana does', () => {
    expect(getAsanaTaskState(task({ completed: true, dueOn: '2026-01-01' }), now)).toBe('done')
    expect(getAsanaTaskState(task({ dueOn: '2026-09-29' }), now)).toBe('overdue')
    expect(getAsanaTaskState(task({ dueOn: '2026-09-30' }), now)).toBe('open')
    expect(getAsanaTaskState(task({}), now)).toBe('open')
  })

  it('filters by completion', () => {
    const tasks = [task({ gid: 'a', completed: true }), task({ gid: 'b' })]
    expect(filterAsanaTasksByStatus(tasks, 'done').map((entry) => entry.gid)).toEqual(['a'])
    expect(filterAsanaTasksByStatus(tasks, 'open').map((entry) => entry.gid)).toEqual(['b'])
    expect(filterAsanaTasksByStatus(tasks, 'all')).toHaveLength(2)
  })

  it('formats a due day without shifting it across time zones', () => {
    const year = new Date().getFullYear()
    expect(formatAsanaDueDate(`${year}-09-28`, 'en-US')).toBe('Sep 28')
    expect(formatAsanaDueDate('2020-09-28', 'en-US')).toBe('Sep 28, 2020')
    expect(formatAsanaDueDate(null)).toBe('')
  })
})
