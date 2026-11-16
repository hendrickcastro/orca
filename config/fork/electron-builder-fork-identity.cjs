// Fork-only overrides applied on top of upstream's electron-builder config, so that file keeps a one-line hook.
const productIdentity = require('../product-identity.cjs')

const WINDOWS_CLI_LAUNCHER = 'native/windows-cli-launcher/.build/orca.exe'

// Why: the shared vitest setup sets this so upstream's config tests keep asserting upstream's identity.
function isUpstreamIdentityRequested() {
  return process.env.ORCA_FORK_UPSTREAM_IDENTITY === '1'
}

function withForkWindowsResources(extraResources) {
  const index = extraResources.findIndex(
    (resource) => resource.from === WINDOWS_CLI_LAUNCHER && resource.to === 'bin/orca.exe'
  )
  if (index === -1) {
    throw new Error(
      'Fork identity: upstream no longer ships bin/orca.exe; update the launcher copy.'
    )
  }
  // Second copy: the launcher locates the app from its own folder, not its file name.
  const aliasCopy = {
    from: WINDOWS_CLI_LAUNCHER,
    to: `bin/${productIdentity.PRODUCT_CLI_ALIAS}.exe`
  }
  return [...extraResources.slice(0, index + 1), aliasCopy, ...extraResources.slice(index + 1)]
}

function applyForkIdentity(config) {
  if (isUpstreamIdentityRequested()) {
    return config
  }
  const packageName = productIdentity.PRODUCT_PACKAGE_NAME
  const { publisherName: _publisherName, ...signtoolOptions } = config.win.signtoolOptions ?? {}
  return {
    ...config,
    appId: productIdentity.PRODUCT_APP_ID,
    productName: productIdentity.PRODUCT_NAME,
    // Why not `orca`: the last installer to run owns that scheme, so the fork would steal upstream's links.
    protocols: [{ name: productIdentity.PRODUCT_NAME, schemes: [packageName] }],
    // Why name: it drives the NSIS install folder, the updater cache folder and Electron's userData.
    extraMetadata: { ...config.extraMetadata, name: packageName },
    win: {
      ...config.win,
      // Not 'Orca': the uninstaller's taskkill /IM would also stop upstream Orca.
      executableName: productIdentity.PRODUCT_WINDOWS_EXECUTABLE_NAME,
      // Fork builds ship unsigned, so no channel bakes in a publisherName the next update would fail to match.
      signtoolOptions,
      verifyUpdateCodeSignature: false,
      extraResources: withForkWindowsResources(config.win.extraResources)
    },
    nsis: { ...config.nsis, artifactName: `${packageName}-windows-setup.\${ext}` },
    // Why: the default zip name embeds productName, and a space in a GitHub asset name breaks the updater feed.
    mac: { ...config.mac, artifactName: `${packageName}-macos-\${arch}.\${ext}` },
    dmg: { ...config.dmg, artifactName: `${packageName}-macos-\${arch}.\${ext}` },
    publish: { ...config.publish, owner: productIdentity.PRODUCT_RELEASE_OWNER }
  }
}

module.exports = { applyForkIdentity }
