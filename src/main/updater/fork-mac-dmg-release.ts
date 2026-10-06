import path from 'node:path'
import { PRODUCT_PACKAGE_NAME, PRODUCT_RELEASE_REPO } from '../../shared/product-identity'
import { normalizeTagToVersion } from '../../shared/release-channel'
import { isValidVersion } from '../updater-fallback'

export type ForkMacDmgRelease = {
  version: string
  releaseUrl: string
  dmgUrl: string
  dmgName: string
}

export const FORK_LATEST_RELEASE_API_URL = `https://api.github.com/repos/${PRODUCT_RELEASE_REPO}/releases/latest`

export function getForkMacDmgName(arch: string): string {
  return `${PRODUCT_PACKAGE_NAME}-macos-${arch === 'arm64' ? 'arm64' : 'x64'}.dmg`
}

function readString(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null || !(key in value)) {
    return null
  }
  const field: unknown = Reflect.get(value, key)
  return typeof field === 'string' ? field : null
}

/** Reads GitHub's `releases/latest` payload; null when it has no DMG for this CPU. */
export function parseForkMacDmgRelease(payload: unknown, arch: string): ForkMacDmgRelease | null {
  const tag = readString(payload, 'tag_name')
  const releaseUrl = readString(payload, 'html_url')
  if (!tag || !releaseUrl) {
    return null
  }
  const version = normalizeTagToVersion(tag)
  if (!isValidVersion(version)) {
    return null
  }
  const dmgName = getForkMacDmgName(arch)
  const assets: unknown =
    typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'assets') : null
  const asset = Array.isArray(assets)
    ? assets.find((entry) => readString(entry, 'name') === dmgName)
    : undefined
  const dmgUrl = readString(asset, 'browser_download_url')
  return dmgUrl ? { version, releaseUrl, dmgUrl, dmgName } : null
}

/** The .app bundle around the running executable, or null when it can't be replaced in place. */
export function resolveReplaceableAppBundle(exePath: string): string | null {
  const bundle = path.posix.resolve(exePath, '../../..')
  if (!bundle.endsWith('.app')) {
    return null
  }
  // Why: a translocated or mounted-DMG copy is read-only; replacing it would not survive a relaunch.
  if (bundle.includes('/AppTranslocation/') || bundle.startsWith('/Volumes/')) {
    return null
  }
  return bundle
}

// Why a script that outlives the app: the bundle can only be swapped once this process has exited.
// Mirrors config/fork/install-macos.sh: clear quarantine and re-sign ad-hoc so Gatekeeper accepts it.
export const FORK_MAC_INSTALL_SCRIPT = `#!/bin/bash
set -uo pipefail
pid="$1"; dmg="$2"; target="$3"; log="$4"
exec >>"$log" 2>&1
echo "[$(date)] waiting for pid $pid to exit"
for _ in $(seq 1 600); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
if kill -0 "$pid" 2>/dev/null; then echo "app never exited; update skipped"; exit 1; fi
mount="$(mktemp -d)"; staged="$target.update"; previous="$target.previous"
fail() {
  echo "install failed: $1"
  hdiutil detach "$mount" -quiet 2>/dev/null
  rm -rf "$staged"
  [ -d "$target" ] || mv "$previous" "$target"
  open "$target"
  exit 1
}
hdiutil attach "$dmg" -nobrowse -quiet -mountpoint "$mount" || fail "attach"
source_app="$(find "$mount" -maxdepth 1 -name '*.app' -print -quit)"
[ -n "$source_app" ] || fail "no app in disk image"
rm -rf "$staged" "$previous"
ditto "$source_app" "$staged" || fail "copy"
hdiutil detach "$mount" -quiet && rmdir "$mount"
xattr -cr "$staged"
codesign --force --deep --sign - "$staged" || fail "codesign"
mv "$target" "$previous" || fail "move old app"
mv "$staged" "$target" || fail "move new app"
rm -rf "$previous" "$dmg"
echo "installed; relaunching"
open "$target"
`
