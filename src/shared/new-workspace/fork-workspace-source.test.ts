import { describe, expect, it } from 'vitest'
import { shouldPreserveWorkspaceSourceOnRepoChange } from './workspace-source'

describe('fork: workspace source policy', () => {
  it('keeps an Asana task when the project is picked after it', () => {
    expect(
      shouldPreserveWorkspaceSourceOnRepoChange({
        provider: 'asana',
        type: 'issue',
        number: 0,
        title: 'Envío justificantes',
        url: 'https://app.asana.com/0/9/42'
      })
    ).toBe(true)
  })
})
