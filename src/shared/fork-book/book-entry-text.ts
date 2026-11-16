import type { BookEntryContext } from './book-catalog-types'

const TITLE_MAX_LENGTH = 120
const DESCRIPTION_MAX_LENGTH = 4000

/** Instant, offline title and description built from what the workspace already knows. */
export function draftBookEntryText(context: BookEntryContext): {
  title: string
  description: string
} {
  const task = context.linkedTask
  const title = (task?.title?.trim() || context.workspaceName.trim() || context.branch || '').slice(
    0,
    TITLE_MAX_LENGTH
  )
  const lines: string[] = []
  if (task) {
    lines.push(`${task.label}${task.title ? ` — ${task.title}` : ''}`)
  }
  if (context.memberWorkspaces.length > 0) {
    lines.push(
      context.memberWorkspaces
        .map((member) =>
          [member.repoName ?? member.name, member.branch].filter(Boolean).join(' · ')
        )
        .join('\n')
    )
  }
  const comment = context.comment?.trim()
  if (comment) {
    lines.push(comment)
  }
  if (context.agentTitles.length > 0) {
    lines.push(context.agentTitles.join('\n'))
  }
  return { title, description: lines.join('\n\n').slice(0, DESCRIPTION_MAX_LENGTH) }
}

/** Prompt for the background text-generation agent; the answer must be the two marked fields only. */
export function buildBookEntryPrompt(
  context: BookEntryContext,
  gitLog: string[],
  language: string
): string {
  const facts: string[] = [`Workspace: ${context.workspaceName}`]
  if (context.repoName) {
    facts.push(`Repository: ${context.repoName}`)
  }
  if (context.branch) {
    facts.push(`Branch: ${context.branch}`)
  }
  if (context.linkedTask) {
    facts.push(
      `Linked task: ${context.linkedTask.label}${context.linkedTask.title ? ` — ${context.linkedTask.title}` : ''}`
    )
  }
  for (const member of context.memberWorkspaces) {
    facts.push(
      `Member repository: ${[member.repoName ?? member.name, member.branch].filter(Boolean).join(' on ')}`
    )
  }
  if (context.comment?.trim()) {
    facts.push(`Workspace notes:\n${context.comment.trim().slice(0, 3000)}`)
  }
  if (context.agentTitles.length > 0) {
    facts.push(`Agent sessions:\n${context.agentTitles.join('\n')}`)
  }
  if (gitLog.length > 0) {
    facts.push(`Commits on the branch (newest first):\n${gitLog.join('\n')}`)
  }
  return [
    'You catalogue finished software work so it can be found again months later.',
    'From the facts below, write a short title (max 80 characters) naming what was done,',
    'and a description of 2 to 5 sentences: the goal, what changed, and where (repositories, areas).',
    `Write in the language with BCP 47 tag "${language}". Do not invent facts.`,
    'Answer with exactly two lines of this form and nothing else:',
    'TITLE: <title>',
    'DESCRIPTION: <description on one line>',
    '',
    facts.join('\n\n')
  ].join('\n')
}

/** Extracts the two fields from the agent answer; tolerates markdown and missing labels. */
export function parseBookEntryAnswer(raw: string): { title: string; description: string } | null {
  const text = raw
    .replace(/\r\n/g, '\n')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/\*\*|__/g, '')
  const title = /^\s*TITLE\s*:\s*(.+)$/im.exec(text)?.[1]?.trim()
  const description = /^\s*DESCRIPTION\s*:\s*([\s\S]+)$/im.exec(text)?.[1]?.trim()
  if (title && description) {
    return {
      title: stripWrappingQuotes(title).slice(0, TITLE_MAX_LENGTH),
      description: description.slice(0, DESCRIPTION_MAX_LENGTH)
    }
  }
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    return null
  }
  return {
    title: stripWrappingQuotes(lines[0]).slice(0, TITLE_MAX_LENGTH),
    description: lines.slice(1).join(' ').slice(0, DESCRIPTION_MAX_LENGTH)
  }
}

function stripWrappingQuotes(text: string): string {
  return text.replace(/^["'“”«]+|["'“”»]+$/g, '').trim()
}
