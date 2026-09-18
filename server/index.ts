import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { getStatus, handleAnalyze, handleStorage, handleTranscribe, isAuthorized, securityHeaders, type GatewayConfig, type StorageAdapter } from '../shared/gateway.ts'

const port = Number(process.env.PORT || 8788)
const storagePath = process.env.LOCAL_STORAGE_PATH ? resolve(process.env.LOCAL_STORAGE_PATH) : ''

const config: GatewayConfig = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  accessToken: process.env.PLAUCKET_ACCESS_TOKEN,
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
  analysisModel: process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini',
  storageName: storagePath ? 'local' : 'none',
}

const localStorage: StorageAdapter | undefined = storagePath ? {
  async putRecording({ id, file, bundle, extension }) {
    const date = new Date().toISOString().slice(0, 10)
    const relativeDirectory = join('recordings', date, id)
    const directory = join(storagePath, relativeDirectory)
    await mkdir(directory, { recursive: true })
    const audioRelative = join(relativeDirectory, `audio.${extension}`)
    const metadataRelative = join(relativeDirectory, 'meeting.json')
    await Promise.all([
      writeFile(join(storagePath, audioRelative), Buffer.from(await file.arrayBuffer()), { flag: 'wx' }),
      writeFile(join(storagePath, metadataRelative), bundle, { encoding: 'utf8', flag: 'wx' }),
    ])
    return {
      id,
      audioKey: audioRelative.replaceAll('\\', '/'),
      metadataKey: metadataRelative.replaceAll('\\', '/'),
      storedAt: new Date().toISOString(),
    }
  },
} : undefined

const app = new Hono()

app.use('*', async (context, next) => {
  await next()
  for (const [name, value] of Object.entries(securityHeaders)) context.header(name, value)
})

app.get('/api/status', (context) => context.json(getStatus(config)))
app.use('/api/*', async (context, next) => {
  if (!await isAuthorized(context.req.raw, config.accessToken)) return context.json({ error: 'Invalid or missing gateway access token.' }, 401)
  await next()
})
app.post('/api/transcribe', (context) => handleTranscribe(context.req.raw, config))
app.post('/api/analyze', (context) => handleAnalyze(context.req.raw, config))
app.post('/api/storage/recordings', (context) => handleStorage(context.req.raw, localStorage))
app.all('/api/*', (context) => context.json({ error: 'API route not found.' }, 404))
app.use('*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(`Plaucket listening on http://localhost:${info.port}\n`)
})
