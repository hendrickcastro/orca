import { useContext } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { routeNativeChatHref } from '../../../../shared/native-chat/native-chat-href-routing'
import { CommentMarkdownFileLinkWrapperContext } from './comment-markdown-file-link-wrapper'

/** Hands a rendered markdown file link to the surrounding wrapper (hover preview), if any. */
export function DocumentFileLinkSlot({
  href,
  children
}: {
  href: string | undefined
  children: ReactElement
}): ReactNode {
  const wrapFileLink = useContext(CommentMarkdownFileLinkWrapperContext)
  return wrapFileLink && href && routeNativeChatHref(href).kind === 'file'
    ? wrapFileLink(children, href)
    : children
}
