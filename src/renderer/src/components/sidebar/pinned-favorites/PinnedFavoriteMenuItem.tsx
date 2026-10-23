import type React from 'react'
import { Star, StarOff } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { Worktree } from '../../../../../shared/worktree/types'
import { togglePinnedFavoriteId } from './pinned-favorites'

/** Context-menu entry that moves a pinned workspace into, or out of, the Favorites section. */
export function PinnedFavoriteMenuItem({
  worktree,
  disabled
}: {
  worktree: Pick<Worktree, 'id' | 'isPinned'>
  disabled: boolean
}): React.JSX.Element | null {
  const isFavorite = useAppStore(
    (s) => s.settings?.pinnedFavoriteWorkspaceIds?.includes(worktree.id) === true
  )
  const updateSettings = useAppStore((s) => s.updateSettings)
  if (!worktree.isPinned) {
    return null
  }
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => {
        const ids = useAppStore.getState().settings?.pinnedFavoriteWorkspaceIds
        void updateSettings({
          pinnedFavoriteWorkspaceIds: togglePinnedFavoriteId(ids, worktree.id)
        })
      }}
    >
      {isFavorite ? <StarOff className="size-3.5" /> : <Star className="size-3.5" />}
      {isFavorite
        ? translate('pinnedFavorites.remove', 'Remove from favorites')
        : translate('pinnedFavorites.add', 'Add to favorites')}
    </DropdownMenuItem>
  )
}
