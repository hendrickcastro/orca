import { useMemo } from 'react'
import { Star } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { getPinnedFavoriteIds } from '../../../../../shared/sidebar-list/pinned-favorites'

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

/** The Favorites ids as a stable set while the setting itself is unchanged. */
export function usePinnedFavoriteIds(
  settings: { pinnedFavoriteWorkspaceIds?: readonly string[] } | null | undefined
): ReadonlySet<string> {
  const ids = settings?.pinnedFavoriteWorkspaceIds
  return useMemo(() => getPinnedFavoriteIds({ pinnedFavoriteWorkspaceIds: ids }), [ids])
}
