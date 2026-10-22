// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PinnedAgentsPanelModel } from './use-pinned-agents-panel'
import type { PinnedWorkspaceEntry } from './pinned-workspaces-catalog'

const task: PinnedWorkspaceEntry = {
  id: 'folder:fw-task',
  kind: 'folder',
  name: 'Checkout task',
  projectName: 'Checkout',
  path: '/tmp/orca-feature',
  hostId: null,
  members: []
}
const member: PinnedWorkspaceEntry = {
  id: 'wt-member',
  kind: 'worktree',
  name: 'checkout (orca)',
  projectName: 'orca',
  path: '/tmp/orca-feature',
  hostId: null,
  members: []
}
task.members = [member]
const pinnedWorktree: PinnedWorkspaceEntry = {
  id: 'wt-pinned',
  kind: 'worktree',
  name: 'pinned',
  projectName: 'api',
  path: '/tmp/api-pinned',
  hostId: null,
  members: []
}

let model: PinnedAgentsPanelModel

// Why: the panel reads one store action; a stub keeps the test off the real app store.
vi.mock('@/store', () => ({
  useAppStore: (select: (state: { setActiveView: () => void }) => unknown) =>
    select({ setActiveView: () => undefined })
}))
vi.mock('./use-pinned-agents-panel', () => ({
  usePinnedAgentsPanel: () => model
}))
vi.mock('./PinnedAgentsWorkspaceCard', () => ({
  PinnedAgentsWorkspaceCard: ({ item }: { item: { entry: PinnedWorkspaceEntry } }) => (
    <div data-testid="card">{item.entry.name}</div>
  )
}))

async function mountPanel(): Promise<{ container: HTMLDivElement; root: Root }> {
  const { default: PinnedAgentsPanel } = await import('./PinnedAgentsPanel')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <TooltipProvider>
        <PinnedAgentsPanel />
      </TooltipProvider>
    )
  })
  return { container, root }
}

let mounted: { container: HTMLDivElement; root: Root } | null = null

describe('PinnedAgentsPanel', () => {
  beforeEach(() => {
    model = {
      catalog: [task, pinnedWorktree],
      items: [
        { entry: task, parent: null },
        { entry: member, parent: task },
        { entry: pinnedWorktree, parent: null }
      ],
      shownIds: new Set([task.id, member.id, pinnedWorktree.id]),
      toggle: vi.fn(),
      remove: vi.fn(),
      move: vi.fn()
    }
  })

  afterEach(async () => {
    if (mounted) {
      await act(async () => mounted?.root.unmount())
      mounted.container.remove()
      mounted = null
    }
  })

  it('renders one card per chosen workspace, in the stored order', async () => {
    mounted = await mountPanel()
    const cards = [...mounted.container.querySelectorAll('[data-testid="card"]')]
    expect(cards.map((card) => card.textContent)).toEqual([
      'Checkout task',
      'checkout (orca)',
      'pinned'
    ])
  })

  it('explains how to drop something when nothing is listed', async () => {
    model = { ...model, catalog: [], items: [], shownIds: new Set() }
    mounted = await mountPanel()
    expect(mounted.container.textContent).toContain('Nothing here yet')
    expect(mounted.container.querySelector('[data-testid="card"]')).toBeNull()
  })

  it('asks the user to choose when every pinned workspace was deselected', async () => {
    model = { ...model, items: [], shownIds: new Set() }
    mounted = await mountPanel()
    expect(mounted.container.textContent).toContain('Nothing selected')
  })

  it('lists tasks with their members in the picker and toggles a row', async () => {
    mounted = await mountPanel()
    const chooseButton = mounted.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Choose pinned workspaces"]'
    )
    expect(chooseButton).not.toBeNull()
    await act(async () => {
      chooseButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const memberCheckbox = document.getElementById(`pinned-agents-pick-${member.id}`)
    expect(memberCheckbox).not.toBeNull()
    expect(memberCheckbox?.getAttribute('aria-checked')).toBe('true')
    await act(async () => {
      memberCheckbox?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(model.toggle).toHaveBeenCalledWith(member.id)
  })
})
