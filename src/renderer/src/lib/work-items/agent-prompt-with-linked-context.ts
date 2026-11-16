/** Appends attachments, linked work-item URLs and contained linked context to a startup prompt. */
export function buildAgentPromptWithContext(
  prompt: string,
  attachments: string[],
  linkedUrls: string[],
  linkedContextBlocks: string[] = []
): string {
  const trimmedPrompt = prompt.trim()
  if (attachments.length === 0 && linkedUrls.length === 0 && linkedContextBlocks.length === 0) {
    return trimmedPrompt
  }

  const sections: string[] = []
  if (attachments.length > 0) {
    const attachmentBlock = attachments.map((pathValue) => `- ${pathValue}`).join('\n')
    sections.push(`Attachments:\n${attachmentBlock}`)
  }
  if (linkedUrls.length > 0) {
    const linkBlock = linkedUrls.map((url) => `- ${url}`).join('\n')
    sections.push(`Linked work items:\n${linkBlock}`)
  }
  if (linkedContextBlocks.length > 0) {
    sections.push(linkedContextBlocks.join('\n\n'))
  }
  // Why: agents launch with a single plain-text startup prompt, so extra data rides after it.
  if (!trimmedPrompt) {
    return sections.join('\n\n')
  }
  return `${trimmedPrompt}\n\n${sections.join('\n\n')}`
}
