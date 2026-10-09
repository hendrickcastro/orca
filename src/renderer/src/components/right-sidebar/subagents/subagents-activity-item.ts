import { Bot } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { ActivityBarItem } from '../activity-bar-buttons'

export function subagentsActivityItem(): ActivityBarItem {
  return {
    id: 'subagents',
    icon: Bot,
    title: translate('subagentsPanel.title', 'Subagents'),
    shortcut: ''
  }
}
