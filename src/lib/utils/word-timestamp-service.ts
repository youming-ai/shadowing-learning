import type { Segment, WordTimestamp } from "~/types/db/database";

/** * Generate approximate word timestamps based on segment timing and text * This i a simple heuristic approach - for production, use a proper ASR with word-level timestamps*/
export function generateWordTimestamps(
  segmentText: string,
  segmentStart: number,
  segmentEnd: number,
): WordTimestamp[] {
  const words = segmentText.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [];

  const segmentDuration = segmentEnd - segmentStart;
  const averageWordDuration = segmentDuration / words.length;

  const timestamps: WordTimestamp[] = [];
  let currentTime = segmentStart;

  for (const word of words) {
    // Simple heuristic: assume each word takes proportional time
    const wordDuration = Math.max(0.1, averageWordDuration * (word.length / 5)); // Adjust based on word length
    const wordEnd = Math.min(currentTime + wordDuration, segmentEnd);

    timestamps.push({
      word,
      start: currentTime,
      end: wordEnd,
      confidence: 0.7, // Default confidence for heuristic approach
    });

    currentTime = wordEnd;
  }

  return timestamps;
}

/** * Get current word based on playback time and word timestamps*/
export function getCurrentWord(
  currentTime: number,
  wordTimestamps: WordTimestamp[],
): { word: string; index: number } | null {
  for (let i = 0; i < wordTimestamps.length; i++) {
    const timestamp = wordTimestamps[i];
    if (currentTime >= timestamp.start && currentTime <= timestamp.end) {
      return {
        word: timestamp.word,
        index: i,
      };
    }
  }
  return null;
}

/** * Get words around the current position for context*/
export function getWordContext(
  currentTime: number,
  wordTimestamps: WordTimestamp[],
  contextWords: number = 2,
): {
  previous: WordTimestamp[];
  current: WordTimestamp | null;
  next: WordTimestamp[];
} {
  const currentIndex = wordTimestamps.findIndex(
    (ts) => currentTime >= ts.start && currentTime <= ts.end,
  );

  if (currentIndex === -1) {
    return {
      previous: [],
      current: null,
      next: [],
    };
  }

  const previous = wordTimestamps.slice(Math.max(0, currentIndex - contextWords), currentIndex);

  const next = wordTimestamps.slice(
    currentIndex + 1,
    Math.min(wordTimestamps.length, currentIndex + contextWords + 1),
  );

  return {
    previous,
    current: wordTimestamps[currentIndex],
    next,
  };
}

/** * Calculate speaking rate (words per minute) for a segment*/
export function calculateSpeakingRate(wordTimestamps: WordTimestamp[]): number {
  if (wordTimestamps.length < 2) return 0;

  const firstWord = wordTimestamps[0];
  const lastWord = wordTimestamps[wordTimestamps.length - 1];
  const durationMinutes = (lastWord.end - firstWord.start) / 60;

  return wordTimestamps.length / durationMinutes;
}

/** * Find gaps between words (pauses)*/
export function findPauses(
  wordTimestamps: WordTimestamp[],
  pauseThreshold: number = 0.3,
): Array<{
  start: number;
  end: number;
  duration: number;
}> {
  const pauses: Array<{ start: number; end: number; duration: number }> = [];

  for (let i = 0; i < wordTimestamps.length - 1; i++) {
    const currentWord = wordTimestamps[i];
    const nextWord = wordTimestamps[i + 1];
    const gap = nextWord.start - currentWord.end;

    if (gap >= pauseThreshold) {
      pauses.push({
        start: currentWord.end,
        end: nextWord.start,
        duration: gap,
      });
    }
  }

  return pauses;
}

/** * Smooth word timestamps to avoid overlapping or negative durations*/
export function smoothTimestamps(wordTimestamps: WordTimestamp[]): WordTimestamp[] {
  if (wordTimestamps.length === 0) return [];

  const smoothed: WordTimestamp[] = [...wordTimestamps];

  // Ensure no negative durations and proper ordering
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i].end <= smoothed[i].start) {
      smoothed[i].end = smoothed[i].start + 0.1; // Minimum duration
    }
  }

  // Ensure no overlaps
  for (let i = 0; i < smoothed.length - 1; i++) {
    if (smoothed[i].end > smoothed[i + 1].start) {
      smoothed[i].end = smoothed[i + 1].start - 0.01; // Small gap
    }
  }

  return smoothed;
}

/** * Convert word timestamps to SRT-like format for export*/
export function convertWordTimestampsToSrtFormat(wordTimestamps: WordTimestamp[]): string {
  return wordTimestamps
    .map((ts, index) => {
      const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const millis = Math.floor((seconds % 1) * 1000);

        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${millis.toString().padStart(3, "0")}`;
      };

      return `${index + 1}\n${formatTime(ts.start)} --> ${formatTime(ts.end)}\n${ts.word}\n`;
    })
    .join("\n");
}

/** * Merge word timestamps from multiple segments*/
export function mergeWordTimestamps(segments: Segment[]): WordTimestamp[] {
  return segments
    .filter((segment) => segment.wordTimestamps && segment.wordTimestamps.length > 0)
    .flatMap((segment) => segment.wordTimestamps || [])
    .sort((a, b) => a.start - b.start);
}

/** * Export word timestamps to JSON*/
export function exportWordTimestampsToJson(wordTimestamps: WordTimestamp[]): string {
  return JSON.stringify(
    {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      wordCount: wordTimestamps.length,
      timestamps: wordTimestamps,
    },
    null,
    2,
  );
}

// 向后兼容class导出
// biome-ignore lint/complexity/noStaticOnlyClass: Backward compatibility for existing code
export class WordTimestampService {
  static generateWordTimestamps(
    segmentText: string,
    segmentStart: number,
    segmentEnd: number,
  ): WordTimestamp[] {
    return generateWordTimestamps(segmentText, segmentStart, segmentEnd);
  }

  static getCurrentWord(
    currentTime: number,
    wordTimestamps: WordTimestamp[],
  ): { word: string; index: number } | null {
    return getCurrentWord(currentTime, wordTimestamps);
  }

  static getWordContext(
    currentTime: number,
    wordTimestamps: WordTimestamp[],
    contextWords: number = 2,
  ) {
    return getWordContext(currentTime, wordTimestamps, contextWords);
  }

  static calculateSpeakingRate(wordTimestamps: WordTimestamp[]): number {
    return calculateSpeakingRate(wordTimestamps);
  }

  static findPauses(wordTimestamps: WordTimestamp[], pauseThreshold: number = 0.3) {
    return findPauses(wordTimestamps, pauseThreshold);
  }

  static smoothTimestamps(wordTimestamps: WordTimestamp[]): WordTimestamp[] {
    return smoothTimestamps(wordTimestamps);
  }

  static toSrtFormat(wordTimestamps: WordTimestamp[]): string {
    return convertWordTimestampsToSrtFormat(wordTimestamps);
  }

  static mergeWordTimestamps(segments: Segment[]): WordTimestamp[] {
    return mergeWordTimestamps(segments);
  }

  static exportToJson(wordTimestamps: WordTimestamp[]): string {
    return exportWordTimestampsToJson(wordTimestamps);
  }
}
