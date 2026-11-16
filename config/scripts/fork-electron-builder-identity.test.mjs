import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const configPath = require.resolve('../electron-builder.config.cjs')
const ENV_KEYS = ['ORCA_FORK_UPSTREAM_IDENTITY', 'ORCA_MAC_HOURLY', 'ORCA_HOURLY_BUILD_VERSION']
let savedEnv

function loadForkConfig(env = {}) {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
  Object.assign(process.env, env)
  delete require.cache[configPath]
  return require(configPath)
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
})

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  delete require.cache[configPath]
})

describe('fork electron-builder identity', () => {
  it('packages Orca knwr apart from upstream Orca', () => {
    const config = loadForkConfig()

    expect(config.appId).toBe('com.knwr.orca')
    expect(config.productName).toBe('Orca knwr')
    expect(config.protocols).toEqual([{ name: 'Orca knwr', schemes: ['orca-knwr'] }])
    expect(config.extraMetadata).toEqual({ name: 'orca-knwr' })
    expect(config.win.executableName).toBe('OrcaKnwr')
    expect(config.win.signtoolOptions.publisherName).toBeUndefined()
    expect(config.win.verifyUpdateCodeSignature).toBe(false)
    expect(config.win.extraResources.map((resource) => resource.to)).toEqual(
      expect.arrayContaining(['bin/orca.exe', 'bin/orca-knwr.exe'])
    )
    expect(config.nsis.artifactName).toBe('orca-knwr-windows-setup.${ext}')
    expect(config.mac.artifactName).toBe('orca-knwr-macos-${arch}.${ext}')
    expect(config.dmg.artifactName).toBe('orca-knwr-macos-${arch}.${ext}')
    expect(config.publish).toMatchObject({ owner: 'hendrickcastro', repo: 'orca' })
  })

  it('keeps the channel build version next to the fork package name', () => {
    const config = loadForkConfig({
      ORCA_MAC_HOURLY: '1',
      ORCA_HOURLY_BUILD_VERSION: '1.4.160-hourly.202607281400'
    })

    expect(config.extraMetadata).toEqual({
      name: 'orca-knwr',
      version: '1.4.160-hourly.202607281400'
    })
  })
})
