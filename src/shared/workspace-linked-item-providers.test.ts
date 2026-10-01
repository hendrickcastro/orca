import { describe, expect, it } from 'vitest'
import { normalizeWorkspaceLinkedItem } from './workspace-linked-item'

describe('workspace linked item providers', () => {
  it('keeps Asana and Azure DevOps items so the worktree stays linked to its task', () => {
    for (const provider of ['asana', 'azure-devops'] as const) {
      expect(
        normalizeWorkspaceLinkedItem({
          provider,
          type: 'issue',
          number: provider === 'asana' ? 0 : 7,
          title: 'Task',
          url: 'https://example.com/task'
        })
      ).toMatchObject({ provider })
    }
    expect(
      normalizeWorkspaceLinkedItem({
        provider: 'trello',
        type: 'issue',
        number: 0,
        title: 'Task',
        url: 'https://example.com/task'
      })
    ).toBeNull()
  })
})
