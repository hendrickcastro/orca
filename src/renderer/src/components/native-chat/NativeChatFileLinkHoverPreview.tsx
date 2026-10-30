import { useMemo, type ReactElement } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { getTerminalFileContext } from '@/components/terminal-pane/terminal-file-path-mapping'
import {
  FileLinkPreviewBody,
  fileLinkOpenHint
} from '@/components/file-link-preview/FileLinkPreviewBody'
import { useAppStore } from '@/store'
import { nativeChatPlainLinkClickBehavior } from './native-chat-link-click-behavior'
import { resolveNativeChatFileLink, type NativeChatFileLinkContext } from './native-chat-file-link'

function NativeChatFilePreviewBody({
  href,
  context
}: {
  href: string
  context: NativeChatFileLinkContext
}): React.JSX.Element {
  const target = resolveNativeChatFileLink(href, context)
  const { worktreeId, worktreePath, runtimeEnvironmentId } = context
  const fileContext = useMemo(
    () => getTerminalFileContext(worktreeId, worktreePath, runtimeEnvironmentId),
    [runtimeEnvironmentId, worktreeId, worktreePath]
  )
  // Why: the plain click may offer a menu instead, so name the click that opens outright.
  const opensOnPlainClick = useAppStore(
    (s) => nativeChatPlainLinkClickBehavior(s.settings) === 'open'
  )
  return (
    <FileLinkPreviewBody
      absolutePath={target?.absolutePath ?? null}
      line={target?.line ?? null}
      fileContext={fileContext}
      rootPath={worktreePath}
      fallbackLabel={href}
      openHint={fileLinkOpenHint(opensOnPlainClick)}
    />
  )
}

/** Shows a file's lines while the pointer rests on a link to it; the link keeps its click. */
export function NativeChatFileLinkHoverPreview({
  link,
  href,
  context
}: {
  link: ReactElement
  href: string
  context: NativeChatFileLinkContext
}): React.JSX.Element {
  return (
    <HoverCard openDelay={400} closeDelay={150}>
      <HoverCardTrigger asChild>{link}</HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-[560px] max-w-[calc(100vw-2rem)]">
        <NativeChatFilePreviewBody href={href} context={context} />
      </HoverCardContent>
    </HoverCard>
  )
}
