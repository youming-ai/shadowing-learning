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

function decodeEntities(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

// srv3 format (requested via &fmt=srv3): <p t="1200" d="3200" ...>text</p>, times in ms.
function parseSrv3TimedtextXml(xml: string): MsCue[] {
  const cues: MsCue[] = []
  const grab = /<p\s(?:[^>]*?\s)?t="(\d+)"(?:\s[^>]*?\sd="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g
  let match: RegExpExecArray | null

  while ((match = grab.exec(xml)) !== null) {
    const startMs = Number.parseInt(match[1], 10)
    const durationMs = match[2] ? Number.parseInt(match[2], 10) : 0
    if (Number.isNaN(startMs)) continue

    const text = decodeEntities(match[3])
    if (text) {
      cues.push({ startMs, endMs: startMs + (durationMs || 1000), text })
    }
  }

  return cues
}

// Legacy format (YouTube's default when no &fmt is given): <text start="1.2" dur="3.4">text</text>,
// times in fractional seconds.
function parseLegacyTimedtextXml(xml: string): MsCue[] {
  const cues: MsCue[] = []
  const grab = /<text\s[^>]*?start="([\d.]+)"[^>]*?dur="([\d.]+)"[^>]*?>([\s\S]*?)<\/text>/g
  let match: RegExpExecArray | null

  while ((match = grab.exec(xml)) !== null) {
    const startSec = Number.parseFloat(match[1])
    const durationSec = Number.parseFloat(match[2])
    if (Number.isNaN(startSec)) continue

    const text = decodeEntities(match[3])
    if (text) {
      const startMs = Math.round(startSec * 1000)
      const durationMs = Number.isNaN(durationSec) ? 0 : Math.round(durationSec * 1000)
      cues.push({ startMs, endMs: startMs + (durationMs || 1000), text })
    }
  }

  return cues
}

function parseTimedtextXml(xml: string): MsCue[] {
  return xml.includes("<text ") ? parseLegacyTimedtextXml(xml) : parseSrv3TimedtextXml(xml)
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

export async function fetchTimedtextSubtitles(baseUrl: string): Promise<MsCue[]> {
  // baseUrl comes signed from the Innertube caption track (player response); a hand-built
  // /api/timedtext URL has no signature and YouTube silently returns an empty 200 body.
  // fmt=srv3 isn't part of the signed params, so it's safe to append for a consistent, richer format.
  const url = baseUrl.includes("fmt=") ? baseUrl : `${baseUrl}&fmt=srv3`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Timedtext fetch failed: ${response.status}`)
  }

  const xml = await response.text()
  if (!xml.includes("<p ") && !xml.includes("<text ")) {
    throw new Error("NO_CAPTIONS")
  }

  return parseTimedtextXml(xml)
}
