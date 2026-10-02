// Test-only twin of src/shared/product-identity.ts holding upstream Orca's identity, so upstream's
// own tests run unchanged against fork code (see config/fork/vitest-upstream-identity.ts).
export const PRODUCT_NAME = 'Orca'
export const PRODUCT_APP_ID = 'com.stablyai.orca'
export const PRODUCT_PACKAGE_NAME = 'orca'
export const PRODUCT_WINDOWS_EXECUTABLE_NAME = 'Orca'
export const PRODUCT_CLI_ALIAS = 'orca'
export const PRODUCT_HOME_STATE_DIR_NAME = '.orca'
export const PRODUCT_DEFAULT_WS_PORT = 6768
export const PRODUCT_RELEASE_OWNER = 'stablyai'
export const PRODUCT_RELEASE_REPO = `${PRODUCT_RELEASE_OWNER}/orca`
export const PRODUCT_PINS_USER_DATA = false
