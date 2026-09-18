import type { Marker, MeetingMetadata, MeetingReport, TranscriptResult } from '../types'
import { formatDuration, safeFilename } from './time'

type ExportBundle = {
  metadata: MeetingMetadata
  markers: Marker[]
  transcript: TranscriptResult | null
  report: MeetingReport | null
}

function list(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- None recorded'
}

export function reportToMarkdown(bundle: ExportBundle): string {
  const { metadata, markers, transcript, report } = bundle
  const markerText = markers.length
    ? markers.map((marker) => `- **${formatDuration(marker.seconds)}** — ${marker.label}`).join('\n')
    : '- No markers'
  const actionItems = report?.actionItems.length
    ? report.actionItems
        .map((item) => `- [ ] ${item.task}${item.owner ? ` — **Owner:** ${item.owner}` : ''}${item.dueDate ? ` — **Due:** ${item.dueDate}` : ''}`)
        .join('\n')
    : '- None recorded'

  return `# ${report?.title || metadata.title}\n\n` +
    `> ${metadata.topic || 'Meeting notes'}\n\n` +
    `- **Started:** ${new Date(metadata.startedAt).toLocaleString()}\n` +
    `- **Participants:** ${metadata.participantCount}${metadata.participantNames ? ` (${metadata.participantNames})` : ''}\n` +
    `- **Language:** ${metadata.language || 'Auto-detect'}\n` +
    `- **Tags:** ${metadata.tags || 'None'}\n\n` +
    `## Summary\n\n${report?.summary || 'No AI report generated.'}\n\n` +
    `## Key points\n\n${list(report?.keyPoints || [])}\n\n` +
    `## Decisions\n\n${list(report?.decisions || [])}\n\n` +
    `## Action items\n\n${actionItems}\n\n` +
    `## Risks and blockers\n\n${list(report?.risks || [])}\n\n` +
    `## Open questions\n\n${list(report?.openQuestions || [])}\n\n` +
    `## Markers\n\n${markerText}\n\n` +
    `## Transcript\n\n${transcript?.text || 'No transcript generated.'}\n`
}

export function bundleToJson(bundle: ExportBundle): string {
  return JSON.stringify({ schemaVersion: '1.0', exportedAt: new Date().toISOString(), ...bundle }, null, 2)
}

export function bundleToText(bundle: ExportBundle): string {
  return reportToMarkdown(bundle)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/^- \[ \] /gm, '- ')
    .replace(/^> /gm, '')
}

export function downloadText(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function exportFilename(title: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `${safeFilename(title)}-${date}.${extension}`
}
