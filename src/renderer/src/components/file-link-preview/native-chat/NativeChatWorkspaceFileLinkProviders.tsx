import { useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  CommentMarkdownFileLinkWrapperContext,
  type CommentMarkdownFileLinkWrapper
} from '../comment-markdown-file-link-wrapper'
import { NativeChatFileLinkHoverPreview } from './NativeChatFileLinkHoverPreview'
import {
  createNativeChatWorkspaceFileIndex,
  NativeChatWorkspaceFileIndexContext
} from './native-chat-workspace-file-index'

type WorkspaceFileLinkTarget = {
  worktreeId: string | undefined
  worktreePath: string | undefined
  runtimeEnvironmentId: string | null
}

/** Chat file links by name (workspace file index) and their hover preview. */
export function NativeChatWorkspaceFileLinkProviders({
  worktreeId,
  worktreePath,
  runtimeEnvironmentId,
  children
}: WorkspaceFileLinkTarget & { children: ReactNode }): React.JSX.Element {
  const fileIndex = useMemo(
    () =>
      worktreeId && worktreePath
        ? createNativeChatWorkspaceFileIndex({ worktreeId, worktreePath, runtimeEnvironmentId })
        : null,
    [runtimeEnvironmentId, worktreeId, worktreePath]
  )
  const wrapFileLink = useMemo<CommentMarkdownFileLinkWrapper | null>(
    () =>
      worktreeId && worktreePath
        ? (link, href) => (
            <NativeChatFileLinkHoverPreview
              link={link}
              href={href}
              context={{ worktreeId, worktreePath, runtimeEnvironmentId }}
            />
          )
        : null,
    [runtimeEnvironmentId, worktreeId, worktreePath]
  )
  return (
    <NativeChatWorkspaceFileIndexContext.Provider value={fileIndex}>
      <CommentMarkdownFileLinkWrapperContext.Provider value={wrapFileLink}>
        {children}
      </CommentMarkdownFileLinkWrapperContext.Provider>
    </NativeChatWorkspaceFileIndexContext.Provider>
  )
}

/** The agent may have added files during its turn: look names up again once it ends. */
export function useRefreshNativeChatWorkspaceFileIndexWhenTurnEnds(isWorking: boolean): void {
  const fileIndex = useContext(NativeChatWorkspaceFileIndexContext)
  const wasWorking = useRef(isWorking)
  useEffect(() => {
    const ended = wasWorking.current && !isWorking
    wasWorking.current = isWorking
    if (ended) {
      fileIndex?.refresh()
    }
  }, [fileIndex, isWorking])
}
