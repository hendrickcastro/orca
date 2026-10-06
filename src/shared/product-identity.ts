// Why: this fork installs and runs beside upstream Orca, so every packaged identity that the OS or
// the filesystem keys on lives here. Mirrored in config/product-identity.cjs for electron-builder.
export const PRODUCT_NAME = 'Orca knwr'
export const PRODUCT_APP_ID = 'com.knwr.orca'
/** Packaged package.json `name`: Electron's userData folder and the NSIS install folder. */
export const PRODUCT_PACKAGE_NAME = 'orca-knwr'
export const PRODUCT_WINDOWS_EXECUTABLE_NAME = 'OrcaKnwr'
/** Global CLI alias, so the fork's CLI stays reachable when upstream's `orca` wins PATH. */
export const PRODUCT_CLI_ALIAS = 'orca-knwr'
/** Per-user home folder for state encrypted with this install's safeStorage key. */
export const PRODUCT_HOME_STATE_DIR_NAME = '.orca-knwr'
/** Upstream packaged Orca holds 6768 and dev holds 6769; a taken port falls back to a random one. */
export const PRODUCT_DEFAULT_WS_PORT = 6778
export const PRODUCT_RELEASE_OWNER = 'hendrickcastro'
export const PRODUCT_RELEASE_REPO = `${PRODUCT_RELEASE_OWNER}/orca`
/** The fork pins userData to PRODUCT_PACKAGE_NAME; upstream relies on Electron's default. */
export const PRODUCT_PINS_USER_DATA = true
/** The fork's macOS build is ad-hoc signed, so Squirrel.Mac can't install it; updates come from the release DMG. */
export const PRODUCT_MAC_UPDATES_FROM_DMG = true
