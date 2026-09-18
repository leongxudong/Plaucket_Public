import { useCallback, useEffect, useRef, useState } from 'react'

type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped'

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm',
]

function chooseMimeType(): string | undefined {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

export function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const accumulatedRef = useRef(0)
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state !== 'recording') return
    const update = () => setElapsedSeconds((accumulatedRef.current + performance.now() - startedAtRef.current) / 1000)
    update()
    const timer = window.setInterval(update, 250)
    return () => window.clearInterval(timer)
  }, [state])

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => stopTracks(), [stopTracks])

  const start = useCallback(async () => {
    setError(null)
    setAudioBlob(null)
    chunksRef.current = []
    accumulatedRef.current = 0
    setElapsedSeconds(0)
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('This browser does not support microphone recording. Try current Chrome, Edge, or Safari.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      streamRef.current = stream
      const mimeType = chooseMimeType()
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 48_000,
      })
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => setError('The browser recorder encountered an error.')
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        setAudioBlob(new Blob(chunksRef.current, { type }))
        stopTracks()
        setState('stopped')
      }
      recorder.start(1_000)
      startedAtRef.current = performance.now()
      setState('recording')
    } catch (caught) {
      stopTracks()
      setState('idle')
      setError(caught instanceof Error ? caught.message : 'Microphone access failed.')
    }
  }, [stopTracks])

  const pause = useCallback(() => {
    if (recorderRef.current?.state !== 'recording') return
    recorderRef.current.pause()
    accumulatedRef.current += performance.now() - startedAtRef.current
    setElapsedSeconds(accumulatedRef.current / 1000)
    setState('paused')
  }, [])

  const resume = useCallback(() => {
    if (recorderRef.current?.state !== 'paused') return
    recorderRef.current.resume()
    startedAtRef.current = performance.now()
    setState('recording')
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    if (recorder.state === 'recording') {
      accumulatedRef.current += performance.now() - startedAtRef.current
    }
    setElapsedSeconds(accumulatedRef.current / 1000)
    recorder.stop()
  }, [])

  const reset = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    stopTracks()
    recorderRef.current = null
    chunksRef.current = []
    accumulatedRef.current = 0
    setElapsedSeconds(0)
    setAudioBlob(null)
    setError(null)
    setState('idle')
  }, [stopTracks])

  return { state, elapsedSeconds, audioBlob, error, start, pause, resume, stop, reset }
}
