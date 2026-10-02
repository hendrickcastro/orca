import { describe, expect, it } from 'vitest'
import { getWorktreeCardJiraIssueDisplay } from './worktree-card-jira-issue-display'

describe('fork: linked Asana and Azure DevOps items on the worktree card', () => {
  it('shows them in the same task row as Jira', () => {
    expect(
      getWorktreeCardJiraIssueDisplay({
        linkedWorkItem: {
          provider: 'asana',
          type: 'issue',
          number: 0,
          title: 'Envío justificantes',
          url: 'https://app.asana.com/0/9/42'
        }
      })
    ).toEqual({
      provider: 'asana',
      identifier: '',
      title: 'Envío justificantes',
      url: 'https://app.asana.com/0/9/42'
    })
    expect(
      getWorktreeCardJiraIssueDisplay({
        linkedWorkItem: {
          provider: 'azure-devops',
          type: 'pr',
          number: 12,
          title: 'Add search',
          url: 'https://dev.azure.com/acme/Portal/_git/web/pullrequest/12'
        }
      })
    ).toMatchObject({ provider: 'azure-devops', identifier: '!12' })
  })
})
