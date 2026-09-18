import { Hono } from 'hono'
import { getStatus, handleAnalyze, handleStorage, handleTranscribe, isAuthorized, json, securityHeaders, type GatewayConfig, type StorageAdapter } from '../shared/gateway.ts'

type Bindings = {
  ASSETS: Fetcher
  RECORDINGS_BUCKET?: R2Bucket
  OPENAI_API_KEY?: string
  PLAUCKET_ACCESS_TOKEN?: string
  OPENAI_TRANSCRIPTION_MODEL?: string
  OPENAI_ANALYSIS_MODEL?: string
}

const app = new Hono<{ Bindings: Bindings }>()

function config(env: Bindings): GatewayConfig {
  return {
    openaiApiKey: env.OPENAI_API_KEY,
    accessToken: env.PLAUCKET_ACCESS_TOKEN,
    transcriptionModel: env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
    analysisModel: env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini',
    storageName: env.RECORDINGS_BUCKET ? 'r2' : 'none',
  }
}

function r2Storage(bucket?: R2Bucket): StorageAdapter | undefined {
  if (!bucket) return undefined
  return {
    async putRecording({ id, file, bundle, contentType, extension }) {
      const date = new Date().toISOString().slice(0, 10)
      const prefix = `recordings/${date}/${id}`
      const audioKey = `${prefix}/audio.${extension}`
      const metadataKey = `${prefix}/meeting.json`
      await Promise.all([
        bucket.put(audioKey, file.stream(), {
          httpMetadata: { contentType },
          customMetadata: { plaucketVersion: '0.1.0' },
        }),
        bucket.put(metadataKey, bundle, {
          httpMetadata: { contentType: 'application/json; charset=utf-8' },
          customMetadata: { plaucketVersion: '0.1.0' },
        }),
      ])
      return { id, audioKey, metadataKey, storedAt: new Date().toISOString() }
    },
  }
}

app.use('*', async (context, next) => {
  await next()
  for (const [name, value] of Object.entries(securityHeaders)) context.header(name, value)
})

app.get('/api/status', (context) => context.json(getStatus(config(context.env))))

app.use('/api/*', async (context, next) => {
  if (!await isAuthorized(context.req.raw, context.env.PLAUCKET_ACCESS_TOKEN)) return context.json({ error: 'Invalid or missing gateway access token.' }, 401)
  await next()
})

app.post('/api/transcribe', (context) => handleTranscribe(context.req.raw, config(context.env)))
app.post('/api/analyze', (context) => handleAnalyze(context.req.raw, config(context.env)))
app.post('/api/storage/recordings', (context) => handleStorage(context.req.raw, r2Storage(context.env.RECORDINGS_BUCKET)))
app.all('/api/*', () => json({ error: 'API route not found.' }, 404))
app.all('*', (context) => context.env.ASSETS.fetch(context.req.raw))

export default app
