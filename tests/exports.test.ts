import { describe, expect, it } from 'vitest'
import { bundleToJson, bundleToText, reportToMarkdown } from '../src/lib/exports'
import type { MeetingReport } from '../src/types'

const report: MeetingReport = {
  title: 'Security roadmap',
  summary: 'The team agreed on the next control rollout.',
  keyPoints: ['MFA coverage is improving'],
  decisions: ['Prioritise privileged accounts'],
  actionItems: [{ task: 'Export the gap list', owner: 'Ari', dueDate: '2026-10-01' }],
  risks: [],
  openQuestions: ['Who owns the legacy tenant?'],
  generatedAt: '2026-09-18T00:00:00.000Z',
  model: 'test-model',
}

const bundle = {
  metadata: {
    title: 'Security roadmap',
    topic: 'Plan Q4',
    participantCount: 3,
    participantNames: 'Ari, Bo, Cy',
    language: 'en',
    tags: 'security',
    startedAt: '2026-09-18T00:00:00.000Z',
  },
  markers: [{ id: '1', seconds: 65, label: 'Decision', createdAt: '2026-09-18T00:01:05.000Z' }],
  transcript: { text: 'We will prioritise privileged accounts.', model: 'test-transcribe' },
  report,
}

describe('meeting exports', () => {
  it('produces useful Markdown', () => {
    const markdown = reportToMarkdown(bundle)
    expect(markdown).toContain('# Security roadmap')
    expect(markdown).toContain('**01:05** — Decision')
    expect(markdown).toContain('- [ ] Export the gap list')
  })

  it('produces portable JSON with a schema version', () => {
    const parsed = JSON.parse(bundleToJson(bundle))
    expect(parsed.schemaVersion).toBe('1.0')
    expect(parsed.report.actionItems[0].owner).toBe('Ari')
  })

  it('removes Markdown heading syntax in TXT', () => {
    const text = bundleToText(bundle)
    expect(text).toContain('Security roadmap')
    expect(text).not.toContain('# Security roadmap')
  })
})
