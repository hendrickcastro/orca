import React, { useCallback } from 'react'
import { filterGitHubMentionOptions } from '@/components/github/github-mention-option-filter'
import { GitHubUserAvatar } from '@/components/github/github-user-avatar'
import { MentionSuggestionTextarea } from '@/components/mention-textarea/MentionSuggestionTextarea'
import type { MentionOption } from '../page-types'
import { findMentionQuery } from './query'

export function MentionTextarea({
  value,
  onValueChange,
  onKeyDown,
  placeholder,
  rows,
  className,
  wrapperClassName,
  mentionOptions,
  textareaRef
}: {
  value: string
  onValueChange: (value: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder: string
  rows: number
  className?: string
  wrapperClassName?: string
  mentionOptions: MentionOption[]
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}): React.JSX.Element {
  const getSuggestions = useCallback(
    (query: string) => filterGitHubMentionOptions(mentionOptions, query),
    [mentionOptions]
  )

  return (
    <MentionSuggestionTextarea
      value={value}
      onValueChange={onValueChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      rows={rows}
      className={className}
      wrapperClassName={wrapperClassName}
      textareaRef={textareaRef}
      findQuery={findMentionQuery}
      getSuggestions={getSuggestions}
      getOptionKey={(option) => option.login}
      getInsertText={(option) => `@${option.login}`}
      renderOption={(option) => (
        <>
          <GitHubUserAvatar
            login={option.login}
            name={option.name}
            avatarUrl={option.avatarUrl}
            className="size-5"
          />
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
            <span className="shrink-0 font-medium">@{option.login}</span>
            {option.name && (
              <>
                <span className="shrink-0 text-muted-foreground">|</span>
                <span className="truncate text-muted-foreground">{option.name}</span>
              </>
            )}
            <span className="shrink-0 text-muted-foreground">|</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{option.source}</span>
          </span>
        </>
      )}
    />
  )
}
