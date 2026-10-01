import { describe, expect, it } from 'vitest'
import { resolveQuickCreateAgentPrompt } from './quick-agent-instructions'

const asanaTask = {
  provider: 'asana' as const,
  number: 0,
  url: 'https://app.asana.com/0/9/42',
  title: 'Envío justificantes',
  linkedContext: {
    provider: 'asana' as const,
    version: 1 as const,
    renderedText: 'Asana task: Envío justificantes\n\nDescription:\nLos justificantes no llegan.'
  }
}

describe('resolveQuickCreateAgentPrompt', () => {
  it('puts the typed instructions before the linked task and its details', () => {
    const { draftPrompt } = resolveQuickCreateAgentPrompt({
      hasAgent: true,
      linkedWorkItem: asanaTask,
      instructions: '  Only touch the API project.  ',
      note: ''
    })
    expect(
      draftPrompt?.startsWith('Only touch the API project.\n\nhttps://app.asana.com/0/9/42')
    ).toBe(true)
    expect(draftPrompt).toContain('Work on the linked Asana task "Envío justificantes".')
    expect(draftPrompt).toContain('Los justificantes no llegan.')
  })

  it('sends the instructions alone when no task is linked', () => {
    expect(
      resolveQuickCreateAgentPrompt({
        hasAgent: true,
        linkedWorkItem: null,
        instructions: 'Fix the flaky login test',
        note: 'saved as comment'
      }).draftPrompt
    ).toBe('Fix the flaky login test')
  })

  it('sends nothing when the workspace starts without an agent', () => {
    expect(
      resolveQuickCreateAgentPrompt({
        hasAgent: false,
        linkedWorkItem: asanaTask,
        instructions: 'Fix it',
        note: ''
      })
    ).toEqual({ prompt: '', draftPrompt: null })
  })
})
