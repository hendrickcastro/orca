// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { MultiRepoReference } from '@/lib/multi-repo-prompt-references'
import { REPO_REFERENCE_CHIP_PAGE, RepoReferenceChips } from './RepoReferenceChips'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string, values?: Record<string, unknown>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? ''))
}))

function skills(count: number): MultiRepoReference[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'skill',
    scope: { kind: 'repo', repoId: 'api', repoName: 'api' },
    name: `step-${String(index).padStart(2, '0')}`,
    token: `@skill:api/step-${index}`
  }))
}

describe('RepoReferenceChips', () => {
  it('shows a page of chips and loads the rest on demand', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() =>
      root.render(
        <RepoReferenceChips references={skills(45)} showRepoName={false} onPick={vi.fn()} />
      )
    )

    const chipCount = (): number =>
      Array.from(container.querySelectorAll('button')).filter((button) =>
        button.textContent?.startsWith('step-')
      ).length
    const showMore = (): HTMLButtonElement | undefined =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.startsWith('Show')
      )

    expect(chipCount()).toBe(REPO_REFERENCE_CHIP_PAGE)
    expect(showMore()?.textContent).toBe('Show 20 more (25 left)')
    act(() => showMore()?.click())
    expect(chipCount()).toBe(40)
    expect(showMore()?.textContent).toBe('Show 5 more (5 left)')
    act(() => showMore()?.click())
    expect(chipCount()).toBe(45)
    expect(showMore()).toBeUndefined()
    act(() => root.unmount())
  })
})
