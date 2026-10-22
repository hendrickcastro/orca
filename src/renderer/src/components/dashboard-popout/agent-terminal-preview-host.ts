import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

/** How the surface hosting an AgentTerminalPreview wants it to behave. */
export type Host = {
  /** Inside another surface: never claim the PTY grid (the frame scales instead) and never steal focus. */
  embedded?: boolean
  /** False keeps keyboard focus where it is after each replay; several panes on one page must not fight for it. */
  autoFocus?: boolean
  /** This preview's own font size; null follows the terminal setting. */
  fontSize?: number | null
}

export const DEFAULTS: Host = {}

type HostState = Host & {
  /** Set while the terminal is torn down with focus inside, so the rebuilt one takes it back. */
  restoreFocus: boolean
}

/**
 * The host options as a ref the preview's long-lived effect can read, plus the settings it
 * builds its terminal from: the store's, with the host's own font size folded in so every
 * option builder sees one object.
 */
export function useHost(
  host: Host,
  storeSettings: GlobalSettings | null
): { settings: GlobalSettings | null; hostRef: RefObject<HostState> } {
  const hostRef = useRef<HostState>({ ...host, restoreFocus: false })
  // Why layout: xterm's keydown is a native listener, so a passive effect could miss the next keystroke.
  useLayoutEffect(() => {
    hostRef.current = { ...host, restoreFocus: hostRef.current.restoreFocus }
  }, [host])
  const fontSize = host.fontSize ?? null
  const settings = useMemo(
    () =>
      fontSize !== null && storeSettings
        ? { ...storeSettings, terminalFontSize: fontSize }
        : storeSettings,
    [storeSettings, fontSize]
  )
  return { settings, hostRef }
}

/** An embedded preview never resizes the real PTY; the frame scales to its box instead. */
export function scheduleGridClaim(
  hostRef: RefObject<HostState>,
  gridClaim: { schedule: () => void }
): void {
  if (!hostRef.current.embedded) {
    gridClaim.schedule()
  }
}

/** Box growth or shrink (a window resize) changes both the scaled fit and the reachable grid. */
export function observeResize(
  hostRef: RefObject<HostState>,
  boxFit: { schedule: () => void },
  gridClaim: { schedule: () => void }
): void {
  boxFit.schedule()
  scheduleGridClaim(hostRef, gridClaim)
}

/** After a replay: refit the box, claim the grid unless embedded, and focus when the host wants it or the rebuild took it. */
export function settleReplay(
  hostRef: RefObject<HostState>,
  fit: { boxFit: { schedule: () => void }; gridClaim: { schedule: () => void } },
  terminal: Terminal
): void {
  const host = hostRef.current
  fit.boxFit.schedule()
  scheduleGridClaim(hostRef, fit.gridClaim)
  if ((!host.embedded && host.autoFocus !== false) || host.restoreFocus) {
    terminal.focus()
  }
  host.restoreFocus = false
}

/** Called as the terminal is torn down: remember whether the keyboard was inside it. */
export function rememberFocus(hostRef: RefObject<HostState>, container: HTMLElement): void {
  hostRef.current.restoreFocus = container.contains(document.activeElement)
}
