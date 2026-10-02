/** Settings only this fork persists; kept apart so upstream edits to GlobalSettings merge cleanly. */
export type ForkGlobalSettings = {
  /** Why: one-shot guard to make the fork's Azure DevOps and Asana providers visible once. */
  visibleTaskProvidersDefaultedForForkProviders: boolean
}
