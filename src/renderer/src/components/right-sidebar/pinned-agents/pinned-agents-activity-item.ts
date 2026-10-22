import { Pin } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { ActivityBarItem } from '../activity-bar-buttons'

export function pinnedAgentsActivityItem(): ActivityBarItem {
  return {
    id: 'pinned-agents',
    icon: Pin,
    title: translate('pinnedAgentsPanel.title', 'Pinned'),
    shortcut: ''
  }
}
