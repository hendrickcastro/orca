/** Settings only this fork persists; kept apart so upstream edits to GlobalSettings merge cleanly. */
export type ForkGlobalSettings = {
  /** Why: one-shot guard to make the fork's Azure DevOps and Asana providers visible once. */
  visibleTaskProvidersDefaultedForForkProviders: boolean
  /** Why: one-shot guard so pinning acts as a shortcut (stays in its project) on profiles saved before the fork default. */
  showPinnedWorktreesInGroupsDefaultedOnForFork?: boolean
  /** The pinned workspaces the Pinned agents panel and view follow, in their order. */
  pinnedAgentsPanelWorkspaceIds?: string[]
  /** Pinned workspaces shown in the sidebar's Favorites section instead of Pinned. */
  pinnedFavoriteWorkspaceIds?: string[]
  /** Centre Pinned agents grid: a PinnedAgentsWorkbenchArrangement id; absent lets panes flow. */
  pinnedAgentsWorkbenchArrangement?: string
  /** Centre Pinned agents grid: 'compact' | 'normal' | 'tall' pane height. */
  pinnedAgentsWorkbenchRowHeight?: string
}
