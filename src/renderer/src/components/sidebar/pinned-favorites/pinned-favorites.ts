import { Star } from 'lucide-react'
import { translate } from '@/i18n/i18n'

export const PINNED_FAVORITES_GROUP_META = {
  get label() {
    return translate('pinnedFavorites.section', 'Favorites')
  },
  tone: 'text-foreground',
  icon: Star
} as const

export function togglePinnedFavoriteId(ids: readonly string[] | undefined, id: string): string[] {
  const current = ids ?? []
  return current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]
}
