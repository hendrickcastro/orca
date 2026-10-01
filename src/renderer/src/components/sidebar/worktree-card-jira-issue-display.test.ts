import { describe, expect, it } from 'vitest'
import {
  getConfiguredWorktreeCardJiraIssueDisplay,
  getWorktreeCardJiraIssueDisplay
} from './worktree-card-jira-issue-display'

describe('getWorktreeCardJiraIssueDisplay', () => {
  it('projects persisted Jira linked-item metadata for the workspace card', () => {
    expect(
      getWorktreeCardJiraIssueDisplay({
        linkedWorkItem: {
          provider: 'jira',
          type: 'issue',
          number: 1,
          jiraIdentifier: 'KAN-1',
          title: 'KAN-1 Test Jira card icon',
          url: 'https://company.atlassian.net/browse/KAN-1'
        }
      })
    ).toEqual({
      provider: 'jira',
      identifier: 'KAN-1',
      title: 'Test Jira card icon',
      url: 'https://company.atlassian.net/browse/KAN-1'
    })
  })

  it('does not infer Jira from another provider', () => {
    expect(
      getWorktreeCardJiraIssueDisplay({
        linkedWorkItem: {
          provider: 'linear',
          type: 'issue',
          number: 1,
          linearIdentifier: 'ENG-1',
          title: 'Linear issue',
          url: 'https://linear.app/acme/issue/ENG-1'
        }
      })
    ).toBeNull()
  })

  it('shows persisted Jira metadata only when the Jira display property is enabled', () => {
    const worktree = {
      linkedWorkItem: {
        provider: 'jira' as const,
        type: 'issue' as const,
        number: 1,
        jiraIdentifier: 'KAN-1',
        title: 'Test Jira card preference',
        url: 'https://company.atlassian.net/browse/KAN-1'
      }
    }

    expect(getConfiguredWorktreeCardJiraIssueDisplay(worktree, [])).toBeNull()
    expect(getConfiguredWorktreeCardJiraIssueDisplay(worktree, ['jira-issue'])).toMatchObject({
      identifier: 'KAN-1',
      title: 'Test Jira card preference'
    })
  })

  it('shows linked Asana and Azure DevOps items in the same task row', () => {
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
