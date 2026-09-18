import { describe, expect, it } from 'vitest'
import { getStatus, isAuthorized, MAX_AUDIO_BYTES } from '../shared/gateway'

describe('gateway security', () => {
  it('allows an unprotected self-hosted gateway', async () => {
    expect(await isAuthorized(new Request('https://example.test/api/analyze'))).toBe(true)
  })

  it('requires the exact configured token', async () => {
    const valid = new Request('https://example.test/api/analyze', { headers: { 'X-Plaucket-Token': 'correct-horse' } })
    const invalid = new Request('https://example.test/api/analyze', { headers: { 'X-Plaucket-Token': 'wrong-battery' } })
    expect(await isAuthorized(valid, 'correct-horse')).toBe(true)
    expect(await isAuthorized(invalid, 'correct-horse')).toBe(false)
  })

  it('does not reveal API credentials in status', () => {
    const status = getStatus({
      openaiApiKey: 'sk-secret',
      accessToken: 'also-secret',
      transcriptionModel: 'transcribe-test',
      analysisModel: 'analysis-test',
      storageName: 'r2',
    })
    expect(status.openaiConfigured).toBe(true)
    expect(status.requiresAccessToken).toBe(true)
    expect(JSON.stringify(status)).not.toContain('sk-secret')
    expect(status.maxUploadBytes).toBe(MAX_AUDIO_BYTES)
  })
})
