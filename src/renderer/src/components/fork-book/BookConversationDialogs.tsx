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
import { translate } from '@/i18n/i18n'
import { useBookStore } from './book-store'
import { recreateAndContinueBookEntry } from './book-entry-actions'

function BookRecreateDialog(): React.JSX.Element | null {
  const prompt = useBookStore((s) => s.recreatePrompt)
  const entry = useBookStore((s) =>
    prompt ? s.catalog.entries.find((candidate) => candidate.id === prompt.entryId) : undefined
  )
  const setRecreatePrompt = useBookStore((s) => s.setRecreatePrompt)
  const [busy, setBusy] = useState(false)
  if (!prompt || !entry) {
    return null
  }
  const close = (): void => {
    if (!busy) {
      setRecreatePrompt(null)
    }
  }
  const confirm = async (): Promise<void> => {
    setBusy(true)
    try {
      if (await recreateAndContinueBookEntry(prompt.entryId, prompt.next)) {
        setRecreatePrompt(null)
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate('forkBook.recreateTitle', 'This workspace was removed')}
          </DialogTitle>
          <DialogDescription>
            {entry.branch
              ? translate(
                  'forkBook.recreateDescription',
                  'Open branch {{branch}} of {{repo}} in a new workspace and continue the conversation there.',
                  { branch: entry.branch, repo: entry.repoName ?? '' }
                )
              : translate(
                  'forkBook.recreateNoBranch',
                  'This entry has no branch, so its workspace cannot be recreated.'
                )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={busy}>
            {translate('forkBook.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void confirm()} disabled={busy || !entry.branch}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {translate('forkBook.recreateConfirm', 'Create workspace and continue')}
          </Button>
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
