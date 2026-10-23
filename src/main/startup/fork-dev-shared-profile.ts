/** Set by `pnpm dev:installed` when the dev build runs on the installed app's profile. */
export const DEV_SHARED_PROFILE_ENV = 'ORCA_DEV_SHARED_PROFILE'

/**
 * Why: a dead dev parent normally shuts the profile's terminal daemon down, because a dev profile
 * has no other owner. On the installed app's profile the daemon hosts the user's running agents
 * and the installed app reattaches to it, so the dev build must only disconnect.
 */
export function mayShutDownDaemonForDevParent(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[DEV_SHARED_PROFILE_ENV] !== '1'
}
