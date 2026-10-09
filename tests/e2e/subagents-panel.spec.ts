import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from './helpers/orca-app'

const jsonl = (rows: Record<string, unknown>[]): string =>
  `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`

test('lists a session’s subagents with answer previews and opens a result tab', async ({
  electronApp,
  orcaPage,
  seededRepoPath
}, testInfo) => {
  const home = await electronApp.evaluate(({ app }) => app.getPath('home'))
  const projectDir = path.join(home, '.claude', 'projects', '-synthetic-subagents')
  const sessionId = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
  const subagentsDir = path.join(projectDir, sessionId, 'subagents')
  mkdirSync(subagentsDir, { recursive: true })
  const now = Date.now()
  const at = (offsetMs: number): string => new Date(now - offsetMs).toISOString()
  writeFileSync(
    path.join(projectDir, `${sessionId}.jsonl`),
    jsonl([
      {
        type: 'user',
        sessionId,
        cwd: seededRepoPath,
        timestamp: at(60_000),
        message: { role: 'user', content: 'Migrate the billing module' }
      },
      {
        type: 'assistant',
        sessionId,
        timestamp: at(50_000),
        message: { role: 'assistant', content: 'Delegating research to subagents.' }
      }
    ])
  )
  const subagent = (id: string, rows: Record<string, unknown>[], meta: Record<string, unknown>) => {
    writeFileSync(
      path.join(subagentsDir, `agent-${id}.jsonl`),
      jsonl(rows.map((row) => ({ isSidechain: true, agentId: id, sessionId, ...row })))
    )
    writeFileSync(path.join(subagentsDir, `agent-${id}.meta.json`), JSON.stringify(meta))
  }
  subagent(
    'a1',
    [
      {
        type: 'user',
        timestamp: at(40_000),
        message: { role: 'user', content: 'Find every caller of chargeCard.' }
      },
      {
        type: 'assistant',
        timestamp: at(30_000),
        message: {
          role: 'assistant',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Found 3 callers of chargeCard in invoices.ts.' }]
        }
      }
    ],
    { agentType: 'Explore', description: 'Map chargeCard callers' }
  )
  subagent(
    'a2',
    [
      {
        type: 'user',
        timestamp: at(20_000),
        message: { role: 'user', content: 'Draft the migration plan.' }
      }
    ],
    { agentType: 'Plan', description: 'Draft migration plan' }
  )

  await orcaPage.evaluate(async () => {
    const state = window.__store?.getState()
    // Why: the harness follows the OS locale; assertions below use English copy.
    await state?.updateSettingsOrThrow({ uiLanguage: 'en' })
    state?.setRightSidebarOpen(true)
    state?.setRightSidebarWidth(360)
  })
  await orcaPage.getByRole('button', { name: 'Subagents', exact: true }).click()
  await expect(orcaPage.getByText('Migrate the billing module', { exact: true })).toBeVisible({
    timeout: 30_000
  })
  // The group names the parent agent and the project / workspace it runs in.
  await expect(orcaPage.getByText(/^Claude · /)).toBeVisible()
  const finished = orcaPage.getByRole('button', { name: /Map chargeCard callers/ })
  await expect(finished).toContainText('Found 3 callers of chargeCard in invoices.ts.')
  await expect(finished).toContainText('Explore')
  // Written seconds ago with no answer, so the scanner reports it running.
  await expect(orcaPage.getByRole('button', { name: /Draft migration plan/ })).toContainText(
    'Working…'
  )
  // The working subagent is listed above the finished one, though it was launched later.
  await expect(
    orcaPage.getByRole('button', { name: /Map chargeCard callers|Draft migration plan/ })
  ).toHaveText([/Draft migration plan/, /Map chargeCard callers/])

  const toggle = orcaPage.getByRole('button', { name: 'Show or hide subagents', exact: true })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(finished).toBeHidden()
  await toggle.click()
  await expect(finished).toBeVisible()

  const cdp = await orcaPage.context().newCDPSession(orcaPage)
  async function screenshot(name: string): Promise<void> {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const screenshotPath = testInfo.outputPath(name)
    writeFileSync(screenshotPath, Buffer.from(data, 'base64'))
    await testInfo.attach(name, { path: screenshotPath, contentType: 'image/png' })
  }
  await screenshot('subagents-panel.png')

  await finished.click()
  await expect(orcaPage.getByRole('heading', { name: 'Map chargeCard callers' })).toBeVisible({
    timeout: 30_000
  })
  await expect(orcaPage.getByRole('heading', { name: 'Result' })).toBeVisible()
  await expect(orcaPage.getByText('Find every caller of chargeCard.')).toBeVisible()
  await screenshot('subagent-result-tab.png')

  // The running subagent finishes on disk; opening it reads the transcript as it is now.
  writeFileSync(
    path.join(subagentsDir, 'agent-a2.jsonl'),
    jsonl(
      [
        {
          type: 'user',
          timestamp: at(20_000),
          message: { role: 'user', content: 'Draft the migration plan.' }
        },
        {
          type: 'assistant',
          timestamp: at(1_000),
          message: {
            role: 'assistant',
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: 'Plan: migrate in three phases.' }]
          }
        }
      ].map((row) => ({ isSidechain: true, agentId: 'a2', sessionId, ...row }))
    )
  )
  // A working row expands in place into what it was asked and what it has done so far.
  const working = orcaPage.getByRole('button', { name: /Draft migration plan/ })
  await working.click()
  await expect(working).toHaveAttribute('aria-expanded', 'true')
  await expect(orcaPage.getByText('Recent activity', { exact: true })).toBeVisible({
    timeout: 30_000
  })
  await expect(orcaPage.getByText('Plan: migrate in three phases.').first()).toBeVisible()
  await screenshot('subagent-live-activity.png')
  await orcaPage.getByRole('button', { name: 'Open in a tab', exact: true }).click()
  await expect(orcaPage.getByRole('heading', { name: 'Draft migration plan' })).toBeVisible({
    timeout: 30_000
  })

  await orcaPage.evaluate(async () => {
    await window.__store?.getState().updateSettingsOrThrow({ theme: 'dark' })
  })
  await expect(orcaPage.locator('html')).toHaveClass(/dark/)
  await screenshot('subagent-result-tab-dark.png')
  await cdp.detach()
})
