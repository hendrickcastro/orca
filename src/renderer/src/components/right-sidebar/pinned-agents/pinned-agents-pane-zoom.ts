import { useEffect, useState, type RefObject } from 'react'

export type PinnedAgentsPaneZoomDirection = 'in' | 'out' | 'reset'

/** Marks the element whose focused terminal owns Cmd/Ctrl +/-: the pane, not the whole window. */
export const PINNED_AGENTS_ZOOM_SCOPE_ATTR = 'data-pinned-agents-zoom-scope'
const ZOOM_EVENT = 'orca:pinned-agents-pane-zoom'
const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 40
const STEP = 1

/** The next font size for one pane; null means back to the terminal setting. */
export function stepPinnedAgentsPaneFontSize(
  current: number | null,
  base: number,
  direction: PinnedAgentsPaneZoomDirection
): number | null {
  if (direction === 'reset') {
    return null
  }
  const from = current ?? base
  const next = Math.min(
    MAX_FONT_SIZE,
    Math.max(MIN_FONT_SIZE, from + (direction === 'in' ? STEP : -STEP))
  )
  return next === base ? null : next
}

/**
 * Routes a zoom request to the pane whose terminal has focus. True when one took it, so the
 * window-wide zoom must stay out of it.
 */
export function dispatchPinnedAgentsPaneZoom(direction: PinnedAgentsPaneZoomDirection): boolean {
  if (typeof document === 'undefined') {
    return false
  }
  return dispatchToZoomScope(
    document.activeElement,
    new CustomEvent(ZOOM_EVENT, { detail: { direction } })
  )
}

// Why duck-typed: zoom routing tests run without DOM globals such as Element.
function dispatchToZoomScope(element: unknown, event: Event): boolean {
  if (
    typeof element !== 'object' ||
    element === null ||
    !('closest' in element) ||
    typeof element.closest !== 'function'
  ) {
    return false
  }
  const scope: unknown = element.closest(`[${PINNED_AGENTS_ZOOM_SCOPE_ATTR}]`)
  if (
    typeof scope !== 'object' ||
    scope === null ||
    !('dispatchEvent' in scope) ||
    typeof scope.dispatchEvent !== 'function'
  ) {
    return false
  }
  scope.dispatchEvent(event)
  return true
}

function zoomDirectionOf(detail: unknown): PinnedAgentsPaneZoomDirection | null {
  const direction =
    typeof detail === 'object' && detail !== null && 'direction' in detail ? detail.direction : null
  return direction === 'in' || direction === 'out' || direction === 'reset' ? direction : null
}

/** The zoom a keydown asks for: Cmd (macOS) or Ctrl with +, -, 0 and their numpad keys. */
export function zoomDirectionForKeydown(
  event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>,
  isMac: boolean
): PinnedAgentsPaneZoomDirection | null {
  const primary = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
  if (!primary || event.altKey) {
    return null
  }
  if (event.key === '=' || event.key === '+' || event.code === 'NumpadAdd') {
    return 'in'
  }
  if (event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract') {
    return 'out'
  }
  if (event.key === '0' || event.code === 'Numpad0') {
    return 'reset'
  }
  return null
}

/**
 * Per-pane font size for the terminal inside `scopeRef`. The chord is taken on the pane itself
 * (before xterm forwards it to the shell) and also from the window's zoom route, which covers
 * the menu and the host-side shortcut policy; Cmd/Ctrl + wheel over the pane zooms too.
 */
export function usePinnedAgentsPaneZoom(
  scopeRef: RefObject<HTMLElement | null>,
  baseFontSize: number
): { fontSize: number | null; percent: number | null } {
  const [fontSize, setFontSize] = useState<number | null>(null)
  useEffect(() => {
    const scope = scopeRef.current
    if (!scope) {
      return
    }
    const handleZoom = (event: Event): void => {
      const direction = event instanceof CustomEvent ? zoomDirectionOf(event.detail) : null
      if (direction) {
        setFontSize((current) => stepPinnedAgentsPaneFontSize(current, baseFontSize, direction))
      }
    }
    const handleWheel = (event: WheelEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      setFontSize((current) =>
        stepPinnedAgentsPaneFontSize(current, baseFontSize, event.deltaY < 0 ? 'in' : 'out')
      )
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      const direction = zoomDirectionForKeydown(event, navigator.userAgent.includes('Mac'))
      if (!direction) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      setFontSize((current) => stepPinnedAgentsPaneFontSize(current, baseFontSize, direction))
    }
    scope.addEventListener(ZOOM_EVENT, handleZoom)
    scope.addEventListener('keydown', handleKeyDown, true)
    scope.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      scope.removeEventListener(ZOOM_EVENT, handleZoom)
      scope.removeEventListener('keydown', handleKeyDown, true)
      scope.removeEventListener('wheel', handleWheel)
    }
  }, [scopeRef, baseFontSize])
  return {
    fontSize,
    percent: fontSize === null ? null : Math.round((fontSize / baseFontSize) * 100)
  }
}
