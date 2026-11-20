import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { useTranslate } from '@/i18n/use-translate'
import type { BookConversation } from '../../../../shared/fork-book/book-catalog-types'
import { bookConversationKey } from '../../../../shared/fork-book/book-catalog-operations'
import type { BookConversationCandidate } from './book-conversations'

const WORKSPACE_ONLY_VALUE = '__workspace__'

function conversationLabel(conversation: BookConversation, lastActiveAt?: number): string {
  const kind = conversation.chatSessionId
    ? translate('forkBook.conversationChat', 'chat')
    : translate('forkBook.conversationTerminal', 'terminal')
  const when = lastActiveAt
    ? ` · ${new Date(lastActiveAt).toLocaleString(getIntlLocale(), { dateStyle: 'short', timeStyle: 'short' })}`
    : ''
  return `${conversation.title ?? conversation.agent} · ${conversation.agent} ${kind}${when}`
}

/** Picks which conversation "Open agent" returns to; the saved one stays listed after it closes. */
export function BookConversationPicker({
  candidates,
  value,
  onChange
}: {
  candidates: BookConversationCandidate[]
  value: BookConversation | undefined
  onChange: (conversation: BookConversation | undefined) => void
}): React.JSX.Element | null {
  const t = useTranslate()
  const options = candidates.map((candidate) => candidate.conversation)
  const activeAt = new Map(
    candidates.map((candidate) => [
      bookConversationKey(candidate.conversation),
      candidate.lastActiveAt
    ])
  )
  const valueKey = bookConversationKey(value)
  if (value && !options.some((option) => bookConversationKey(option) === valueKey)) {
    options.unshift(value)
  }
  if (options.length === 0) {
    return null
  }
  return (
    <div className="space-y-1.5">
      <Label>{t('forkBook.fieldConversation', 'Conversation')}</Label>
      <Select
        value={valueKey || WORKSPACE_ONLY_VALUE}
        onValueChange={(key) => {
          // Radix reports an empty value while the picked item is still mounting; ignore it.
          if (key) {
            onChange(options.find((option) => bookConversationKey(option) === key))
          }
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={bookConversationKey(option)} value={bookConversationKey(option)}>
              {conversationLabel(option, activeAt.get(bookConversationKey(option)))}
            </SelectItem>
          ))}
          <SelectItem value={WORKSPACE_ONLY_VALUE}>
            {t('forkBook.workspaceOnly', 'Only the workspace')}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
