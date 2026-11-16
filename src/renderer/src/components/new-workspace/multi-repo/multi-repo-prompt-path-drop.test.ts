import { describe, expect, it } from 'vitest'
import { insertDroppedPathsIntoPrompt } from './multi-repo-prompt-path-drop'

describe('insertDroppedPathsIntoPrompt', () => {
  it('separates a dropped path from the words around the caret', () => {
    expect(insertDroppedPathsIntoPrompt('Fix and test', 3, 3, ['D:\\Front\\a.ts'])).toEqual({
      value: 'Fix D:\\Front\\a.ts and test',
      caret: 17
    })
  })

  it('replaces the selection and adds no padding next to existing whitespace', () => {
    expect(insertDroppedPathsIntoPrompt('Read X now', 5, 6, ['/repo/x.md'])).toEqual({
      value: 'Read /repo/x.md now',
      caret: 15
    })
  })

  it('quotes paths containing spaces and joins several paths', () => {
    expect(insertDroppedPathsIntoPrompt('', 0, 0, ['D:\\My Docs\\a.md', 'E:\\Back\\src'])).toEqual({
      value: '"D:\\My Docs\\a.md" E:\\Back\\src',
      caret: 29
    })
  })

  it('clamps a stale caret to the end of the prompt', () => {
    expect(insertDroppedPathsIntoPrompt('See', 99, 99, ['/a'])).toEqual({
      value: 'See /a',
      caret: 6
    })
  })
})
