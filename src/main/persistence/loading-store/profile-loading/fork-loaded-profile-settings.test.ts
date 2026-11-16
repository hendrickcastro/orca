import { describe, expect, it } from 'vitest'
import { visibleProviders } from './fork-loaded-profile-settings'

describe('fork: visible task providers on load', () => {
  it('adds Azure DevOps and Asana once for profiles saved before they existed', () => {
    expect(visibleProviders(undefined, ['github', 'jira'])).toEqual([
      'github',
      'jira',
      'azure-devops',
      'asana'
    ])
  })

  it('keeps a later opt-out once the migration has run', () => {
    expect(
      visibleProviders({ visibleTaskProvidersDefaultedForForkProviders: true }, ['gitlab'])
    ).toEqual(['gitlab'])
  })
})
