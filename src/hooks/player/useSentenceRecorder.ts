import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeAudioBlob, isAudioDecodingSupported } from '~/lib/audio/decode'
import { analyzeSamples, type RhythmReference, type RhythmResult } from '~/lib/player/rhythm'

export type RecorderStatus = 'idle' | 'recording' | 'playing' | 'unsupported' | 'denied'

/**
 * 节奏分析的状态。与 `rhythm` 分开表达，好让 UI 区分
 * "还在算" / "算出来了" / "没听到人声" / "这台浏览器算不了"。
 */
export type RhythmStatus = 'pending' | 'ready' | 'noSpeech' | 'unavailable'

export interface SentenceRecording {
  blob: Blob
  url: string
  createdAt: number
  durationMs: number | null
  /** 跟读节奏结论；`rhythmStatus === 'ready'` 时才有值。 */
  rhythm?: RhythmResult | null
  /** 未提供基准（reference）时为 undefined —— 此时不算节奏，也不显示读数。 */
  rhythmStatus?: RhythmStatus
}

/**
 * 录音结束后分析节奏。任何一步失败都降级为 `unavailable` / `noSpeech`，
 * 不抛错：跟读练习中算不出节奏不该打断练习。
 */
async function analyzeTake(
  blob: Blob,
  reference: RhythmReference,
): Promise<{ rhythm: RhythmResult | null; rhythmStatus: RhythmStatus }> {
  if (!isAudioDecodingSupported()) return { rhythm: null, rhythmStatus: 'unavailable' }
  const decoded = await decodeAudioBlob(blob)
  if (!decoded) return { rhythm: null, rhythmStatus: 'unavailable' }
  const rhythm = analyzeSamples(decoded.samples, decoded.sampleRate, reference)
  return rhythm ? { rhythm, rhythmStatus: 'ready' } : { rhythm: null, rhythmStatus: 'noSpeech' }
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
  const getReferenceRef = useRef<(() => RhythmReference) | null>(null)
  /** 卸载后不再写 state：节奏分析是异步的，可能晚于组件生命周期。 */
  const disposedRef = useRef(false)
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
    async (
      segment: { start: number; end: number; id?: number },
      index: number,
      /**
       * 在**采集真正开始的那一刻**求值，而不是本函数被调用时。
       *
       * `getUserMedia` 可能慢得离谱（首次会弹权限框，可达数秒），而 PCM 时间轴是从
       * `MediaRecorder.start()` 之后才开始的。若在按下按钮时就把延迟算好，这段启动时间
       * 会被整段漏掉，真正偏晚的一次跟读会被报成"合拍"。
       */
      getReference?: () => RhythmReference,
    ) => {
      if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported')
        return
      }

      stopPlayback()
      stopRecording()
      setError(null)

      const key = segmentKey(segment, index)
      recordingKeyRef.current = key
      getReferenceRef.current = getReference ?? null

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const mimeType = pickMimeType()
        const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
        mediaRecorderRef.current = mr
        chunksRef.current = []
        // 节奏反馈的实测起点。
        //
        // 零点（reference）已在下方 `onstop` 里、`mr.start()` 之前求值，因此
        // `getUserMedia` 的等待（首次会弹权限框，可能数秒）已被正确计入，不再是误差来源。
        //
        // 剩余偏差：本时间戳取在 `mr.start()` **之前**，而 blob 的 t=0 才是真正开始采集的时刻，
        // 两者通常相差几十毫秒（个别浏览器更多）。因此算出的开口延迟仍会略微偏乐观。
        // 量级远小于分档阈值（0.15s / 0.6s），且没有可靠手段在线校准，故接受并记录在此，
        // 不假装它不存在。
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
          // 采集即将开始 —— 此刻才求值零点（已过 getUserMedia 的等待）
          const reference = getReferenceRef.current?.() ?? null
          const rec: SentenceRecording = {
            blob,
            url,
            createdAt: Date.now(),
            durationMs,
            // 有基准时先落一个 pending 占位，UI 立刻显示"分析中…"，录音本身可立即回放
            ...(reference ? { rhythm: null, rhythmStatus: 'pending' as const } : {}),
          }
          const recKey = recordingKeyRef.current
          if (recKey) {
            setRecordings((prev) => {
              const existing = prev[recKey]
              if (existing) revokeRecording(existing)
              return { ...prev, [recKey]: rec }
            })
            setActiveKey(recKey)

            if (reference) {
              void analyzeTake(blob, reference).then((result) => {
                if (disposedRef.current) return
                setRecordings((prev) => {
                  const existing = prev[recKey]
                  // 用户可能已经重录/删除；只在同一条录音上回填
                  if (!existing || existing.blob !== blob) return prev
                  return { ...prev, [recKey]: { ...existing, ...result } }
                })
              })
            }
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
    disposedRef.current = false
    return () => {
      disposedRef.current = true
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
