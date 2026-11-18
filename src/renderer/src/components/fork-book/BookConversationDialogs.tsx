import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { AgentSessionContinuationDialog } from '@/components/agent-session-continuation/AgentSessionContinuationDialog'
import { useTranslate } from '@/i18n/use-translate'
import { useBookStore } from './book-store'
import { useAppStore } from '@/store/index'
import { locateRepoAndContinueBookEntry, recreateAndContinueBookEntry } from './book-entry-actions'
import { findBookRepo } from './book-workspace-recreate'

function BookRecreateDialog(): React.JSX.Element | null {
  const t = useTranslate()
  const prompt = useBookStore((s) => s.recreatePrompt)
  const entry = useBookStore((s) =>
    prompt ? s.catalog.entries.find((candidate) => candidate.id === prompt.entryId) : undefined
  )
  const setRecreatePrompt = useBookStore((s) => s.setRecreatePrompt)
  const repos = useAppStore((s) => s.repos)
  const [busy, setBusy] = useState(false)
  if (!prompt || !entry) {
    return null
  }
  const repoFound = findBookRepo(repos, entry.repo, entry.repoName) !== null
  const close = (): void => {
    if (!busy) {
      setRecreatePrompt(null)
    }
  }
  const run = (action: Promise<boolean>): void => {
    setBusy(true)
    void action
      .then((done) => {
        if (done) {
          setRecreatePrompt(null)
        }
      })
      .finally(() => setBusy(false))
  }
  const repoLabel = entry.repoName ?? entry.repo?.remoteUrl ?? ''
  let description: string
  if (!entry.branch) {
    description = t(
      'forkBook.recreateNoBranch',
      'This entry has no branch, so its workspace cannot be recreated.'
    )
  } else if (repoFound) {
    description = t(
      'forkBook.recreateDescription',
      'Open branch {{branch}} of {{repo}} in a new workspace and continue the conversation there.',
      { branch: entry.branch, repo: repoLabel }
    )
  } else {
    description = t(
      'forkBook.repoMissingDescription',
      'Repository {{repo}} is not in Orca on this computer. Pick the folder where it is cloned, or clone it, to open branch {{branch}} and continue there.',
      { branch: entry.branch, repo: repoLabel }
    )
  }
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {entry.importedContext
              ? t('forkBook.notOnThisComputerTitle', 'This work is not on this computer yet')
              : t('forkBook.recreateTitle', 'This workspace was removed')}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={busy}>
            {t('forkBook.cancel', 'Cancel')}
          </Button>
          {repoFound ? (
            <Button
              onClick={() => run(recreateAndContinueBookEntry(prompt.entryId, prompt.next))}
              disabled={busy || !entry.branch}
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {t('forkBook.recreateConfirm', 'Create workspace and continue')}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  run(locateRepoAndContinueBookEntry(prompt.entryId, 'folder', prompt.next))
                }
                disabled={busy || !entry.branch}
              >
                {t('forkBook.pickRepoFolder', 'Choose folder…')}
              </Button>
              {entry.repo?.remoteUrl ? (
                <Button
                  onClick={() =>
                    run(locateRepoAndContinueBookEntry(prompt.entryId, 'clone', prompt.next))
                  }
                  disabled={busy || !entry.branch}
                >
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                  {t('forkBook.cloneRepo', 'Clone…')}
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BookContinuationHost(): React.JSX.Element | null {
  const continuation = useBookStore((s) => s.continuation)
  const setContinuation = useBookStore((s) => s.setContinuation)
  if (!continuation) {
    return null
  }
  return (
    <AgentSessionContinuationDialog
      open
      request={continuation.request}
      sourceWorkingDirectory={continuation.sourceWorkingDirectory}
      onOpenChange={(open) => !open && setContinuation(null)}
      onStarted={() => setContinuation(null)}
    />
  )
}

/** Book's conversation dialogs, mounted once at the app root next to the entry editor. */
export function BookConversationDialogs(): React.JSX.Element {
  return (
    <>
      <BookRecreateDialog />
      <BookContinuationHost />
    </>
  )
}
