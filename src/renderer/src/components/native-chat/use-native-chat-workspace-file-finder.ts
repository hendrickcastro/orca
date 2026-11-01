import { useContext, useSyncExternalStore } from 'react'
import type { WorkspaceFileFinder } from '@/components/sidebar/comment-markdown-native-chat-file-links'
import { NativeChatWorkspaceFileIndexContext } from './native-chat-workspace-file-index'

const subscribeToNothing = (): (() => void) => () => {}
const getNoFinder = (): null => null

/** The workspace finder for code spans; undefined when this chat cannot open files. */
export function useNativeChatWorkspaceFileFinder(
  enabled: boolean
): WorkspaceFileFinder | undefined {
  const fileIndex = useContext(NativeChatWorkspaceFileIndexContext)
  const active = enabled ? fileIndex : null
  return (
    useSyncExternalStore(
      active?.subscribe ?? subscribeToNothing,
      active?.getFinder ?? getNoFinder,
      active?.getFinder ?? getNoFinder
    ) ?? undefined
  )
}
