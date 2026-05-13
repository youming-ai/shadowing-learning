import type {
  GroqTranscriptionResponse,
  GroqTranscriptionSegment,
  GroqTranscriptionWord,
  TranscriptionSegment,
} from "~/types/transcription";

function normalizeWordTimings(
  words?: GroqTranscriptionWord[],
): TranscriptionSegment["wordTimestamps"] {
  if (!words || words.length === 0) {
    return undefined;
  }

  return words.map((word) => {
    const start = typeof word.start === "number" ? word.start : 0;
    const end =
      typeof word.end === "number" ? word.end : typeof word.start === "number" ? word.start : start;

    return {
      word: word.word ?? "",
      start,
      end,
    };
  });
}

export function mapGroqSegmentToTranscriptionSegment(
  segment: GroqTranscriptionSegment,
  fallbackId: number,
): TranscriptionSegment {
  return {
    start: typeof segment.start === "number" ? segment.start : 0,
    end: typeof segment.end === "number" ? segment.end : 0,
    text: segment.text?.trim() ?? "",
    wordTimestamps: normalizeWordTimings(segment.words),
    confidence: typeof segment.confidence === "number" ? segment.confidence : 0.95,
    id: typeof segment.id === "number" ? segment.id : fallbackId,
  };
}

export function buildSegmentsFromWords(
  words: GroqTranscriptionWord[],
  wordsPerSegment = 10,
): TranscriptionSegment[] {
  const segments: TranscriptionSegment[] = [];

  for (let i = 0; i < words.length; i += wordsPerSegment) {
    const chunk = words.slice(i, i + wordsPerSegment);
    if (chunk.length === 0) continue;

    const start = typeof chunk[0].start === "number" ? chunk[0].start : 0;
    const lastWord = chunk[chunk.length - 1];
    const end =
      typeof lastWord?.end === "number"
        ? lastWord.end
        : typeof lastWord?.start === "number"
          ? lastWord.start
          : start;

    segments.push({
      start,
      end,
      text: chunk
        .map((word) => word.word ?? "")
        .join(" ")
        .trim(),
      wordTimestamps: normalizeWordTimings(chunk) ?? [],
      confidence: 0.95,
      id: Math.floor(i / wordsPerSegment) + 1,
    });
  }

  return segments;
}

export function buildSegmentsFromPlainText(
  text: string,
  duration?: number,
  avgWordsPerSecond = 2.5,
): TranscriptionSegment[] {
  const sentences = text.split(/[。！？.!?]+/).filter((sentence) => sentence.trim().length > 0);
  if (sentences.length === 0) {
    return [];
  }

  const safeDuration =
    typeof duration === "number" && duration > 0 ? duration : text.length / avgWordsPerSecond;

  return sentences.map((sentence, index) => {
    const trimmedSentence = sentence.trim();
    const words = trimmedSentence.split(/\s+/).filter(Boolean);
    const sentenceDuration = words.length / avgWordsPerSecond || 0;
    const previousText = sentences.slice(0, index).join("");
    const startTime = previousText.length / avgWordsPerSecond;
    const endTime = Math.min(startTime + sentenceDuration, safeDuration);

    const wordTimestamps = words.map((word, wordIndex) => {
      const wordStart =
        startTime + (wordIndex * (sentenceDuration || 0)) / Math.max(words.length, 1);
      const wordEnd =
        startTime + ((wordIndex + 1) * (sentenceDuration || 0)) / Math.max(words.length, 1);
      return {
        word,
        start: wordStart,
        end: wordEnd,
      };
    });

    return {
      start: startTime,
      end: endTime,
      text: trimmedSentence,
      wordTimestamps,
      confidence: 0.95,
      id: index + 1,
    };
  });
}

export function extractSegmentsFromGroq(
  transcription: GroqTranscriptionResponse,
): TranscriptionSegment[] {
  if (Array.isArray(transcription.segments) && transcription.segments.length > 0) {
    return transcription.segments.map((segment, index) =>
      mapGroqSegmentToTranscriptionSegment(segment, index + 1),
    );
  }

  if (Array.isArray(transcription.words) && transcription.words.length > 0) {
    return buildSegmentsFromWords(transcription.words);
  }

  if (typeof transcription.text === "string" && transcription.text.trim().length > 0) {
    return buildSegmentsFromPlainText(transcription.text, transcription.duration);
  }

  return [];
}

export type { GroqTranscriptionResponse };
