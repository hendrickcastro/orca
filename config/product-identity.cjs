// Why mirrored, not imported: electron-builder loads CJS outside the TS build.
// Keep in sync with src/shared/product-identity.ts (config/scripts/product-identity.test.mjs enforces it).
module.exports = {
  PRODUCT_NAME: 'Orca knwr',
  PRODUCT_APP_ID: 'com.knwr.orca',
  PRODUCT_PACKAGE_NAME: 'orca-knwr',
  PRODUCT_WINDOWS_EXECUTABLE_NAME: 'OrcaKnwr',
  PRODUCT_CLI_ALIAS: 'orca-knwr',
  PRODUCT_HOME_STATE_DIR_NAME: '.orca-knwr',
  PRODUCT_DEFAULT_WS_PORT: 6778,
  PRODUCT_RELEASE_OWNER: 'hendrickcastro',
  PRODUCT_RELEASE_REPO: 'hendrickcastro/orca',
  PRODUCT_PINS_USER_DATA: true
}
