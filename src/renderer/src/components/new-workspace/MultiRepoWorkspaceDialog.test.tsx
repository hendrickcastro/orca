// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import { fixture, repo } from '@/lib/multi-repo-workspace-test-fixtures'

const mocks = vi.hoisted(() => {
  const repos: Repo[] = []
  return { launch: vi.fn(async () => {}), repos }
})
vi.mock('@/lib/multi-repo-coordinator-launch', () => ({ launchMultiRepoCoordinator: mocks.launch }))
vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (select: (state: { repos: Repo[] }) => unknown) => select({ repos: mocks.repos }),
    { getState: () => ({ settings: null }) }
  )
}))

import MultiRepoWorkspaceDialog from './MultiRepoWorkspaceDialog'

let root: Root
let api: ReturnType<typeof fixture>
const close = vi.fn()

beforeEach(() => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.repos = [repo('front', 'D:\\Front'), repo('back', 'E:\\Back')]
  mocks.launch.mockClear()
  close.mockClear()
  api = fixture()
  Object.defineProperty(window, 'api', { value: api, configurable: true })
})
afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

function button(label: string): HTMLButtonElement {
  const found = Array.from(document.body.querySelectorAll('button')).find((entry) =>
    entry.textContent?.includes(label)
  )
  if (!found) {
    throw new Error(`Missing button: ${label}`)
  }
  return found
}

function fill(id: string, value: string): void {
  const input = document.getElementById(id)
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
    throw new Error(`Missing input: ${id}`)
  }
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  act(() => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function renderFilled(): void {
  act(() => root.render(<MultiRepoWorkspaceDialog onClose={close} />))
  fill('multi-repo-name', 'Search')
  fill('multi-repo-branch', 'feature/search')
  fill('multi-repo-prompt', 'Implement UI and API')
}

describe('multi-repository feature dialog', () => {
  it('requires a feature name, branch, prompt and two eligible repositories', () => {
    act(() => root.render(<MultiRepoWorkspaceDialog onClose={close} />))
    expect(button('Create and start Claude').disabled).toBe(true)
    fill('multi-repo-name', 'Search')
    fill('multi-repo-branch', 'feature/search')
    expect(button('Create and start Claude').disabled).toBe(true)
    fill('multi-repo-prompt', 'Implement UI and API')
    expect(button('Create and start Claude').disabled).toBe(false)
  })

  it('does not count a remote repository toward the minimum selection', () => {
    mocks.repos[1] = { ...mocks.repos[1], connectionId: 'server' }
    renderFilled()
    expect(button('Create and start Claude').disabled).toBe(true)
  })

  it('starts the coordinator only after every worktree succeeds', async () => {
    renderFilled()
    await act(async () => button('Create and start Claude').click())
    expect(api.worktrees.create).toHaveBeenCalledTimes(2)
    expect(mocks.launch).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('shows a creation failure and retries without launching early or duplicating work', async () => {
    api.worktrees.create.mockRejectedValueOnce(new Error('Git unavailable'))
    renderFilled()
    await act(async () => button('Create and start Claude').click())
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Git unavailable')
    expect(mocks.launch).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    await act(async () => button('Retry remaining steps').click())
    expect(api.projectGroups.create).toHaveBeenCalledTimes(1)
    expect(api.worktrees.create).toHaveBeenCalledTimes(3)
    expect(mocks.launch).toHaveBeenCalledTimes(1)
  })
})
