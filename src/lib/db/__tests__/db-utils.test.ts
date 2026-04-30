import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileRow, Segment, TranscriptRow } from "@/types/db/database";
import { DBUtils, db } from "../db";

// Mock error handler
vi.mock("@/lib/utils/error-handler", () => ({
  handleError: vi.fn((error, _context) => {
    throw error;
  }),
}));

describe("DBUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Generic CRUD operations", () => {
    it("should add an item to a table", async () => {
      const mockAdd = vi.fn().mockResolvedValue(1);
      db.files.add = mockAdd;

      const item = { name: "test.mp3", size: 1024, type: "audio/mpeg" } as any;
      const result = await DBUtils.add(db.files, item);

      expect(mockAdd).toHaveBeenCalledWith(item);
      expect(result).toBe(1);
    });

    it("should get an item by id", async () => {
      const mockGet = vi.fn().mockResolvedValue({ id: 1, name: "test.mp3" });
      db.files.get = mockGet;

      const result = await DBUtils.get(db.files, 1);

      expect(mockGet).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, name: "test.mp3" });
    });

    it("should update an item", async () => {
      const mockUpdate = vi.fn().mockResolvedValue(1);
      db.files.update = mockUpdate;

      const changes = { name: "updated.mp3" } as any;
      const result = await DBUtils.update(db.files, 1, changes);

      expect(mockUpdate).toHaveBeenCalledWith(1, changes);
      expect(result).toBe(1);
    });

    it("should delete an item", async () => {
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      db.files.delete = mockDelete;

      await DBUtils.delete(db.files, 1);

      expect(mockDelete).toHaveBeenCalledWith(1);
    });

    it("should bulk add items", async () => {
      const mockBulkAdd = vi.fn().mockResolvedValue([1, 2, 3]);
      db.files.bulkAdd = mockBulkAdd;

      const items = [{ name: "test1.mp3" }, { name: "test2.mp3" }, { name: "test3.mp3" }] as any;
      const result = await DBUtils.bulkAdd(db.files, items);

      expect(mockBulkAdd).toHaveBeenCalledWith(items);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should bulk update items", async () => {
      const mockUpdate = vi.fn().mockResolvedValue(1);
      db.files.update = mockUpdate;

      const items = [
        { id: 1, changes: { name: "updated1.mp3" } },
        { id: 2, changes: { name: "updated2.mp3" } },
      ] as any;
      const result = await DBUtils.bulkUpdate(db.files, items);

      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(result).toEqual([1, 1]);
    });
  });

  describe("File-specific operations", () => {
    it("should add a file", async () => {
      const mockAdd = vi.fn().mockResolvedValue(1);
      db.files.add = mockAdd;

      const file: Omit<FileRow, "id"> = {
        name: "test.mp3",
        size: 1024,
        type: "audio/mpeg",
        blob: new Blob(),
        uploadedAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await DBUtils.addFile(file);

      expect(mockAdd).toHaveBeenCalledWith(file);
      expect(result).toBe(1);
    });

    it("should get all files ordered by upload date", async () => {
      const mockOrderBy = vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 2, name: "file2.mp3", uploadedAt: new Date("2023-01-02") },
            { id: 1, name: "file1.mp3", uploadedAt: new Date("2023-01-01") },
          ]),
        }),
      });
      db.files.orderBy = mockOrderBy;

      const result = await DBUtils.getAllFiles();

      expect(mockOrderBy).toHaveBeenCalledWith("uploadedAt");
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("file2.mp3");
    });
  });

  describe("Transcript-specific operations", () => {
    it("should add a transcript", async () => {
      const mockAdd = vi.fn().mockResolvedValue(1);
      db.transcripts.add = mockAdd;

      const transcript: Omit<TranscriptRow, "id"> = {
        fileId: 1,
        status: "completed",
        language: "en",
        processingTime: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await DBUtils.addTranscript(transcript);

      expect(mockAdd).toHaveBeenCalledWith(transcript);
      expect(result).toBe(1);
    });

    it("should find transcript by file id", async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          id: 1,
          fileId: 1,
          status: "completed",
        }),
      });
      db.transcripts.where = mockWhere;

      const result = await DBUtils.findTranscriptByFileId(1);

      expect(mockWhere).toHaveBeenCalledWith("fileId");
      expect(result).toEqual({
        id: 1,
        fileId: 1,
        status: "completed",
      });
    });
  });

  describe("Segment-specific operations", () => {
    it("should add a segment", async () => {
      const mockAdd = vi.fn().mockResolvedValue(1);
      db.segments.add = mockAdd;

      const segment: Omit<Segment, "id"> = {
        transcriptId: 1,
        start: 0,
        end: 3,
        text: "Hello world",
        wordTimestamps: [],
        normalizedText: "Hello world",
        translation: "你好世界",
        annotations: [],
        furigana: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await DBUtils.addSegment(segment);

      expect(mockAdd).toHaveBeenCalledWith(segment);
      expect(result).toBe(1);
    });

    it("should get segments by transcript id", async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          { id: 1, transcriptId: 1, text: "Hello" },
          { id: 2, transcriptId: 1, text: "World" },
        ]),
      });
      db.segments.where = mockWhere;

      const result = await DBUtils.getSegmentsByTranscriptId(1);

      expect(mockWhere).toHaveBeenCalledWith("transcriptId");
      expect(result).toHaveLength(2);
    });

    it("should get segments by transcript id ordered", async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnThis(),
        sortBy: vi.fn().mockResolvedValue([
          { id: 1, start: 0, text: "Hello" },
          { id: 2, start: 3, text: "World" },
        ]),
      });
      db.segments.where = mockWhere;

      const result = await DBUtils.getSegmentsByTranscriptIdOrdered(1);

      expect(mockWhere).toHaveBeenCalledWith("transcriptId");
      expect(result[0].start).toBeLessThan(result[1].start);
    });

    it("should find segments by time range", async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([{ id: 1, start: 2, end: 4, text: "Segment 1" }]),
        }),
      });
      db.segments.where = mockWhere;

      const result = await DBUtils.findSegmentsByTimeRange(1, 1, 5);

      expect(mockWhere).toHaveBeenCalledWith("transcriptId");
      expect(result).toHaveLength(1);
    });
  });

  describe("Database maintenance", () => {
    it("should clear all data", async () => {
      const mockClear = vi.fn().mockResolvedValue(undefined);
      const mockTransaction = vi.fn().mockImplementation((...args) => {
        const callback = args[args.length - 1];
        return callback();
      });

      db.transaction = mockTransaction as any;
      db.segments.clear = mockClear;
      db.transcripts.clear = mockClear;
      db.files.clear = mockClear;

      await DBUtils.clearAll();

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalledTimes(3);
    });
  });
});
