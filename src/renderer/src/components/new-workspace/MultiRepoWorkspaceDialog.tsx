import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import RepoMultiCombobox from '@/components/ui/repo-multi-combobox'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import {
  isMultiRepoLocalRepository,
  MultiRepoWorkspaceCreation
} from '@/lib/multi-repo-workspace-creation'
import { launchMultiRepoCoordinator } from '@/lib/multi-repo-coordinator-launch'

export default function MultiRepoWorkspaceDialog({
  onClose
}: {
  onClose: () => void
}): React.JSX.Element {
  const repos = useAppStore((state) => state.repos)
  const eligibleRepos = repos.filter(isMultiRepoLocalRepository)
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(eligibleRepos.slice(0, 2).map((repo) => repo.id))
  )
  const [name, setName] = useState('')
  const [branch, setBranch] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const creationRef = useRef<MultiRepoWorkspaceCreation | null>(null)
  const submittingRef = useRef(false)
  const [started, setStarted] = useState(false)

  const submit = async (): Promise<void> => {
    if (submittingRef.current) {
      return
    }
    submittingRef.current = true
    setBusy(true)
    setError(null)
    try {
      creationRef.current ??= new MultiRepoWorkspaceCreation({
        name,
        branch,
        prompt,
        repos: eligibleRepos.filter((repo) => selected.has(repo.id))
      })
      setStarted(true)
      await creationRef.current.create(window.api, setProgress)
      await launchMultiRepoCoordinator(creationRef.current, useAppStore.getState().settings)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      submittingRef.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose()
        }
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(event) => {
          if (busy) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{translate('multiRepo.title', 'New multi-repository feature')}</DialogTitle>
          <DialogDescription>
            {translate(
              'multiRepo.description',
              'Create a worktree in each selected repository and open one Claude coordinator for the feature. Repository folders stay where they are.'
            )}
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy || started} className="min-w-0 space-y-3">
          <div className="space-y-2">
            <Label>{translate('multiRepo.repositories', 'Repositories')}</Label>
            <RepoMultiCombobox
              repos={eligibleRepos}
              selected={selected}
              onChange={setSelected}
              onSelectAll={() => setSelected(new Set(eligibleRepos.map((repo) => repo.id)))}
            />
            <p className="text-xs text-muted-foreground">
              {translate(
                'multiRepo.localOnly',
                'Choose at least two Git repositories on this computer. SSH, remote servers and WSL are not supported in this version.'
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="multi-repo-name">{translate('multiRepo.name', 'Feature name')}</Label>
            <Input
              id="multi-repo-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Patient search"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="multi-repo-branch">
              {translate('multiRepo.branch', 'New branch in every repository')}
            </Label>
            <Input
              id="multi-repo-branch"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder="feature/patient-search"
            />
            <p className="text-xs text-muted-foreground">
              {translate(
                'multiRepo.base',
                'Each repository uses its configured base ref. Setup scripts are skipped; commits and pull requests remain separate.'
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="multi-repo-prompt">
              {translate('multiRepo.prompt', 'What should Claude implement?')}
            </Label>
            <Textarea
              id="multi-repo-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
            />
          </div>
        </fieldset>
        {busy && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {progress}
          </p>
        )}
        {error && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{error}</p>
            {started && (
              <p>
                {translate(
                  'multiRepo.recovery',
                  'Confirmed worktrees are kept. Retry continues this creation; closing keeps the partial workspace for inspection in Orca.'
                )}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            {translate('multiRepo.close', 'Close')}
          </Button>
          <Button
            disabled={
              busy ||
              (!started && (selected.size < 2 || !name.trim() || !branch.trim() || !prompt.trim()))
            }
            onClick={() => void submit()}
          >
            {started
              ? translate('multiRepo.retry', 'Retry remaining steps')
              : translate('multiRepo.create', 'Create and start Claude')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
