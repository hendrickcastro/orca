# Multi-repository features

Use the folder-plus button at the bottom of the sidebar (**New multi-repository
feature**) to coordinate a feature across two or more local Git repositories.

1. Add each repository to Orca using the existing repository import flow. Their
   folders can be on different drives or in unrelated directories.
2. Open **New multi-repository feature** and select the repositories.
3. Enter a feature name, a new branch name and the implementation request.
4. Select **Create and start Claude**.

Orca creates a worktree in each repository using that repository's configured
base ref. A folder workspace groups the feature through existing workspace
lineage. The coordinator starts in the first feature worktree, with Claude
`--add-dir` arguments for all feature worktrees. Its initial request includes the
exact paths and asks it to inspect API producers and consumers together before
changing their contract. This provides shared context; integration tests are
still needed to establish that the resulting feature works.

Each child worktree retains Orca's existing repository-specific diff, terminal,
commit and review workflows. Commits, pushes and pull requests stay separate.
The original repository folders are not moved. Setup scripts are skipped by this
creator; run any required dependency setup in the new worktrees.

## Recovery and scope

Confirmed worktrees are retained if a later step fails. **Retry remaining steps**
reuses the successful steps while the dialog stays open. Closing the dialog or
restarting Orca keeps the persisted worktrees and workspace notes, but does not
restore the in-memory retry operation. Inspect those worktrees before creating
the feature again. The notes contain the coordinator request and worktree paths.

This first version supports local repositories and the Claude terminal agent.
It rejects SSH, remote runtime and WSL repositories. It does not provide a
combined multi-root file explorer or atomic commits across repositories.

## Validation

Focused tests cover creation and retry behavior, the dialog, literal launch
arguments for PowerShell/cmd/POSIX, a real POSIX shell, and isolation of edits in
two real Git repositories. They do not exercise a real Claude session or the
Electron application on Windows.
