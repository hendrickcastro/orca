import React, { useCallback, useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'

export type MentionQuery = {
  atIndex: number
  query: string
}

export type MentionSuggestionTextareaProps<T> = {
  value: string
  onValueChange: (value: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onInsert?: (option: T) => void
  id?: string
  placeholder?: string
  rows: number
  /** `field` renders the form Textarea primitive; `bare` leaves styling to `className`. */
  appearance?: 'bare' | 'field'
  className?: string
  wrapperClassName?: string
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  findQuery: (value: string, caret: number) => MentionQuery | null
  getSuggestions: (query: string) => readonly T[]
  getOptionKey: (option: T) => string
  getInsertText: (option: T) => string
  /** Rendered as a heading whenever it differs from the previous option's group. */
  getOptionGroup?: (option: T) => string
  renderOption: (option: T) => React.ReactNode
}

export function MentionSuggestionTextarea<T>({
  value,
  onValueChange,
  onKeyDown,
  onInsert,
  id,
  placeholder,
  rows,
  appearance = 'bare',
  className,
  wrapperClassName,
  textareaRef,
  findQuery,
  getSuggestions,
  getOptionKey,
  getInsertText,
  getOptionGroup,
  renderOption
}: MentionSuggestionTextareaProps<T>): React.JSX.Element {
  const listboxId = useId()
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const suggestions = useMemo(
    () => (mentionQuery ? getSuggestions(mentionQuery.query) : []),
    [getSuggestions, mentionQuery]
  )
  const showSuggestions = mentionQuery !== null && suggestions.length > 0
  const TextareaElement = appearance === 'field' ? Textarea : 'textarea'

  const syncMentionQuery = useCallback(
    (textarea: HTMLTextAreaElement): void => {
      setMentionQuery(findQuery(textarea.value, textarea.selectionStart))
      setActiveIndex(0)
    },
    [findQuery]
  )

  const insertMention = useCallback(
    (option: T): void => {
      const textarea = textareaRef.current
      const caret = textarea?.selectionStart ?? value.length
      const query = textarea ? findQuery(value, caret) : mentionQuery
      if (!query) {
        return
      }
      const suffix = value[caret] && !/\s/.test(value[caret]) ? ' ' : ''
      const inserted = `${getInsertText(option)}${suffix}`
      const nextValue = `${value.slice(0, query.atIndex)}${inserted}${value.slice(caret)}`
      const nextCaret = query.atIndex + inserted.length
      onValueChange(nextValue)
      onInsert?.(option)
      setMentionQuery(null)
      requestAnimationFrame(() => {
        textarea?.focus()
        textarea?.setSelectionRange(nextCaret, nextCaret)
      })
    },
    [findQuery, getInsertText, mentionQuery, onInsert, onValueChange, textareaRef, value]
  )

  return (
    <div className={cn('relative min-w-0 flex-1', wrapperClassName)}>
      {showSuggestions && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute right-0 bottom-[calc(100%+6px)] left-0 z-50 max-h-64 overflow-y-auto rounded-md border border-border/70 bg-popover p-1 text-popover-foreground shadow-lg scrollbar-sleek"
        >
          {suggestions.map((option, index) => {
            const group = getOptionGroup?.(option)
            const showGroup =
              group !== undefined &&
              (index === 0 || getOptionGroup?.(suggestions[index - 1]) !== group)
            return (
              <React.Fragment key={getOptionKey(option)}>
                {showGroup && (
                  <div
                    role="presentation"
                    className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground"
                  >
                    {group}
                  </div>
                )}
                <button
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    insertMention(option)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px]',
                    index === activeIndex && 'bg-accent text-accent-foreground'
                  )}
                >
                  {renderOption(option)}
                </button>
              </React.Fragment>
            )
          })}
        </div>
      )}
      <TextareaElement
        id={id}
        ref={textareaRef}
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listboxId : undefined}
        aria-activedescendant={showSuggestions ? `${listboxId}-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          syncMentionQuery(event.currentTarget)
        }}
        onClick={(event) => syncMentionQuery(event.currentTarget)}
        onKeyUp={(event) => {
          if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
            syncMentionQuery(event.currentTarget)
          }
        }}
        onBlur={() => setMentionQuery(null)}
        onKeyDown={(event) => {
          if (showSuggestions) {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveIndex((current) => (current + 1) % suggestions.length)
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length)
              return
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault()
              insertMention(suggestions[activeIndex] ?? suggestions[0])
              return
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setMentionQuery(null)
              return
            }
          }
          onKeyDown?.(event)
        }}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
    </div>
  )
}
