/** Task providers only the Orca knwr fork ships; kept here so task-providers.ts carries one-line hooks. */
export const FORK_TASK_PROVIDERS = ['azure-devops', 'asana'] as const

export type ForkTaskProvider = (typeof FORK_TASK_PROVIDERS)[number]

export function isForkTaskProvider(provider: string): provider is ForkTaskProvider {
  return provider === 'azure-devops' || provider === 'asana'
}
