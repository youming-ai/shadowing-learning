import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus = 'idle' | 'recording' | 'playing' | 'unsupported' | 'denied'

export interface SentenceRecording {
  blob: Blob
  url: string
  createdAt: number
  durationMs: number | null
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

function segmentKey(segment: { start: number; end: number; id?: number }, index: number): string {
  if (segment.id != null) return `id:${segment.id}`
  return `i:${index}:${segment.start.toFixed(3)}-${segment.end.toFixed(3)}`
}

/**
 * Per-sentence MediaRecorder store for shadowing comparison.
 * Recordings live in memory only (revoked on unmount / replace).
 */
export function useSentenceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>(() => {
    if (typeof window === 'undefined') return 'idle'
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return 'unsupported'
    }
    return 'idle'
  })
  const [recordings, setRecordings] = useState<Record<string, SentenceRecording>>({})
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef<number>(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recordingKeyRef = useRef<string | null>(null)
  const recordingsRef = useRef(recordings)
  recordingsRef.current = recordings

  const stopStream = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop()
      }
    }
    streamRef.current = null
  }, [])

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setStatus((s) => (s === 'playing' ? 'idle' : s))
  }, [])

  const revokeRecording = useCallback((rec: SentenceRecording) => {
    URL.revokeObjectURL(rec.url)
  }, [])

  const clearRecording = useCallback(
    (key: string) => {
      setRecordings((prev) => {
        const existing = prev[key]
        if (existing) revokeRecording(existing)
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [revokeRecording],
  )

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') {
      mr.stop()
    }
  }, [])

  const startRecording = useCallback(
    async (segment: { start: number; end: number; id?: number }, index: number) => {
      if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported')
        return
      }

      stopPlayback()
      stopRecording()
      setError(null)

      const key = segmentKey(segment, index)
      recordingKeyRef.current = key

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const mimeType = pickMimeType()
        const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
        mediaRecorderRef.current = mr
        chunksRef.current = []
        startedAtRef.current = performance.now()

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        mr.onerror = () => {
          setError('recorder-error')
          setStatus('idle')
          stopStream()
        }
        mr.onstop = () => {
          const durationMs = performance.now() - startedAtRef.current
          const type = mr.mimeType || mimeType || 'audio/webm'
          const blob = new Blob(chunksRef.current, { type })
          chunksRef.current = []
          stopStream()
          mediaRecorderRef.current = null

          if (blob.size === 0) {
            setStatus('idle')
            return
          }

          const url = URL.createObjectURL(blob)
          const rec: SentenceRecording = {
            blob,
            url,
            createdAt: Date.now(),
            durationMs,
          }
          const recKey = recordingKeyRef.current
          if (recKey) {
            setRecordings((prev) => {
              const existing = prev[recKey]
              if (existing) revokeRecording(existing)
              return { ...prev, [recKey]: rec }
            })
            setActiveKey(recKey)
          }
          setStatus('idle')
        }

        mr.start(100)
        setStatus('recording')
        setActiveKey(key)
      } catch (err) {
        stopStream()
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setStatus('denied')
          setError('mic-denied')
        } else {
          setStatus('idle')
          setError('mic-failed')
        }
      }
    },
    [revokeRecording, stopPlayback, stopRecording, stopStream],
  )

  const playRecording = useCallback(
    (segment: { start: number; end: number; id?: number }, index: number) => {
      const key = segmentKey(segment, index)
      const rec = recordings[key]
      if (!rec) return

      stopRecording()
      if (!audioRef.current) {
        audioRef.current = new Audio()
        audioRef.current.onended = () => setStatus('idle')
        audioRef.current.onerror = () => setStatus('idle')
      }
      const audio = audioRef.current
      audio.pause()
      audio.src = rec.url
      setActiveKey(key)
      setStatus('playing')
      void audio.play().catch(() => setStatus('idle'))
    },
    [recordings, stopRecording],
  )

  const hasRecording = useCallback(
    (segment: { start: number; end: number; id?: number }, index: number) => {
      return Boolean(recordings[segmentKey(segment, index)])
    },
    [recordings],
  )

  const getRecording = useCallback(
    (segment: { start: number; end: number; id?: number }, index: number) => {
      return recordings[segmentKey(segment, index)] ?? null
    },
    [recordings],
  )

  // Cleanup object URLs + stream on unmount
  useEffect(() => {
    return () => {
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== 'inactive') mr.stop()
      const stream = streamRef.current
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop()
        }
      }
      streamRef.current = null
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      for (const rec of Object.values(recordingsRef.current)) {
        URL.revokeObjectURL(rec.url)
      }
    }
  }, [])

  return {
    status,
    error,
    activeKey,
    startRecording,
    stopRecording,
    playRecording,
    stopPlayback,
    hasRecording,
    getRecording,
    clearRecording,
    segmentKey,
  }
}
