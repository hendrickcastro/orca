import { describe, expect, it } from 'vitest'
import {
  buildMultiRepoPromptWithLinkedTask,
  defaultMultiRepoTaskName,
  readMultiRepoInitialValues
} from './multi-repo-linked-task'

const linkedWorkItem = {
  provider: 'asana' as const,
  type: 'issue' as const,
  number: 0,
  title: 'Envío justificantes',
  url: 'https://app.asana.com/0/9/42',
  linkedContext: {
    provider: 'asana' as const,
    version: 1 as const,
    renderedText: 'Asana task: Envío justificantes\n\nDescription:\nRevisar la cola.'
  }
}

describe('multi-repo linked task', () => {
  it('reads composer hand-over data and ignores malformed items', () => {
    expect(readMultiRepoInitialValues({ prompt: 'Front and back', linkedWorkItem })).toEqual({
      name: undefined,
      prompt: 'Front and back',
      linkedWorkItem
    })
    expect(readMultiRepoInitialValues({ linkedWorkItem: { title: 3 } }).linkedWorkItem).toBeNull()
  })

  it('names the task after the linked item when no name was typed', () => {
    expect(defaultMultiRepoTaskName({ linkedWorkItem })).toBe('Envío justificantes')
    expect(defaultMultiRepoTaskName({ name: 'Custom', linkedWorkItem })).toBe('Custom')
  })

  it('appends the linked task and its details after the instructions', () => {
    const prompt = buildMultiRepoPromptWithLinkedTask('Change both repos.', linkedWorkItem)
    expect(
      prompt.startsWith('Change both repos.\n\nLinked work items:\n- https://app.asana.com/0/9/42')
    ).toBe(true)
    expect(prompt).toContain('Revisar la cola.')
    expect(buildMultiRepoPromptWithLinkedTask('Only this', null)).toBe('Only this')
  })
})
