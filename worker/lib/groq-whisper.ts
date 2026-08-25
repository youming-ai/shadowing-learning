import Groq from "groq-sdk"
import { getGroqClient } from "./groq-client"

interface AudioFileInput {
  name: string
  type: string
  size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

interface TranscriptionSegment {
  id: number
  seek: number
  start: number
  end: number
  text: string
  tokens: number[]
  temperature: number
  avg_logprob: number
  compression_ratio: number
  no_speech_prob: number
  words?: Array<{ word: string; start: number; end: number }>
}

interface VerboseTranscription {
  text: string
  task: string
  language: string
  duration: number
  segments: TranscriptionSegment[]
}

function isValidAudioFile(file: { name: string; type: string; size: number }): boolean {
  const validTypes = [
    "audio/mpeg", "audio/mp4", "audio/mp3", "audio/m4a",
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/ogg", "audio/webm", "audio/flac",
    "audio/x-m4a",
  ]
  if (file.type && validTypes.includes(file.type)) return true
  const ext = file.name.split(".").pop()?.toLowerCase()
  const validExts = ["mp3", "m4a", "wav", "ogg", "webm", "flac", "mpeg", "mp4"]
  return validExts.includes(ext ?? "")
}

export interface TranscriptionResult {
  success: true
  data: {
    text: string
    language: string
    duration: number
    segments: TranscriptionSegment[]
  }
}

export interface TranscriptionError {
  success: false
  error: Response
}

export async function processTranscription(
  audioFile: AudioFileInput,
  language: string,
  apiKey: string,
): Promise<TranscriptionResult | TranscriptionError> {
  const MAX_SIZE = 25 * 1024 * 1024

  if (audioFile.size > MAX_SIZE) {
    return {
      success: false,
      error: Response.json(
        { success: false, error: { code: "FILE_TOO_LARGE", message: "文件超过 25MB 限制" } },
        { status: 413 },
      ),
    }
  }

  if (!isValidAudioFile(audioFile)) {
    return {
      success: false,
      error: Response.json(
        { success: false, error: { code: "INVALID_AUDIO", message: "不支持的音频格式" } },
        { status: 400 },
      ),
    }
  }

  try {
    const groq = getGroqClient(apiKey)
    // eslint-disable-next-line
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile as never,
      model: "whisper-large-v3",
      language: language !== "auto" ? (language as Groq.Audio.TranscriptionCreateParams["language"]) : undefined,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    }) as unknown as VerboseTranscription

    return {
      success: true,
      data: {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration ?? 0,
        segments: transcription.segments ?? [],
      },
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: Response.json(
        { success: false, error: { code: "TRANSCRIPTION_FAILED", message: `转录失败: ${msg}` } },
        { status: 502 },
      ),
    }
  }
}
