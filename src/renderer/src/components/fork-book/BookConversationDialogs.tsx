import { AgentSessionContinuationDialog } from '@/components/agent-session-continuation/AgentSessionContinuationDialog'
import { useBookStore } from './book-store'
import { BookWorkspaceDialog } from './BookWorkspaceDialog'

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
      <BookWorkspaceDialog />
      <BookContinuationHost />
    </>
  )
}
