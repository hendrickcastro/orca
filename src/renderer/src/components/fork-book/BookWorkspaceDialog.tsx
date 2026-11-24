import { useCallback, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import RepoMultiCombobox from '@/components/ui/repo-multi-combobox'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store/index'
import type {
  BookEntry,
  BookWorkspaceMember
} from '../../../../shared/fork-book/book-catalog-types'
import { useBookStore, type BookWorkspacePrompt } from './book-store'
import { findBookWorktree } from './book-entry-snapshot'
import { setUpAndContinueBookEntry } from './book-entry-actions'
import { locateBookRepo, type BookMemberTarget } from './book-member-worktrees'
import {
  defaultBookMemberChoices,
  defaultBookMemberTarget,
  type BookMemberChoice
} from './book-workspace-setup'
import { BookMemberTargetSelect } from './BookMemberTargetSelect'

function BookWorkspaceDialogBody({
  entry,
  prompt
}: {
  entry: BookEntry
  prompt: BookWorkspacePrompt
}): React.JSX.Element {
  const t = useTranslate()
  const repos = useAppStore((s) => s.repos)
  const gitRepos = repos.filter((repo) => repo.kind !== 'folder')
  const setWorkspacePrompt = useBookStore((s) => s.setWorkspacePrompt)
  const [initial] = useState(() => defaultBookMemberChoices(entry, repos))
  const [choices, setChoices] = useState<BookMemberChoice[]>(initial.choices)
  const [missing, setMissing] = useState<BookWorkspaceMember[]>(initial.missing)
  const [busy, setBusy] = useState(false)
  const live = findBookWorktree(useAppStore.getState(), entry.workspaceId) !== null

  const close = (): void => {
    if (!busy) {
      setWorkspacePrompt(null)
    }
  }
  const setTarget = useCallback((repoId: string, target: BookMemberTarget) => {
    setChoices((current) =>
      current.map((choice) => (choice.repo.id === repoId ? { ...choice, target } : choice))
    )
  }, [])
  const selectRepos = (next: ReadonlySet<string>): void => {
    setChoices((current) => [
      ...current.filter((choice) => next.has(choice.repo.id)),
      ...gitRepos
        .filter(
          (repo) => next.has(repo.id) && !current.some((choice) => choice.repo.id === repo.id)
        )
        .map((repo) => ({ repo, target: defaultBookMemberTarget(entry, repo, entry.branch) }))
    ])
  }
  const locate = (member: BookWorkspaceMember, how: 'folder' | 'clone'): void => {
    setBusy(true)
    void locateBookRepo(member.repo, how)
      .then((repo) => {
        if (repo) {
          setMissing((current) => current.filter((item) => item !== member))
          setChoices((current) =>
            current.some((choice) => choice.repo.id === repo.id)
              ? current
              : [...current, { repo, target: defaultBookMemberTarget(entry, repo, member.branch) }]
          )
        }
      })
      .finally(() => setBusy(false))
  }
  const confirm = (): void => {
    setBusy(true)
    void setUpAndContinueBookEntry(entry.id, choices, prompt.next)
      .then((done) => {
        if (done) {
          setWorkspacePrompt(null)
        }
      })
      .finally(() => setBusy(false))
  }

  let title: string
  if (prompt.next === 'save') {
    title = t('forkBook.workspaceSetupTitle', 'Repositories and branches')
  } else if (entry.importedContext && !live) {
    title = t('forkBook.notOnThisComputerTitle', 'This work is not on this computer yet')
  } else {
    title = t('forkBook.recreateTitle', 'This workspace was removed')
  }
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t(
              'forkBook.workspaceSetupDescription',
              'Choose the repositories on this computer and, for each one, an existing worktree or the branch to work on. With several repositories they are joined in one multi-repo workspace.'
            )}
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy} className="min-w-0 space-y-3">
          {missing.map((member) => (
            <div
              key={`${member.repoName ?? ''}:${member.repo.remoteUrl ?? member.repo.projectId ?? ''}`}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            >
              <span className="min-w-0 flex-1">
                {t('forkBook.repoMissingHere', '{{repo}} is not in Orca on this computer.', {
                  repo: member.repoName ?? member.repo.remoteUrl ?? ''
                })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => locate(member, 'folder')}
              >
                {t('forkBook.pickRepoFolder', 'Choose folder…')}
              </Button>
              {member.repo.remoteUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => locate(member, 'clone')}
                >
                  {t('forkBook.cloneRepo', 'Clone…')}
                </Button>
              ) : null}
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>{t('forkBook.workspaceRepos', 'Repositories on this computer')}</Label>
            <RepoMultiCombobox
              repos={gitRepos}
              selected={new Set(choices.map((choice) => choice.repo.id))}
              onChange={selectRepos}
              onSelectAll={() => selectRepos(new Set(gitRepos.map((repo) => repo.id)))}
            />
          </div>
          {choices.map((choice) => (
            <div key={choice.repo.id} className="space-y-1.5">
              <Label>{choice.repo.displayName}</Label>
              <BookMemberTargetSelect
                repo={choice.repo}
                value={choice.target}
                onChange={(target) => setTarget(choice.repo.id, target)}
              />
            </div>
          ))}
        </fieldset>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={busy}>
            {t('forkBook.cancel', 'Cancel')}
          </Button>
          <Button onClick={confirm} disabled={busy || choices.length === 0}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {prompt.next === 'save'
              ? t('forkBook.save', 'Save')
              : t('forkBook.recreateConfirm', 'Create workspace and continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Picks the repositories and checkouts an entry works on; mounted once at the app root. */
export function BookWorkspaceDialog(): React.JSX.Element | null {
  const prompt = useBookStore((s) => s.workspacePrompt)
  const entry = useBookStore((s) =>
    prompt ? s.catalog.entries.find((candidate) => candidate.id === prompt.entryId) : undefined
  )
  if (!prompt || !entry) {
    return null
  }
  return (
    <BookWorkspaceDialogBody
      key={`${prompt.entryId}:${prompt.next}`}
      entry={entry}
      prompt={prompt}
    />
  )
}
