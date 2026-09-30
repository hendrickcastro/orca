# Multi-repository tasks

Use the folder-plus button at the bottom of the sidebar (**New multi-repository
task**) to coordinate a feature, bug fix, refactor or maintenance task across two
or more local Git repositories.

1. Add each repository to Orca using the existing repository import flow. Their
   folders can be on different drives or in unrelated directories.
2. Open **New multi-repository task** and select the repositories.
3. Pick the task type, enter a name and the request. The branch is suggested from
   the type and name (`feature/`, `fix/`, `refactor/`, `chore/`) until you edit it.
4. Select **Create and start Claude**.

## References with @

Typing `@` in the request lists what Claude can use, each tagged with the
repository it belongs to or **Global**:

- **Skills** from `skills.discover` for each repository (repository, home and
  Claude plugin skills usable by Claude).
- **MCP servers** from each repository's MCP files (`.mcp.json`, `.claude/mcp.json`,
  …), from Claude's user scope in `~/.claude.json`, and from that file's local
  scope for each repository.
- **Docs**: Markdown files in each repository.
- **Files** in each repository, fuzzy-ranked once you type a query.

`@skill:` and `@mcp:` narrow the list. Picking an entry inserts a token such as
`@backend/docs/api.md`. When the task starts, each token still in the request is
listed at the end of Claude's prompt with its resolved location. Repository paths
point at the new worktrees, not the original checkouts. MCP entries are only
hints: a repository-scoped server is connected only if Claude loads that config
in the session.

Orca creates a worktree in each repository using that repository's configured
base ref. A folder workspace groups the task through existing workspace
lineage. The coordinator starts in the first feature worktree, with Claude
`--add-dir` arguments for all task worktrees. Its initial request includes the
exact paths and asks it to inspect API producers and consumers together before
changing a shared contract. This provides shared context; integration tests are
still needed to establish that the result works.

Each child worktree retains Orca's existing repository-specific diff, terminal,
commit and review workflows. Commits, pushes and pull requests stay separate.
The original repository folders are not moved. Setup scripts are skipped by this
creator; run any required dependency setup in the new worktrees.

## Recovery and scope

Confirmed worktrees are retained if a later step fails. **Retry remaining steps**
reuses the successful steps while the dialog stays open. Closing the dialog or
restarting Orca keeps the persisted worktrees and workspace notes, but does not
restore the in-memory retry operation. Inspect those worktrees before creating
the task again. The notes contain the coordinator request and worktree paths.

This first version supports local repositories and the Claude terminal agent.
It rejects SSH, remote runtime and WSL repositories. It does not provide a
combined multi-root file explorer or atomic commits across repositories.

## Validation

Focused tests cover creation and retry behavior, the dialog and its `@` references, literal launch
arguments for PowerShell/cmd/POSIX, a real POSIX shell, and isolation of edits in
two real Git repositories. They do not exercise a real Claude session or the
Electron application on Windows.
