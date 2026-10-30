import type { TerminalFileContext } from '@/components/terminal-pane/terminal-file-path-mapping'

/** A terminal file link the pointer rests on, with where to anchor its preview. */
export type TerminalFileLinkPreviewRequest = {
  absolutePath: string
  line: number | null
  fileContext: TerminalFileContext
  rootPath: string
  anchorX: number
  anchorY: number
}

const SHOW_DELAY_MS = 450
const HIDE_DELAY_MS = 200

let current: TerminalFileLinkPreviewRequest | null = null
let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function publish(next: TerminalFileLinkPreviewRequest | null): void {
  current = next
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeTerminalFileLinkPreview(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTerminalFileLinkPreview(): TerminalFileLinkPreviewRequest | null {
  return current
}

/** xterm reports hover once per link entry, so a short dwell keeps passing pointers quiet. */
export function showTerminalFileLinkPreviewSoon(request: TerminalFileLinkPreviewRequest): void {
  clearTimeout(hideTimer)
  clearTimeout(showTimer)
  showTimer = setTimeout(() => publish(request), current ? 0 : SHOW_DELAY_MS)
}

/** Delayed so the pointer can cross from the link into the preview to scroll it. */
export function hideTerminalFileLinkPreviewSoon(): void {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => publish(null), HIDE_DELAY_MS)
}

export function keepTerminalFileLinkPreviewOpen(): void {
  clearTimeout(hideTimer)
}

export function hideTerminalFileLinkPreviewNow(): void {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  publish(null)
}
