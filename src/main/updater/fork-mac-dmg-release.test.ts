import { describe, expect, it, vi } from 'vitest'
import { parseForkMacDmgRelease, resolveReplaceableAppBundle } from './fork-mac-dmg-release'

// Why: the shared test setup swaps in upstream's identity; these assets carry the fork's names.
vi.unmock('../../shared/product-identity')

const release = {
  tag_name: 'v1.4.21405',
  html_url: 'https://github.com/hendrickcastro/orca/releases/tag/v1.4.21405',
  assets: [
    { name: 'latest.yml', browser_download_url: 'https://example.test/latest.yml' },
    { name: 'orca-knwr-macos-arm64.dmg', browser_download_url: 'https://example.test/arm64.dmg' },
    { name: 'orca-knwr-macos-x64.dmg', browser_download_url: 'https://example.test/x64.dmg' }
  ]
}

describe('parseForkMacDmgRelease', () => {
  it('picks the DMG for the running CPU', () => {
    expect(parseForkMacDmgRelease(release, 'arm64')).toEqual({
      version: '1.4.21405',
      releaseUrl: release.html_url,
      dmgUrl: 'https://example.test/arm64.dmg',
      dmgName: 'orca-knwr-macos-arm64.dmg'
    })
    expect(parseForkMacDmgRelease(release, 'x64')?.dmgUrl).toBe('https://example.test/x64.dmg')
  })

  it('returns null when the release has no DMG for this CPU', () => {
    expect(
      parseForkMacDmgRelease({ ...release, assets: release.assets.slice(0, 1) }, 'arm64')
    ).toBe(null)
  })

  it('returns null for a malformed payload', () => {
    expect(parseForkMacDmgRelease({ message: 'Not Found' }, 'arm64')).toBe(null)
    expect(parseForkMacDmgRelease({ ...release, tag_name: 'nightly' }, 'arm64')).toBe(null)
    expect(parseForkMacDmgRelease(null, 'arm64')).toBe(null)
  })
})

describe('resolveReplaceableAppBundle', () => {
  it('resolves the bundle around the executable', () => {
    expect(
      resolveReplaceableAppBundle('/Applications/Orca knwr.app/Contents/MacOS/Orca knwr')
    ).toBe('/Applications/Orca knwr.app')
  })

  it('refuses read-only locations', () => {
    expect(
      resolveReplaceableAppBundle(
        '/private/var/folders/x/AppTranslocation/ABC/d/Orca knwr.app/Contents/MacOS/Orca knwr'
      )
    ).toBe(null)
    expect(
      resolveReplaceableAppBundle('/Volumes/Orca knwr/Orca knwr.app/Contents/MacOS/Orca knwr')
    ).toBe(null)
    expect(resolveReplaceableAppBundle('/usr/local/bin/orca')).toBe(null)
  })
})
