interface MsCue {
  startMs: number
  endMs: number
  text: string
}

export interface CaptionSegment {
  start: number
  end: number
  text: string
}

function parseTimedtextXml(xml: string): MsCue[] {
  const cues: MsCue[] = []

  const pRegex = /<p\s[^>]*?(?:t="(\d+)"|d="(\d+)"[^>]*?(?:t="(\d+)"|d="(\d+)"))[^>]*?>/g
  const textRegex = /<p[^>]*>([^<]*(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/g

  const grab = /<p\s(?:[^>]*?\s)?t="(\d+)"(?:\s[^>]*?\sd="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g
  let match: RegExpExecArray | null

  while ((match = grab.exec(xml)) !== null) {
    const startMs = Number.parseInt(match[1], 10)
    const durationMs = match[2] ? Number.parseInt(match[2], 10) : 0
    if (Number.isNaN(startMs)) continue

    let text = match[3]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()

    if (text) {
      cues.push({ startMs, endMs: startMs + (durationMs || 1000), text })
    }
  }

  return cues
}

export function msCuesToSeconds(cues: MsCue[]): CaptionSegment[] {
  return cues.map((cue) => ({
    start: Math.round((cue.startMs / 1000) * 1000) / 1000,
    end: Math.round((cue.endMs / 1000) * 1000) / 1000,
    text: cue.text,
  }))
}

export function mergeShortCues(cues: CaptionSegment[], minDuration = 0.8): CaptionSegment[] {
  if (cues.length === 0) return []

  const merged: CaptionSegment[] = []
  let current = { ...cues[0] }

  for (let i = 1; i < cues.length; i++) {
    const next = cues[i]
    if (current.end - current.start < minDuration && i > 0) {
      current.text = `${current.text} ${next.text}`
      current.end = next.end
    } else {
      merged.push({ ...current })
      current = { ...next }
    }
  }
  merged.push({ ...current })
  return merged
}

export async function fetchTimedtextSubtitles(
  videoId: string,
  language: string,
): Promise<MsCue[]> {
  const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${language}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Timedtext fetch failed: ${response.status}`)
  }

  const xml = await response.text()
  if (!xml.includes("<p ")) {
    throw new Error("NO_CAPTIONS")
  }

  return parseTimedtextXml(xml)
}
