import type { PersistedState } from '../../../../shared/orca-profiles/persisted-state-types'
import type { TaskProvider } from '../../../../shared/work-items/task-providers'

const FORK_TASK_PROVIDERS: readonly TaskProvider[] = ['azure-devops', 'asana']

/** Fork-only providers appear once for profiles saved before they existed; later opt-outs stay. */
export function visibleProviders(
  settings:
    | Pick<PersistedState['settings'], 'visibleTaskProvidersDefaultedForForkProviders'>
    | undefined,
  visible: readonly TaskProvider[]
): TaskProvider[] {
  if (settings?.visibleTaskProvidersDefaultedForForkProviders === true) {
    return [...visible]
  }
  return [...visible, ...FORK_TASK_PROVIDERS.filter((provider) => !visible.includes(provider))]
}

/** A profile the fork's one-shot migrations have not stamped yet must be saved once. */
export function migrationsPending(settings: PersistedState['settings'] | undefined): boolean {
  return (
    settings?.visibleTaskProvidersDefaultedForForkProviders !== true ||
    settings?.showPinnedWorktreesInGroupsDefaultedOnForFork !== true
  )
}
