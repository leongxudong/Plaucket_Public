export type MeetingMetadata = {
  title: string
  topic: string
  participantCount: number
  participantNames: string
  language: string
  tags: string
  startedAt: string
}

export type Marker = {
  id: string
  seconds: number
  label: string
  createdAt: string
}

export type ActionItem = {
  task: string
  owner: string | null
  dueDate: string | null
}

export type MeetingReport = {
  title: string
  summary: string
  keyPoints: string[]
  decisions: string[]
  actionItems: ActionItem[]
  risks: string[]
  openQuestions: string[]
  generatedAt: string
  model: string
}

export type GatewayStatus = {
  app: string
  version: string
  openaiConfigured: boolean
  storage: 'r2' | 'local' | 'none'
  requiresAccessToken: boolean
  transcriptionModel: string
  analysisModel: string
  maxUploadBytes: number
}

export type TranscriptResult = {
  text: string
  language?: string
  duration?: number
  model: string
}

export type StoredRecording = {
  id: string
  audioKey: string
  metadataKey: string
  storedAt: string
}

export type AppStep = 'setup' | 'recording' | 'review'
