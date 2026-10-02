// @vitest-environment happy-dom
import { act, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { MentionSuggestionTextarea } from './MentionSuggestionTextarea'

const OPTIONS = Array.from({ length: 30 }, (_, index) => `skill-${index}`)

function Harness(): React.JSX.Element {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  return (
    <MentionSuggestionTextarea
      id="mention-field"
      rows={3}
      value={value}
      onValueChange={setValue}
      textareaRef={textareaRef}
      findQuery={(text, caret) => {
        const at = text.lastIndexOf('@', caret)
        return at === -1 ? null : { atIndex: at, query: text.slice(at + 1, caret) }
      }}
      getSuggestions={() => OPTIONS}
      getOptionKey={(option) => option}
      getInsertText={(option) => option}
      renderOption={(option) => option}
    />
  )
}

function typeAt(textarea: HTMLTextAreaElement): void {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      textarea,
      '@'
    )
    textarea.setSelectionRange(1, 1)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('MentionSuggestionTextarea', () => {
  it('stays open while the list is scrolled with the mouse', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => root.render(<Harness />))
    const textarea = document.getElementById('mention-field')
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error('missing textarea')
    }
    textarea.focus()
    typeAt(textarea)
    const listbox = document.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()

    // Pressing the scrollbar blurs the textarea before any click lands.
    act(() => {
      listbox?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
      textarea.dispatchEvent(new FocusEvent('blur'))
    })
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()

    act(() => window.dispatchEvent(new Event('pointerup')))
    act(() => textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    act(() => root.unmount())
  })
})
