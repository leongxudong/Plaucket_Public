import { useEffect, useMemo, useState } from 'react'
import { analyzeTranscript, getAccessToken, getGatewayStatus, saveToCloud, setAccessToken, transcribeAudio } from './lib/api'
import { bundleToJson, bundleToText, downloadText, exportFilename, reportToMarkdown } from './lib/exports'
import { formatBytes, formatDuration, safeFilename } from './lib/time'
import { useRecorder } from './hooks/useRecorder'
import type { AppStep, GatewayStatus, Marker, MeetingMetadata, MeetingReport, StoredRecording, TranscriptResult } from './types'

const initialMetadata = (): MeetingMetadata => ({
  title: '',
  topic: '',
  participantCount: 2,
  participantNames: '',
  language: '',
  tags: '',
  startedAt: new Date().toISOString(),
})

type IconName = 'mic' | 'pause' | 'play' | 'stop' | 'marker' | 'download' | 'sparkle' | 'cloud' | 'settings' | 'lock' | 'back' | 'check' | 'file'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    play: <path d="m8 5 11 7-11 7V5Z"/>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2"/>,
    marker: <><path d="M12 22s7-5.3 7-13a7 7 0 1 0-14 0c0 7.7 7 13 7 13Z"/><circle cx="12" cy="9" r="2"/></>,
    download: <><path d="M12 3v12m0 0 5-5m-5 5-5-5M5 21h14"/></>,
    sparkle: <><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    cloud: <path d="M17.5 19H7a5 5 0 1 1 1.2-9.85A6 6 0 0 1 19.8 11 4 4 0 0 1 17.5 19Z"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    back: <path d="m15 18-6-6 6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    file: <><path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return <span className="status-pill"><span className={ok ? 'dot ok' : 'dot'} />{label}</span>
}

function App() {
  const [step, setStep] = useState<AppStep>('setup')
  const [metadata, setMetadata] = useState<MeetingMetadata>(initialMetadata)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [markerLabel, setMarkerLabel] = useState('')
  const [gateway, setGateway] = useState<GatewayStatus | null>(null)
  const [gatewayError, setGatewayError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tokenDraft, setTokenDraft] = useState(getAccessToken)
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null)
  const [report, setReport] = useState<MeetingReport | null>(null)
  const [busy, setBusy] = useState<'transcribe' | 'analyze' | 'cloud' | null>(null)
  const [actionError, setActionError] = useState('')
  const [stored, setStored] = useState<StoredRecording | null>(null)
  const recorder = useRecorder()

  const audioUrl = useMemo(() => recorder.audioBlob ? URL.createObjectURL(recorder.audioBlob) : '', [recorder.audioBlob])
  const audioExtension = recorder.audioBlob?.type.includes('mp4') ? 'm4a' : 'webm'
  const audioFilename = `${safeFilename(metadata.title)}-${metadata.startedAt.slice(0, 10)}.${audioExtension}`
  const exportBundle = { metadata, markers, transcript, report }

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  useEffect(() => {
    getGatewayStatus()
      .then((status) => { setGateway(status); setGatewayError('') })
      .catch(() => setGatewayError('Gateway offline — recording and local downloads still work.'))
  }, [])

  useEffect(() => {
    if (recorder.audioBlob && step === 'recording') setStep('review')
  }, [recorder.audioBlob, step])

  const updateMetadata = <K extends keyof MeetingMetadata>(key: K, value: MeetingMetadata[K]) => {
    setMetadata((current) => ({ ...current, [key]: value }))
  }

  const beginMeeting = async () => {
    if (!metadata.title.trim()) return
    setMetadata((current) => ({ ...current, startedAt: new Date().toISOString() }))
    setMarkers([])
    setTranscript(null)
    setReport(null)
    setStored(null)
    setStep('recording')
    await recorder.start()
  }

  const addMarker = () => {
    setMarkers((current) => [...current, {
      id: crypto.randomUUID(),
      seconds: recorder.elapsedSeconds,
      label: markerLabel.trim() || `Marker ${current.length + 1}`,
      createdAt: new Date().toISOString(),
    }])
    setMarkerLabel('')
  }

  const downloadAudio = () => {
    if (!audioUrl) return
    const anchor = document.createElement('a')
    anchor.href = audioUrl
    anchor.download = audioFilename
    anchor.click()
  }

  const runTranscription = async () => {
    if (!recorder.audioBlob) return
    setBusy('transcribe')
    setActionError('')
    try {
      const result = await transcribeAudio(recorder.audioBlob, audioFilename, metadata)
      setTranscript(result)
      setReport(null)
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Transcription failed.')
    } finally {
      setBusy(null)
    }
  }

  const runAnalysis = async () => {
    if (!transcript) return
    setBusy('analyze')
    setActionError('')
    try {
      setReport(await analyzeTranscript(transcript, metadata, markers))
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Report generation failed.')
    } finally {
      setBusy(null)
    }
  }

  const uploadCloud = async () => {
    if (!recorder.audioBlob) return
    setBusy('cloud')
    setActionError('')
    try {
      setStored(await saveToCloud(recorder.audioBlob, audioFilename, metadata, markers, transcript, report))
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Cloud upload failed.')
    } finally {
      setBusy(null)
    }
  }

  const newMeeting = () => {
    recorder.reset()
    setMetadata(initialMetadata())
    setMarkers([])
    setTranscript(null)
    setReport(null)
    setStored(null)
    setActionError('')
    setStep('setup')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={step === 'setup' ? undefined : newMeeting} aria-label="Plaucket home">
          <span className="brand-mark">P</span>
          <span>Plaucket</span>
          <span className="version">v0.1</span>
        </button>
        <div className="topbar-actions">
          <span className="privacy-badge"><Icon name="lock" size={16} /> Local first</span>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Icon name="settings" /></button>
        </div>
      </header>

      <main>
        {step === 'setup' && (
          <section className="setup-layout">
            <div className="hero-copy">
              <p className="eyebrow"><span /> Your meeting. Your infrastructure.</p>
              <h1>Record freely.<br /><em>Keep control.</em></h1>
              <p className="hero-subtitle">A private meeting recorder that turns conversations into useful notes—without a mandatory account, locked cloud, or recurring subscription.</p>
              <div className="trust-row">
                <div><Icon name="lock" /><span><strong>Local by default</strong><small>Audio stays in this browser until you choose otherwise.</small></span></div>
                <div><Icon name="sparkle" /><span><strong>Bring your own AI</strong><small>Your self-hosted gateway, your OpenAI account.</small></span></div>
                <div><Icon name="cloud" /><span><strong>Your cloud</strong><small>Optional private Cloudflare R2 storage.</small></span></div>
              </div>
            </div>

            <form className="meeting-card" onSubmit={(event) => { event.preventDefault(); void beginMeeting() }}>
              <div className="card-heading">
                <div><p className="step-label">New recording</p><h2>Set the context</h2></div>
                <span className="step-number">01</span>
              </div>
              <label>
                <span>Meeting title <b>*</b></span>
                <input autoFocus value={metadata.title} onChange={(event) => updateMetadata('title', event.target.value)} placeholder="e.g. Q4 security roadmap" required maxLength={120} />
              </label>
              <label>
                <span>Topic or objective</span>
                <textarea value={metadata.topic} onChange={(event) => updateMetadata('topic', event.target.value)} placeholder="What should the report pay attention to?" rows={3} maxLength={500} />
              </label>
              <div className="form-grid">
                <label>
                  <span>People</span>
                  <input type="number" min="1" max="100" value={metadata.participantCount} onChange={(event) => updateMetadata('participantCount', Number(event.target.value))} />
                </label>
                <label>
                  <span>Language</span>
                  <select value={metadata.language} onChange={(event) => updateMetadata('language', event.target.value)}>
                    <option value="">Auto-detect</option>
                    <option value="en">English</option>
                    <option value="zh">Chinese</option>
                    <option value="ms">Malay</option>
                    <option value="ta">Tamil</option>
                    <option value="id">Indonesian</option>
                  </select>
                </label>
              </div>
              <label>
                <span>Names or important vocabulary</span>
                <input value={metadata.participantNames} onChange={(event) => updateMetadata('participantNames', event.target.value)} placeholder="Names, acronyms, product terms…" maxLength={300} />
              </label>
              <label>
                <span>Tags</span>
                <input value={metadata.tags} onChange={(event) => updateMetadata('tags', event.target.value)} placeholder="security, weekly, project-x" maxLength={200} />
              </label>
              <button className="primary-button large" type="submit" disabled={!metadata.title.trim()}><Icon name="mic" /> Start recording</button>
              <p className="consent-note">Confirm everyone has consented to being recorded before you start.</p>
            </form>
          </section>
        )}

        {step === 'recording' && (
          <section className="studio-layout">
            <div className="studio-main">
              <div className="recording-heading">
                <div><p className="eyebrow live"><span /> {recorder.state === 'paused' ? 'Recording paused' : 'Recording locally'}</p><h1>{metadata.title}</h1><p>{metadata.topic || 'No objective added'}</p></div>
                <button className="text-button" onClick={newMeeting}><Icon name="back" size={18} /> Discard</button>
              </div>
              <div className={`recorder-stage ${recorder.state}`}>
                <div className="pulse-orbit"><div className="mic-core"><Icon name="mic" size={44} /></div></div>
                <time>{formatDuration(recorder.elapsedSeconds)}</time>
                <p>{recorder.state === 'paused' ? 'Nothing is being captured' : 'Listening through your microphone'}</p>
                <div className="record-controls">
                  {recorder.state === 'recording' ? (
                    <button className="control-button" onClick={recorder.pause}><Icon name="pause" /><span>Pause</span></button>
                  ) : (
                    <button className="control-button" onClick={recorder.resume} disabled={recorder.state !== 'paused'}><Icon name="play" /><span>Resume</span></button>
                  )}
                  <button className="control-button stop" onClick={recorder.stop} disabled={!['recording', 'paused'].includes(recorder.state)}><Icon name="stop" /><span>Finish</span></button>
                </div>
                {recorder.error && <p className="error-banner">{recorder.error}</p>}
              </div>
            </div>
            <aside className="marker-panel">
              <div><p className="step-label">Live markers</p><h2>Flag the moments</h2><p>Add a note now, find the moment later.</p></div>
              <div className="marker-input"><input value={markerLabel} onChange={(event) => setMarkerLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addMarker() }} placeholder="Decision, action, follow-up…" maxLength={100} /><button onClick={addMarker} aria-label="Add marker"><Icon name="marker" /></button></div>
              <div className="marker-list">
                {markers.length === 0 ? <div className="empty-markers"><Icon name="marker" size={28} /><p>No markers yet</p></div> : markers.map((marker) => (
                  <div className="marker-row" key={marker.id}><time>{formatDuration(marker.seconds)}</time><span>{marker.label}</span></div>
                ))}
              </div>
            </aside>
          </section>
        )}

        {step === 'review' && recorder.audioBlob && (
          <section className="review-layout">
            <div className="review-heading">
              <div><p className="eyebrow"><span /> Recording complete</p><h1>{metadata.title}</h1><p>{formatDuration(recorder.elapsedSeconds)} · {formatBytes(recorder.audioBlob.size)} · {markers.length} marker{markers.length === 1 ? '' : 's'}</p></div>
              <button className="secondary-button" onClick={newMeeting}>New meeting</button>
            </div>

            <div className="audio-card">
              <div className="audio-icon"><Icon name="file" size={28} /></div>
              <audio controls src={audioUrl} />
              <button className="icon-button" onClick={downloadAudio} aria-label="Download audio"><Icon name="download" /></button>
            </div>

            {actionError && <div className="error-banner">{actionError}</div>}

            <div className="action-strip">
              <button className="primary-button" onClick={() => void runTranscription()} disabled={busy !== null || !gateway?.openaiConfigured || recorder.audioBlob.size > (gateway?.maxUploadBytes || 25_000_000)}>
                <Icon name="sparkle" /> {busy === 'transcribe' ? 'Transcribing…' : transcript ? 'Transcribe again' : 'Transcribe with OpenAI'}
              </button>
              <button className="secondary-button" onClick={() => void uploadCloud()} disabled={busy !== null || !gateway || gateway.storage === 'none'}>
                <Icon name="cloud" /> {busy === 'cloud' ? 'Saving…' : stored ? 'Saved to your cloud' : 'Save to your cloud'}
              </button>
              {recorder.audioBlob.size > (gateway?.maxUploadBytes || 25_000_000) && <span className="limit-warning">Audio exceeds the transcription limit. Download it locally.</span>}
            </div>

            <div className="results-grid">
              <article className="result-card transcript-card">
                <div className="result-heading"><div><p className="step-label">Transcript</p><h2>What was said</h2></div>{transcript && <span className="complete-chip"><Icon name="check" size={14} /> Ready</span>}</div>
                {transcript ? (
                  <>
                    <textarea className="transcript-editor" aria-label="Editable transcript" value={transcript.text} onChange={(event) => setTranscript({ ...transcript, text: event.target.value })} />
                    <div className="result-footer"><span>{transcript.text.split(/\s+/).filter(Boolean).length} words · {transcript.model}</span><button className="secondary-button compact" onClick={() => void runAnalysis()} disabled={busy !== null}><Icon name="sparkle" /> {busy === 'analyze' ? 'Generating…' : report ? 'Regenerate report' : 'Generate report'}</button></div>
                  </>
                ) : (
                  <div className="empty-result"><Icon name="file" size={32} /><h3>No transcript yet</h3><p>Connect the gateway and transcribe when you are ready. The recording remains local until then.</p></div>
                )}
              </article>

              <article className="result-card report-card">
                <div className="result-heading"><div><p className="step-label">AI report</p><h2>Meeting brief</h2></div>{report && <span className="complete-chip"><Icon name="check" size={14} /> Ready</span>}</div>
                {report ? <ReportView report={report} /> : <div className="empty-result"><Icon name="sparkle" size={32} /><h3>Your report will appear here</h3><p>Review the transcript first, then generate decisions, actions, risks, and open questions.</p></div>}
              </article>
            </div>

            <div className="export-card">
              <div><p className="step-label">Take it with you</p><h2>Export your meeting</h2><p>Open formats. No lock-in.</p></div>
              <div className="export-buttons">
                <button onClick={downloadAudio}><Icon name="download" /> Audio</button>
                <button onClick={() => downloadText(reportToMarkdown(exportBundle), exportFilename(metadata.title, 'md'), 'text/markdown')}><Icon name="download" /> Markdown</button>
                <button onClick={() => downloadText(bundleToText(exportBundle), exportFilename(metadata.title, 'txt'), 'text/plain')}><Icon name="download" /> TXT</button>
                <button onClick={() => downloadText(bundleToJson(exportBundle), exportFilename(metadata.title, 'json'), 'application/json')}><Icon name="download" /> JSON</button>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer>
        <span>Open source · Self-hosted · No telemetry</span>
        <div>{gateway ? <><StatusDot ok={gateway.openaiConfigured} label={gateway.openaiConfigured ? 'OpenAI ready' : 'OpenAI not configured'} /><StatusDot ok={gateway.storage !== 'none'} label={gateway.storage === 'r2' ? 'R2 connected' : gateway.storage === 'local' ? 'Local server storage' : 'Cloud not configured'} /></> : <span className="muted">{gatewayError || 'Checking gateway…'}</span>}</div>
      </footer>

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><p className="step-label">Gateway</p><h2 id="settings-title">Connection settings</h2></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button></div>
            <p>Enter the access token configured on your own Plaucket gateway. It is kept in this tab's session storage and is never built into the app.</p>
            <label><span>Gateway access token</span><input type="password" autoComplete="off" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} placeholder="PLAUCKET_ACCESS_TOKEN" /></label>
            <div className="settings-status">
              <div><span>OpenAI</span><strong>{gateway?.openaiConfigured ? gateway.transcriptionModel : 'Not configured'}</strong></div>
              <div><span>Analysis</span><strong>{gateway?.openaiConfigured ? gateway.analysisModel : 'Not configured'}</strong></div>
              <div><span>Storage</span><strong>{gateway?.storage === 'r2' ? 'Cloudflare R2' : gateway?.storage === 'local' ? 'Local server' : 'Not configured'}</strong></div>
            </div>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button" onClick={() => { setAccessToken(tokenDraft.trim()); setSettingsOpen(false) }}>Save for this session</button></div>
          </section>
        </div>
      )}
    </div>
  )
}

function ReportView({ report }: { report: MeetingReport }) {
  return (
    <div className="report-content">
      <p className="report-summary">{report.summary}</p>
      <ReportList title="Key points" items={report.keyPoints} />
      <ReportList title="Decisions" items={report.decisions} />
      <div className="report-section"><h3>Action items</h3>{report.actionItems.length ? report.actionItems.map((item, index) => <div className="action-item" key={`${item.task}-${index}`}><span className="checkbox" /><div><p>{item.task}</p><small>{[item.owner && `Owner: ${item.owner}`, item.dueDate && `Due: ${item.dueDate}`].filter(Boolean).join(' · ') || 'Owner and due date not stated'}</small></div></div>) : <p className="muted">None recorded</p>}</div>
      <ReportList title="Risks & blockers" items={report.risks} />
      <ReportList title="Open questions" items={report.openQuestions} />
    </div>
  )
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return <div className="report-section"><h3>{title}</h3>{items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="muted">None recorded</p>}</div>
}

export default App
