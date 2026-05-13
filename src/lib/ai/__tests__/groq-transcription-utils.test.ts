import { describe, expect, it } from "vitest";
import type { GroqTranscriptionSegment, GroqTranscriptionWord } from "~/types/transcription";
import {
  buildSegmentsFromPlainText,
  buildSegmentsFromWords,
  mapGroqSegmentToTranscriptionSegment,
} from "../groq-transcription-utils";

describe("groq-transcription-utils", () => {
  describe("mapGroqSegmentToTranscriptionSegment", () => {
    it("should map segment with all properties", () => {
      const segment: GroqTranscriptionSegment = {
        id: 1,
        start: 0.5,
        end: 2.5,
        text: "Hello world",
        confidence: 0.98,
        words: [
          { word: "Hello", start: 0.5, end: 1.0 },
          { word: "world", start: 1.0, end: 2.5 },
        ],
      };

      const result = mapGroqSegmentToTranscriptionSegment(segment, 99);

      expect(result.id).toBe(1);
      expect(result.start).toBe(0.5);
      expect(result.end).toBe(2.5);
      expect(result.text).toBe("Hello world");
      expect(result.confidence).toBe(0.98);
      expect(result.wordTimestamps).toHaveLength(2);
    });

    it("should use fallback id when segment id is missing", () => {
      const segment: GroqTranscriptionSegment = {
        start: 0,
        end: 1,
        text: "Test",
      };

      const result = mapGroqSegmentToTranscriptionSegment(segment, 42);

      expect(result.id).toBe(42);
    });

    it("should handle missing properties gracefully", () => {
      const segment: GroqTranscriptionSegment = {} as GroqTranscriptionSegment;

      const result = mapGroqSegmentToTranscriptionSegment(segment, 1);

      expect(result.start).toBe(0);
      expect(result.end).toBe(0);
      expect(result.text).toBe("");
      expect(result.confidence).toBe(0.95);
    });

    it("should trim text whitespace", () => {
      const segment: GroqTranscriptionSegment = {
        text: "  trimmed text  ",
        start: 0,
        end: 1,
      };

      const result = mapGroqSegmentToTranscriptionSegment(segment, 1);

      expect(result.text).toBe("trimmed text");
    });

    it("should normalize word timestamps", () => {
      const segment: GroqTranscriptionSegment = {
        start: 0,
        end: 2,
        text: "Hi there",
        words: [
          { word: "Hi", start: 0, end: 0.5 },
          { word: "there", start: 0.5 }, // missing end
        ],
      };

      const result = mapGroqSegmentToTranscriptionSegment(segment, 1);

      expect(result.wordTimestamps).toHaveLength(2);
      expect(result.wordTimestamps?.[1].end).toBe(0.5); // should fallback to start
    });
  });

  describe("buildSegmentsFromWords", () => {
    it("should group words into segments", () => {
      const words: GroqTranscriptionWord[] = Array.from({ length: 25 }, (_, i) => ({
        word: `word${i}`,
        start: i,
        end: i + 0.5,
      }));

      const result = buildSegmentsFromWords(words, 10);

      expect(result).toHaveLength(3);
      expect(result[0].wordTimestamps).toHaveLength(10);
      expect(result[2].wordTimestamps).toHaveLength(5);
    });

    it("should calculate correct start and end times", () => {
      const words: GroqTranscriptionWord[] = [
        { word: "Hello", start: 0, end: 1 },
        { word: "world", start: 1, end: 2 },
      ];

      const result = buildSegmentsFromWords(words, 10);

      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(2);
    });

    it("should handle empty words array", () => {
      const result = buildSegmentsFromWords([]);

      expect(result).toHaveLength(0);
    });

    it("should join words with spaces", () => {
      const words: GroqTranscriptionWord[] = [
        { word: "Hello", start: 0, end: 1 },
        { word: "world", start: 1, end: 2 },
      ];

      const result = buildSegmentsFromWords(words, 10);

      expect(result[0].text).toBe("Hello world");
    });

    it("should assign sequential IDs", () => {
      const words: GroqTranscriptionWord[] = Array.from({ length: 30 }, (_, i) => ({
        word: `word${i}`,
        start: i,
        end: i + 0.5,
      }));

      const result = buildSegmentsFromWords(words, 10);

      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });
  });

  describe("buildSegmentsFromPlainText", () => {
    it("should split text by sentence delimiters", () => {
      const text = "Hello. How are you? I am fine!";

      const result = buildSegmentsFromPlainText(text, 10);

      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("Hello");
      expect(result[1].text).toBe("How are you");
      expect(result[2].text).toBe("I am fine");
    });

    it("should handle Japanese sentence delimiters", () => {
      const text = "こんにちは。元気ですか？はい！";

      const result = buildSegmentsFromPlainText(text);

      expect(result).toHaveLength(3);
    });

    it("should return empty array for empty text", () => {
      const result = buildSegmentsFromPlainText("");

      expect(result).toHaveLength(0);
    });

    it("should generate word timestamps", () => {
      const text = "Hello world.";

      const result = buildSegmentsFromPlainText(text, 10);

      expect(result[0].wordTimestamps).toBeDefined();
      expect(result[0].wordTimestamps?.length).toBeGreaterThan(0);
    });

    it("should respect duration parameter", () => {
      const text = "Short text.";
      const duration = 5;

      const result = buildSegmentsFromPlainText(text, duration);

      expect(result[0].end).toBeLessThanOrEqual(duration);
    });

    it("should assign sequential IDs", () => {
      const text = "First. Second. Third.";

      const result = buildSegmentsFromPlainText(text);

      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);
    });

    it("should set default confidence", () => {
      const text = "Test sentence.";

      const result = buildSegmentsFromPlainText(text);

      expect(result[0].confidence).toBe(0.95);
    });
  });
});
