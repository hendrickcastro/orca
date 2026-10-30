import { describe, expect, it } from 'vitest'
import { sliceFilePreview } from './FileLinkPreviewBody'

const content = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`).join('\n')

describe('sliceFilePreview', () => {
  it('starts at the top without a line', () => {
    const preview = sliceFilePreview(content, null)
    expect(preview.firstLine).toBe(1)
    expect(preview.code.split('\n')).toHaveLength(30)
  })

  it('shows a few lines of context above the target line', () => {
    expect(sliceFilePreview(content, 50).firstLine).toBe(46)
    expect(sliceFilePreview(content, 2).firstLine).toBe(1)
    expect(sliceFilePreview(content, 500).firstLine).toBe(96)
  })
})
