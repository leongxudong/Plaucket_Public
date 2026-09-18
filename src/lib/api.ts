import type { GatewayStatus, Marker, MeetingMetadata, MeetingReport, StoredRecording, TranscriptResult } from '../types'

const TOKEN_KEY = 'plaucket-access-token'

export function getAccessToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

export function setAccessToken(token: string): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAccessToken()
  if (token) headers.set('X-Plaucket-Token', token)
  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message)
  }
  return response
}

export async function getGatewayStatus(): Promise<GatewayStatus> {
  const response = await apiFetch('/api/status')
  return response.json() as Promise<GatewayStatus>
}

export async function transcribeAudio(
  audio: Blob,
  filename: string,
  metadata: MeetingMetadata,
): Promise<TranscriptResult> {
  const form = new FormData()
  form.set('file', audio, filename)
  if (metadata.language) form.set('language', metadata.language)
  const context = [metadata.topic, metadata.participantNames && `Participants: ${metadata.participantNames}`]
    .filter(Boolean)
    .join('. ')
  if (context) form.set('prompt', context)
  const response = await apiFetch('/api/transcribe', { method: 'POST', body: form })
  return response.json() as Promise<TranscriptResult>
}

export async function analyzeTranscript(
  transcript: TranscriptResult,
  metadata: MeetingMetadata,
  markers: Marker[],
): Promise<MeetingReport> {
  const response = await apiFetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: transcript.text, metadata, markers }),
  })
  return response.json() as Promise<MeetingReport>
}

export async function saveToCloud(
  audio: Blob,
  filename: string,
  metadata: MeetingMetadata,
  markers: Marker[],
  transcript: TranscriptResult | null,
  report: MeetingReport | null,
): Promise<StoredRecording> {
  const form = new FormData()
  form.set('file', audio, filename)
  form.set('bundle', JSON.stringify({ metadata, markers, transcript, report }))
  const response = await apiFetch('/api/storage/recordings', { method: 'POST', body: form })
  return response.json() as Promise<StoredRecording>
}
