import { chmod, mkdir, open, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app, BrowserWindow, net } from 'electron'
import { is } from '@electron-toolkit/utils'
import { PRODUCT_MAC_UPDATES_FROM_DMG, PRODUCT_NAME } from '../../shared/product-identity'
import type { UpdateCheckOptions } from '../../shared/update-status-types'
import { spawnProcess } from '../../shared/child-process/run-process'
import { killAllPty } from '../ipc/pty'
import { armUpdateInstallExitWatchdog } from '../update-install-exit-watchdog'
import { compareVersions } from '../updater-fallback'
import { recordUpdaterLifecycle } from '../updater-lifecycle-diagnostics'
import {
  FORK_LATEST_RELEASE_API_URL,
  FORK_MAC_INSTALL_SCRIPT,
  parseForkMacDmgRelease,
  resolveReplaceableAppBundle,
  type ForkMacDmgRelease
} from './fork-mac-dmg-release'
import { AUTO_UPDATE_CHECK_INTERVAL_MS } from './updater-state'
import { UpdaterSetup } from './updater-setup'

const RELEASE_FETCH_TIMEOUT_MS = 10_000

function getUpdateWorkDir(): string {
  return path.join(app.getPath('temp'), `${PRODUCT_NAME.replace(/\s+/g, '-')}-update`)
}

/** On the fork's macOS build, checks, downloads and installs the release DMG instead of using Squirrel.Mac. */
export class ForkMacDmgUpdaterSetup extends UpdaterSetup {
  private dmgRelease: ForkMacDmgRelease | null = null
  private downloadedDmgPath: string | null = null
  private dmgCheckInFlight = false

  private get usesDmgUpdates(): boolean {
    return PRODUCT_MAC_UPDATES_FROM_DMG && process.platform === 'darwin'
  }

  checkForUpdatesFromMenu(options?: UpdateCheckOptions): void {
    if (!this.usesDmgUpdates) {
      super.checkForUpdatesFromMenu(options)
      return
    }
    void this.checkDmgRelease(true)
  }

  protected runBackgroundUpdateCheck(nudgeId?: string | null): boolean {
    if (!this.usesDmgUpdates) {
      return super.runBackgroundUpdateCheck(nudgeId)
    }
    if (this.dmgCheckInFlight || !app.isPackaged || is.dev) {
      return false
    }
    void this.checkDmgRelease(false)
    return true
  }

  downloadUpdate(): void {
    if (!this.usesDmgUpdates) {
      super.downloadUpdate()
      return
    }
    void this.downloadDmg()
  }

  quitAndInstall(): void {
    if (!this.usesDmgUpdates) {
      super.quitAndInstall()
      return
    }
    void this.installDmgAndQuit()
  }

  private async checkDmgRelease(userInitiated: boolean): Promise<void> {
    if (!app.isPackaged || is.dev) {
      this.sendStatus({ state: 'not-available', userInitiated: true })
      return
    }
    const busy = ['downloading', 'downloaded'].includes(this.currentStatus.state)
    if (this.dmgCheckInFlight || busy || this.quitAndInstallInProgress) {
      return
    }
    this.dmgCheckInFlight = true
    if (userInitiated) {
      this.sendStatus({ state: 'checking', userInitiated: true })
    }
    try {
      const response = await net.fetch(FORK_LATEST_RELEASE_API_URL, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(RELEASE_FETCH_TIMEOUT_MS)
      })
      if (!response.ok) {
        throw new Error(`GitHub answered HTTP ${response.status}`)
      }
      const release = parseForkMacDmgRelease(await response.json(), process.arch)
      this.recordCompletedUpdateCheck()
      this.scheduleAutomaticUpdateCheck(AUTO_UPDATE_CHECK_INTERVAL_MS)
      if (!release || compareVersions(release.version, app.getVersion()) <= 0) {
        this.clearDmgRelease()
        this.sendStatus({ state: 'not-available', userInitiated })
        return
      }
      this.dmgRelease = release
      this.availableVersion = release.version
      this.availableReleaseUrl = release.releaseUrl
      this.sendStatus({
        state: 'available',
        version: release.version,
        releaseUrl: release.releaseUrl,
        changelog: null
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[updater] fork release check failed:', message)
      this.scheduleAutomaticUpdateCheck(this.getAutomaticRetryInterval())
      this.sendStatus(
        userInitiated
          ? {
              state: 'error',
              message: `Couldn't check GitHub for a newer ${PRODUCT_NAME} (${message}). Try again in a few minutes.`,
              userInitiated: true
            }
          : { state: 'idle' }
      )
    } finally {
      this.dmgCheckInFlight = false
    }
  }

  private clearDmgRelease(): void {
    this.dmgRelease = null
    this.downloadedDmgPath = null
    this.clearAvailableUpdateContext()
  }

  private async downloadDmg(): Promise<void> {
    const release = this.dmgRelease
    const canStart =
      this.currentStatus.state === 'available' || this.currentStatus.state === 'error'
    if (!release || !canStart || this.downloadInFlight) {
      return
    }
    this.downloadInFlight = true
    const { version } = release
    this.sendStatus({ state: 'downloading', percent: 0, version })
    const workDir = getUpdateWorkDir()
    const dmgPath = path.join(workDir, `${version}-${release.dmgName}`)
    try {
      await mkdir(workDir, { recursive: true })
      const response = await net.fetch(release.dmgUrl)
      if (!response.ok || !response.body) {
        throw new Error(`download failed with HTTP ${response.status}`)
      }
      const total = Number(response.headers.get('content-length')) || 0
      const reader = response.body.getReader()
      const file = await open(dmgPath, 'w')
      let received = 0
      let lastPercent = 0
      try {
        for (;;) {
          const chunk = await reader.read()
          if (chunk.done) {
            break
          }
          await file.write(chunk.value)
          received += chunk.value.byteLength
          const percent = total > 0 ? Math.min(99, Math.floor((received / total) * 100)) : 0
          if (percent > lastPercent) {
            lastPercent = percent
            this.sendStatus({ state: 'downloading', percent, version })
          }
        }
      } catch (error) {
        await reader.cancel().catch(() => undefined)
        throw error
      } finally {
        await file.close()
      }
      this.downloadedDmgPath = dmgPath
      recordUpdaterLifecycle('fork_mac_dmg_downloaded', { version })
      this.sendStatus({ state: 'downloaded', version, releaseUrl: release.releaseUrl })
    } catch (error) {
      await rm(dmgPath, { force: true })
      const message = error instanceof Error ? error.message : String(error)
      this.sendStatus({
        state: 'error',
        message: `Couldn't download ${PRODUCT_NAME} ${version} (${message}).`,
        version,
        retryable: true
      })
    } finally {
      this.downloadInFlight = false
    }
  }

  private async installDmgAndQuit(): Promise<void> {
    const dmgPath = this.downloadedDmgPath
    const version = this.dmgRelease?.version
    if (!dmgPath || !version || this.quitAndInstallInProgress) {
      return
    }
    const bundle = resolveReplaceableAppBundle(app.getPath('exe'))
    if (!bundle) {
      this.mainWindowRef?.webContents.send('updater:quitAndInstallAborted')
      this.sendInstallFailureStatus({
        state: 'error',
        message: `Move ${PRODUCT_NAME} to the Applications folder and reopen it, then update again.`,
        version
      })
      return
    }
    this.quitAndInstallInProgress = true
    this.quittingForUpdate = true
    try {
      await this.runBeforeUpdateQuitCleanup()
      const workDir = getUpdateWorkDir()
      const scriptPath = path.join(workDir, 'install-update.sh')
      await writeFile(scriptPath, FORK_MAC_INSTALL_SCRIPT)
      await chmod(scriptPath, 0o755)
      const installer = spawnProcess({
        program: '/bin/bash',
        args: [scriptPath, String(process.pid), dmgPath, bundle, path.join(workDir, 'install.log')],
        detached: true,
        stdio: 'ignore'
      })
      installer.unref()
      recordUpdaterLifecycle('fork_mac_dmg_install_started', { version })
      this.updateInstallCommitted = true
      armUpdateInstallExitWatchdog()
      killAllPty()
      for (const win of BrowserWindow.getAllWindows()) {
        win.removeAllListeners('close')
      }
      app.quit()
    } catch (error) {
      this.resetQuitForUpdateState()
      this.mainWindowRef?.webContents.send('updater:quitAndInstallAborted')
      this.sendInstallFailureStatus({
        state: 'error',
        message: this.withInstallFailureCause(
          `Could not start the ${PRODUCT_NAME} installer. It remains open.`,
          error
        ),
        version
      })
    }
  }
}
