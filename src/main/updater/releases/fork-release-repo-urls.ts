import { MAIN_RELEASE_REPO } from '../../../shared/updater/release-channel'

// Why: the fork publishes to its own repo; upstream files import these instead of hardcoding stablyai/orca.
const ESCAPED_RELEASE_REPO = MAIN_RELEASE_REPO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ESCAPED_RELEASES_URL = `https://github\\.com/${ESCAPED_RELEASE_REPO}/releases`

export const RELEASES_ATOM_FEED_URL = `https://github.com/${MAIN_RELEASE_REPO}/releases.atom`
export const RELEASES_LATEST_URL = `https://github.com/${MAIN_RELEASE_REPO}/releases/latest`
export const RELEASES_DOWNLOAD_BASE_URL = `https://github.com/${MAIN_RELEASE_REPO}/releases/download`
export const RELEASE_TAG_HREF_RE = new RegExp(`href="${ESCAPED_RELEASES_URL}/tag/([^"]+)"`)
export const RELEASE_TAG_PATH_RE = new RegExp(`^/${ESCAPED_RELEASE_REPO}/releases/tag/([^/]+)$`)
export const RELEASE_DOWNLOAD_URL_RE = new RegExp(`^${ESCAPED_RELEASES_URL}/download/`, 'i')
