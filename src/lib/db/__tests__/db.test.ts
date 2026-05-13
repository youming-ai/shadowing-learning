import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FileRow, Segment } from "~/types/db/database";
import { DBUtils, db } from "../db";

describe("DBUtils", () => {
  // 每次测试前清空database
  beforeEach(async () => {
    await DBUtils.clearAll();
  });

  afterEach(async () => {
    await DBUtils.clearAll();
  });

  describe("File operations", () => {
    const createMockFile = (): Omit<FileRow, "id"> => ({
      name: "test-audio.mp3",
      size: 1024000,
      type: "audio/mpeg",
      uploadedAt: new Date(),
      updatedAt: new Date(),
    });

    describe("addFile", () => {
      it("should add a file and return its id", async () => {
        const file = createMockFile();
        const id = await DBUtils.addFile(file);

        expect(id).toBeDefined();
        expect(typeof id).toBe("number");
        expect(id).toBeGreaterThan(0);
      });

      it("should store file with all properties", async () => {
        const file = createMockFile();
        const id = await DBUtils.addFile(file);

        const stored = await DBUtils.getFile(id);

        expect(stored).toBeDefined();
        expect(stored?.name).toBe(file.name);
        expect(stored?.size).toBe(file.size);
        expect(stored?.type).toBe(file.type);
      });
    });

    describe("getFile", () => {
      it("should return undefined for non-existent id", async () => {
        const file = await DBUtils.getFile(99999);
        expect(file).toBeUndefined();
      });

      it("should retrieve file by id", async () => {
        const file = createMockFile();
        const id = await DBUtils.addFile(file);

        const retrieved = await DBUtils.getFile(id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(id);
      });
    });

    describe("getAllFiles", () => {
      it("should return empty array when no files", async () => {
        const files = await DBUtils.getAllFiles();
        expect(files).toEqual([]);
      });

      it("should return all files ordered by uploadedAt descending", async () => {
        const file1 = { ...createMockFile(), name: "file1.mp3" };
        const file2 = { ...createMockFile(), name: "file2.mp3" };

        await DBUtils.addFile(file1);
        // 小delay确保时间戳不同
        await new Promise((resolve) => setTimeout(resolve, 10));
        await DBUtils.addFile(file2);

        const files = await DBUtils.getAllFiles();

        expect(files.length).toBe(2);
        // 最新File应该在前面
        expect(files[0].name).toBe("file2.mp3");
        expect(files[1].name).toBe("file1.mp3");
      });
    });

    describe("deleteFile", () => {
      it("should delete file by id", async () => {
        const id = await DBUtils.addFile(createMockFile());

        await DBUtils.deleteFile(id);

        const file = await DBUtils.getFile(id);
        expect(file).toBeUndefined();
      });

      it("should delete associated transcripts and segments", async () => {
        // 创建File
        const fileId = await DBUtils.addFile(createMockFile());

        // 创建Transcriptionrecord
        const transcriptId = await DBUtils.addTranscript({
          fileId,
          status: "completed",
          rawText: "Test text",
          language: "en",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // 创建Subtitle段
        await DBUtils.addSegments([
          {
            transcriptId,
            start: 0,
            end: 1,
            text: "Segment 1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        // DeleteFile
        await DBUtils.deleteFile(fileId);

        // Validate关联数据也被Delete
        const transcripts = await db.transcripts.where("fileId").equals(fileId).toArray();
        expect(transcripts.length).toBe(0);

        const segments = await db.segments.where("transcriptId").equals(transcriptId).toArray();
        expect(segments.length).toBe(0);
      });
    });
  });

  describe("Transcript operations", () => {
    let fileId: number;

    beforeEach(async () => {
      fileId = await DBUtils.addFile({
        name: "test.mp3",
        size: 1000,
        type: "audio/mpeg",
        uploadedAt: new Date(),
        updatedAt: new Date(),
      });
    });

    describe("addTranscript", () => {
      it("should add transcript and return its id", async () => {
        const id = await DBUtils.addTranscript({
          fileId,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        expect(id).toBeDefined();
        expect(typeof id).toBe("number");
      });
    });

    describe("updateTranscriptStatus", () => {
      it("should update transcript status", async () => {
        const id = await DBUtils.addTranscript({
          fileId,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await DBUtils.updateTranscriptStatus(id, "completed");

        const transcript = await db.transcripts.get(id);
        expect(transcript?.status).toBe("completed");
      });

      it("should update updatedAt timestamp", async () => {
        const initialDate = new Date("2024-01-01");
        const id = await DBUtils.addTranscript({
          fileId,
          status: "pending",
          createdAt: initialDate,
          updatedAt: initialDate,
        });

        await DBUtils.updateTranscriptStatus(id, "processing");

        const transcript = await db.transcripts.get(id);
        expect(transcript?.updatedAt.getTime()).toBeGreaterThan(initialDate.getTime());
      });
    });
  });

  describe("Segment operations", () => {
    let transcriptId: number;

    beforeEach(async () => {
      const fileId = await DBUtils.addFile({
        name: "test.mp3",
        size: 1000,
        type: "audio/mpeg",
        uploadedAt: new Date(),
        updatedAt: new Date(),
      });

      transcriptId = await DBUtils.addTranscript({
        fileId,
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    describe("addSegments", () => {
      it("should add multiple segments", async () => {
        const segments: Omit<Segment, "id">[] = [
          {
            transcriptId,
            start: 0,
            end: 2,
            text: "Hello",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            transcriptId,
            start: 2,
            end: 4,
            text: "World",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        await DBUtils.addSegments(segments);

        const stored = await DBUtils.getSegmentsByTranscriptId(transcriptId);
        expect(stored.length).toBe(2);
      });

      it("should report progress for large batches", async () => {
        const segments: Omit<Segment, "id">[] = Array.from({ length: 100 }, (_, i) => ({
          transcriptId,
          start: i,
          end: i + 1,
          text: `Segment ${i}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        const progressUpdates: number[] = [];
        await DBUtils.addSegments(segments, {
          batchSize: 30,
          onProgress: (progress) => {
            progressUpdates.push(progress.percentage);
          },
        });

        expect(progressUpdates.length).toBeGreaterThan(0);
        expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
      });
    });

    describe("getSegmentsByTranscriptId", () => {
      it("should return empty array for non-existent transcript", async () => {
        const segments = await DBUtils.getSegmentsByTranscriptId(99999);
        expect(segments).toEqual([]);
      });

      it("should return segments for given transcript", async () => {
        await DBUtils.addSegments([
          {
            transcriptId,
            start: 0,
            end: 1,
            text: "Test",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const segments = await DBUtils.getSegmentsByTranscriptId(transcriptId);
        expect(segments.length).toBe(1);
        expect(segments[0].text).toBe("Test");
      });
    });
  });

  describe("clearAll", () => {
    it("should clear all data from database", async () => {
      // Add一些数据
      const fileId = await DBUtils.addFile({
        name: "test.mp3",
        size: 1000,
        type: "audio/mpeg",
        uploadedAt: new Date(),
        updatedAt: new Date(),
      });

      await DBUtils.addTranscript({
        fileId,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 清空
      await DBUtils.clearAll();

      // Validate
      const files = await DBUtils.getAllFiles();
      const transcripts = await db.transcripts.toArray();
      const segments = await db.segments.toArray();

      expect(files.length).toBe(0);
      expect(transcripts.length).toBe(0);
      expect(segments.length).toBe(0);
    });
  });
});
