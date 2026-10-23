#!/usr/bin/env node
// Runs `pnpm dev` on the installed Orca knwr profile so development shows the real workspaces,
// sessions and running agents. The installed app must be closed first: one profile takes one
// Orca at a time, and a second launch only hands its request to the running instance.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require = createRequire(import.meta.url)
const { PRODUCT_PACKAGE_NAME } = require('../product-identity.cjs')

function installedProfilePath() {
  if (process.platform === 'darwin') {
    return path.join(process.env.HOME ?? '', 'Library', 'Application Support', PRODUCT_PACKAGE_NAME)
  }
  if (process.platform === 'win32') {
    const appData =
      process.env.APPDATA ?? path.join(process.env.USERPROFILE ?? '', 'AppData', 'Roaming')
    return path.join(appData, PRODUCT_PACKAGE_NAME)
  }
  const config = process.env.XDG_CONFIG_HOME ?? path.join(process.env.HOME ?? '', '.config')
  return path.join(config, PRODUCT_PACKAGE_NAME)
}

const profile = installedProfilePath()
console.log(`[dev:installed] Using the installed profile at ${profile}`)
console.log(
  '[dev:installed] Close the installed Orca knwr first; this dev build reattaches to its terminals.'
)

const child = spawn(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['dev', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    // Why shell on Windows: pnpm is a .cmd shim, which Node only starts through a shell.
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ORCA_DEV_USER_DATA_PATH: profile,
      // Why: keeps the installed profile's terminal daemon (and its agents) alive when dev exits.
      ORCA_DEV_SHARED_PROFILE: '1'
    }
  }
)
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0))
})
