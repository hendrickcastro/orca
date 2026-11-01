import type { TaskProvider } from '../../../src/shared/task-providers'
import type { TaskProviderLogoKind } from '../components/TaskProviderLogo'

/** The desktop-only task providers the Orca knwr fork adds; the phone has no screens for them. */
const DESKTOP_ONLY_TASK_PROVIDERS: ReadonlySet<TaskProvider> = new Set(['azure-devops', 'asana'])

export function isMobileTaskProvider(provider: TaskProvider): provider is TaskProviderLogoKind {
  return !DESKTOP_ONLY_TASK_PROVIDERS.has(provider)
}

/** Why: the host's visible list includes fork providers; the phone must never select one. */
export function mobileVisibleTaskProviders(providers: readonly TaskProvider[]): TaskProvider[] {
  return providers.filter(isMobileTaskProvider)
}
