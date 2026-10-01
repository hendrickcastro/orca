import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getSecretStore } from '../../shared/secret-store'
import { PRODUCT_HOME_STATE_DIR_NAME } from '../../shared/product-identity'

const ASANA_TOKEN_FILE = 'asana-token.enc'
let cachedToken: string | null = null

function tokenPath(): string {
  return join(homedir(), PRODUCT_HOME_STATE_DIR_NAME, ASANA_TOKEN_FILE)
}

export function hasAsanaToken(): boolean {
  // Why: existence check avoids a decrypt (and a macOS Keychain prompt) on status probes.
  return existsSync(tokenPath())
}

export function saveAsanaToken(token: string): void {
  const trimmed = token.trim()
  if (!trimmed) {
    throw new Error('Asana personal access token is required')
  }
  mkdirSync(join(homedir(), PRODUCT_HOME_STATE_DIR_NAME), { recursive: true })
  const store = getSecretStore()
  if (store.isEncryptionAvailable()) {
    writeFileSync(tokenPath(), store.encryptString(trimmed), { mode: 0o600 })
  } else {
    console.warn('[asana] secret encryption unavailable — storing Asana token in plaintext')
    writeFileSync(tokenPath(), trimmed, { encoding: 'utf8', mode: 0o600 })
  }
  cachedToken = trimmed
}

export function readAsanaToken(): string | null {
  if (cachedToken !== null) {
    return cachedToken
  }
  if (!hasAsanaToken()) {
    return null
  }
  try {
    const raw = readFileSync(tokenPath())
    const store = getSecretStore()
    cachedToken = store.isEncryptionAvailable() ? store.decryptString(raw) : raw.toString('utf8')
    return cachedToken
  } catch {
    return null
  }
}

export function clearAsanaToken(): void {
  cachedToken = null
  rmSync(tokenPath(), { force: true })
}
