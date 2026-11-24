import { useEffect, useMemo, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store/index'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import type { Repo } from '../../../../shared/repository/repo-types'
import { bookBranchName, type BookMemberTarget } from './book-member-worktrees'

const BRANCH_LIST_LIMIT = 200

function targetValue(target: BookMemberTarget): string {
  if (target.kind === 'worktree') {
    return `worktree:${target.worktreeId}`
  }
  return `${target.kind}:${target.branch}`
}

function parseTargetValue(value: string): BookMemberTarget | null {
  const split = value.indexOf(':')
  const kind = value.slice(0, split)
  const rest = value.slice(split + 1)
  if (kind === 'worktree') {
    return { kind: 'worktree', worktreeId: rest }
  }
  return kind === 'branch' || kind === 'new-branch' ? { kind, branch: rest } : null
}

/** This computer's local and remote branch names for a repository, without duplicates. */
function useRepoBranches(repoId: string): string[] | null {
  const [branches, setBranches] = useState<string[] | null>(null)
  useEffect(() => {
    let current = true
    void window.api.repos
      .searchBaseRefDetails({ repoId, query: '', limit: BRANCH_LIST_LIMIT })
      .then((refs) => {
        if (current) {
          setBranches([...new Set(refs.map((ref) => ref.localBranchName).filter(Boolean))].sort())
        }
      })
      .catch(() => {
        if (current) {
          setBranches([])
        }
      })
    return () => {
      current = false
    }
  }, [repoId])
  return branches
}

/**
 * Where one repository is worked on: an existing worktree, or a branch to check out in a new one.
 * Worktrees and branches are listed apart; a branch that already has a worktree appears only there.
 */
export function BookMemberTargetSelect({
  repo,
  value,
  onChange
}: {
  repo: Repo
  value: BookMemberTarget
  onChange: (target: BookMemberTarget) => void
}): React.JSX.Element {
  const t = useTranslate()
  const worktrees = useAppStore((state) => selectWorktreesByRepo(state)[repo.id])
  const branches = useRepoBranches(repo.id)
  const checkedOut = useMemo(
    () => new Map((worktrees ?? []).map((worktree) => [bookBranchName(worktree.branch), worktree])),
    [worktrees]
  )
  const freeBranches = (branches ?? []).filter((branch) => !checkedOut.has(branch))

  // Once the branches are known, a guessed target becomes the checkout or branch that exists.
  useEffect(() => {
    if (!branches || value.kind === 'worktree') {
      return
    }
    const checkout = checkedOut.get(value.branch)
    if (checkout) {
      onChange({ kind: 'worktree', worktreeId: checkout.id })
    } else if (value.kind === 'branch' && !branches.includes(value.branch)) {
      onChange({ kind: 'new-branch', branch: value.branch })
    } else if (value.kind === 'new-branch' && branches.includes(value.branch)) {
      onChange({ kind: 'branch', branch: value.branch })
    }
  }, [branches, checkedOut, onChange, value])

  const newBranch = value.kind === 'new-branch' ? value.branch : null
  return (
    <Select
      value={targetValue(value)}
      onValueChange={(next) => {
        // Radix reports an empty value while the picked item is still mounting; ignore it.
        const target = next ? parseTargetValue(next) : null
        if (target) {
          onChange(target)
        }
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>{t('forkBook.targetWorktrees', 'Worktrees')}</SelectLabel>
          {(worktrees ?? []).map((worktree) => (
            <SelectItem key={worktree.id} value={`worktree:${worktree.id}`}>
              {bookBranchName(worktree.branch) || worktree.displayName} · {worktree.path}
            </SelectItem>
          ))}
          {(worktrees ?? []).length === 0 ? (
            <SelectItem value="none:worktrees" disabled>
              {t('forkBook.targetNoWorktrees', 'No worktrees yet')}
            </SelectItem>
          ) : null}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>
            {t('forkBook.targetBranches', 'Branches (opens a new worktree)')}
          </SelectLabel>
          {branches === null ? (
            <SelectItem value="none:loading" disabled>
              {t('forkBook.targetLoading', 'Loading branches…')}
            </SelectItem>
          ) : null}
          {value.kind === 'branch' && !freeBranches.includes(value.branch) ? (
            <SelectItem value={`branch:${value.branch}`}>{value.branch}</SelectItem>
          ) : null}
          {freeBranches.map((branch) => (
            <SelectItem key={branch} value={`branch:${branch}`}>
              {branch}
            </SelectItem>
          ))}
          {newBranch ? (
            <SelectItem value={`new-branch:${newBranch}`}>
              {t('forkBook.targetNewBranch', 'New branch {{branch}} from the default branch', {
                branch: newBranch
              })}
            </SelectItem>
          ) : null}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
