import { createContext } from 'react'
import type { ReactElement, ReactNode } from 'react'

/** Wraps a rendered file link, e.g. in a hover preview; it must render `link` itself. */
export type CommentMarkdownFileLinkWrapper = (link: ReactElement, href: string) => ReactNode

export const CommentMarkdownFileLinkWrapperContext =
  createContext<CommentMarkdownFileLinkWrapper | null>(null)
