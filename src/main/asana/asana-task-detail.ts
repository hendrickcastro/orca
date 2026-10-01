import type { AsanaTaskDetail, AsanaTaskDetailResult } from '../../shared/asana-task-context'
import { asanaRequest, requireAsanaToken } from './asana-client'

// Why: the agent needs the conversation, not the full history; keep the newest comments.
const MAX_COMMENTS = 20
const DETAIL_FIELDS = [
  'name',
  'notes',
  'completed',
  'due_on',
  'permalink_url',
  'assignee.name',
  'projects.name',
  'tags.name',
  'custom_fields.name',
  'custom_fields.display_value'
].join(',')

type Named = { name?: string | null }

type RawTaskDetail = {
  name?: string | null
  notes?: string | null
  completed?: boolean | null
  due_on?: string | null
  permalink_url?: string | null
  assignee?: Named | null
  projects?: Named[] | null
  tags?: Named[] | null
  custom_fields?: { name?: string | null; display_value?: string | null }[] | null
}

type RawStory = {
  type?: string | null
  text?: string | null
  created_at?: string | null
  created_by?: Named | null
}

type RawSubtask = { name?: string | null; completed?: boolean | null }

type RawAttachment = { name?: string | null; permanent_url?: string | null }

function names(values: Named[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.name ?? '').filter(Boolean)
}

export function mapAsanaTaskDetail(
  gid: string,
  raw: RawTaskDetail,
  subtasks: RawSubtask[],
  stories: RawStory[],
  attachments: RawAttachment[]
): AsanaTaskDetail {
  return {
    gid,
    name: raw.name ?? '',
    url: raw.permalink_url ?? `https://app.asana.com/0/0/${gid}`,
    notes: raw.notes ?? '',
    completed: raw.completed === true,
    assignee: raw.assignee?.name ?? null,
    dueOn: raw.due_on ?? null,
    projects: names(raw.projects),
    tags: names(raw.tags),
    customFields: (raw.custom_fields ?? [])
      .filter((field) => field.name && field.display_value)
      .map((field) => ({ name: field.name ?? '', value: field.display_value ?? '' })),
    subtasks: subtasks
      .filter((subtask) => subtask.name)
      .map((subtask) => ({ name: subtask.name ?? '', completed: subtask.completed === true })),
    comments: stories
      .filter((story) => story.type === 'comment' && story.text?.trim())
      .slice(-MAX_COMMENTS)
      .map((story) => ({
        author: story.created_by?.name ?? null,
        createdAt: story.created_at ?? null,
        text: story.text ?? ''
      })),
    attachments: attachments
      .filter((attachment) => attachment.name)
      .map((attachment) => ({ name: attachment.name ?? '', url: attachment.permanent_url ?? null }))
  }
}

export async function getAsanaTaskDetail(gid: string): Promise<AsanaTaskDetailResult> {
  try {
    const token = requireAsanaToken()
    const path = `/tasks/${encodeURIComponent(gid)}`
    const [raw, subtasks, stories, attachments] = await Promise.all([
      asanaRequest<RawTaskDetail>(token, path, { searchParams: { opt_fields: DETAIL_FIELDS } }),
      asanaRequest<RawSubtask[]>(token, `${path}/subtasks`, {
        searchParams: { opt_fields: 'name,completed', limit: 100 }
      }),
      asanaRequest<RawStory[]>(token, `${path}/stories`, {
        searchParams: { opt_fields: 'type,text,created_at,created_by.name', limit: 100 }
      }),
      asanaRequest<RawAttachment[]>(token, '/attachments', {
        searchParams: { parent: gid, opt_fields: 'name,permanent_url', limit: 100 }
      })
    ])
    return { ok: true, task: mapAsanaTaskDetail(gid, raw, subtasks, stories, attachments) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
