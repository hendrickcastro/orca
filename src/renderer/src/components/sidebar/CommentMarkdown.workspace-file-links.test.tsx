// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routeNativeChatHref } from '../../../../shared/native-chat-href-routing'
import { createWorkspaceFileFinder } from '@/components/native-chat/native-chat-workspace-file-index'
import CommentMarkdown from './CommentMarkdown'

afterEach(cleanup)

const findWorkspaceFile = createWorkspaceFileFinder([
  'src/renderer/WorktreeCard.tsx',
  'src/renderer/grouping/rows.ts',
  'src/main/rows.ts',
  'Makefile',
  'AGENTS.md',
  'docs/AGENTS.md'
])

function linkedFiles(content: string): { text: string | null; route: unknown }[] {
  const { container } = render(
    <CommentMarkdown
      variant="document"
      content={content}
      onLinkClick={vi.fn()}
      fileLinkExists={() => false}
      findWorkspaceFile={findWorkspaceFile}
    />
  )
  return Array.from(container.querySelectorAll('a')).map((anchor) => ({
    text: anchor.textContent,
    route: routeNativeChatHref(anchor.getAttribute('href') ?? undefined)
  }))
}

describe('CommentMarkdown workspace file links', () => {
  it('links a code span naming one workspace file by name or partial path', () => {
    expect(linkedFiles('See `WorktreeCard.tsx`, `grouping/rows.ts:12` and `Makefile`.')).toEqual([
      {
        text: 'WorktreeCard.tsx',
        route: {
          kind: 'file',
          pathText: 'src/renderer/WorktreeCard.tsx',
          line: null
        }
      },
      {
        text: 'grouping/rows.ts:12',
        route: {
          kind: 'file',
          pathText: 'src/renderer/grouping/rows.ts:12',
          line: null
        }
      },
      {
        text: 'Makefile',
        route: { kind: 'file', pathText: 'Makefile', line: null }
      }
    ])
  })

  it('leaves ambiguous names, prose and unknown names unlinked', () => {
    expect(linkedFiles('Edit `rows.ts`, WorktreeCard.tsx and `Missing.tsx`.')).toEqual([])
  })
})

describe('createWorkspaceFileFinder', () => {
  it('refuses rooted, spaced and directory paths', () => {
    expect(findWorkspaceFile('/src/main/rows.ts')).toBeNull()
    expect(findWorkspaceFile('../rows.ts')).toBeNull()
    expect(findWorkspaceFile('git log')).toBeNull()
    expect(findWorkspaceFile('src/')).toBeNull()
    expect(findWorkspaceFile('./main/rows.ts')).toBe('src/main/rows.ts')
  })

  it('prefers the workspace root over same-named files below it', () => {
    expect(findWorkspaceFile('AGENTS.md')).toBe('AGENTS.md')
    expect(findWorkspaceFile('docs/AGENTS.md')).toBe('docs/AGENTS.md')
  })
})
