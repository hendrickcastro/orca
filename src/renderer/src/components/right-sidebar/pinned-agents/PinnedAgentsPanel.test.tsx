// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PinnedWorkspaceEntry } from './pinned-workspaces-catalog'
import type * as PinnedLiveAgentsModule from './pinned-live-agents'

function entry(
  id: string,
  name: string,
  members: PinnedWorkspaceEntry[] = []
): PinnedWorkspaceEntry {
  return {
    id,
    kind: 'worktree',
    name,
    projectName: 'orca',
    path: `/tmp/${id}`,
    hostId: null,
    members
  }
}

const busyRepo = entry('wt-busy', 'busy repo')
const idleRepo = entry('wt-idle', 'idle repo')
const task = { ...entry('folder:task', 'Checkout task', [busyRepo]), kind: 'folder' as const }

let catalog: PinnedWorkspaceEntry[] = []
const liveRowsById: Record<string, unknown[]> = { 'wt-busy': [{ paneKey: 'tab:leaf' }] }

vi.mock('@/store', () => ({
  useAppStore: (select: (state: { setActiveView: () => void }) => unknown) =>
    select({ setActiveView: () => undefined })
}))
vi.mock('@/lib/workspace/activation/worktree-activation', () => ({
  activateAndRevealWorktree: () => undefined
}))
vi.mock('./use-pinned-agents-panel', () => ({
  usePinnedAgentsPanel: () => ({ catalog })
}))
vi.mock('./pinned-live-agents', async (importOriginal) => ({
  ...(await importOriginal<typeof PinnedLiveAgentsModule>()),
  usePinnedLiveAgentRows: (id: string) => liveRowsById[id] ?? []
}))
vi.mock('./PinnedAgentsWorkspaceCard', () => ({
  PinnedAgentsWorkspaceCard: ({ item }: { item: { entry: PinnedWorkspaceEntry } }) => (
    <div data-testid="card">{item.entry.name}</div>
  )
}))

let mounted: { container: HTMLDivElement; root: Root } | null = null

async function mountPanel(): Promise<HTMLDivElement> {
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
  mounted = { container, root }
  return container
}

afterEach(async () => {
  if (mounted) {
    await act(async () => mounted?.root.unmount())
    mounted.container.remove()
    mounted = null
  }
})

describe('PinnedAgentsPanel', () => {
  it('shows a card only for pinned workspaces with live agents and a chip for the rest', async () => {
    catalog = [task, idleRepo]
    const container = await mountPanel()
    const cards = [...container.querySelectorAll('[data-testid="card"]')].map(
      (card) => card.textContent
    )
    expect(cards).toEqual(['busy repo'])
    const chips = [...container.querySelectorAll('button[title]')].map((chip) => chip.textContent)
    expect(chips).toEqual(['Checkout task', 'idle repo'])
  })

  it('explains how to fill it when nothing is pinned', async () => {
    catalog = []
    const container = await mountPanel()
    expect(container.textContent).toContain('Nothing pinned yet')
    expect(container.querySelector('[data-testid="card"]')).toBeNull()
  })
})
