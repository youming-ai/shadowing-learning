/** * Simplified database operations file * Removed complex batch processors, keeping core functionality*/

import Dexie, { type Table } from "dexie";
import type { FileRow, Segment, TranscriptRow } from "@/types/db/database";
import { handleError } from "../utils/error-handler";
import { dbLogger } from "../utils/logger";

export class AppDatabase extends Dexie {
  files!: Table<FileRow>;
  transcripts!: Table<TranscriptRow>;
  segments!: Table<Segment>;

  constructor() {
    super("shadowing-learning-db");

    // Define schema
    this.version(3).stores({
      files: "++id, name, size, type, uploadedAt, updatedAt, [name+type]",
      transcripts: "++id, fileId, status, language, createdAt, updatedAt",
      segments: "++id, transcriptId, start, end, text, [transcriptId+start], [transcriptId+end]",
    });

    // Migration logic for version updates
    this.version(1)
      .stores({
        files: "++id, name, size, type, uploadedAt, [name+type]",
        transcripts: "++id, fileId, status, language, createdAt, updatedAt",
        segments: "++id, transcriptId, start, end, text, [transcriptId+start], [transcriptId+end]",
      })
      .upgrade((_tx) => {
        // Initial setup - no migration needed
        dbLogger.debug("Database version 1 initialized");
      });

    this.version(2)
      .stores({
        files: "++id, name, size, type, uploadedAt, [name+type]",
        transcripts: "++id, fileId, status, language, createdAt, updatedAt",
        segments:
          "++id, transcriptId, start, end, text, wordTimestamps, [transcriptId+start], [transcriptId+end]",
      })
      .upgrade(async (_tx) => {
        // Add wordTimestamps to existing segments if needed
        dbLogger.debug("Database migrated to version 2: Added wordTimestamps support");
      });

    this.version(3)
      .stores({
        files: "++id, name, size, type, uploadedAt, [name+type]",
        transcripts: "++id, fileId, status, language, createdAt, updatedAt",
        segments:
          "++id, transcriptId, start, end, text, wordTimestamps, normalizedText, translation, annotations, furigana, [transcriptId+start], [transcriptId+end]",
      })
      .upgrade(async (_tx) => {
        // Add enhanced segment fields for better transcription features
        dbLogger.debug("Database migrated to version 3: Added enhanced transcription features");
      });
  }
}

// Create database instance
export const db = new AppDatabase();

// Simplified database utilities with repository functionality integrated
export const DBUtils = {
  /** * Generic database operations*/
  // Core CRUD operations
  async add<T>(table: Dexie.Table<T, number>, item: Omit<T, "id">): Promise<number> {
    try {
      return await table.add(item as T);
    } catch (error) {
      throw handleError(error, `DBUtils.add`);
    }
  },

  async get<T>(table: Dexie.Table<T, number>, id: number): Promise<T | undefined> {
    try {
      return await table.get(id);
    } catch (error) {
      throw handleError(error, `DBUtils.get`);
    }
  },

  async update<T>(table: Dexie.Table<T, number>, id: number, changes: Partial<T>): Promise<number> {
    try {
      return await table.update(id, changes as any);
    } catch (error) {
      throw handleError(error, `DBUtils.update`);
    }
  },

  async delete<T>(table: Dexie.Table<T, number>, id: number): Promise<void> {
    try {
      await table.delete(id);
    } catch (error) {
      throw handleError(error, `DBUtils.delete`);
    }
  },

  // Batch operations
  async bulkAdd<T>(table: Dexie.Table<T, number>, items: Omit<T, "id">[]): Promise<number[]> {
    try {
      const result = await table.bulkAdd(items as T[]);
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      throw handleError(error, `DBUtils.bulkAdd`);
    }
  },

  async bulkUpdate<T>(
    table: Dexie.Table<T, number>,
    items: Array<{ id: number; changes: Partial<T> }>,
  ): Promise<number[]> {
    try {
      return await Promise.all(items.map(({ id, changes }) => table.update(id, changes as any)));
    } catch (error) {
      throw handleError(error, `DBUtils.bulkUpdate`);
    }
  },

  // Query operations
  async where<T>(table: Dexie.Table<T, number>, predicate: (item: T) => boolean): Promise<T[]> {
    try {
      return await table.filter(predicate).toArray();
    } catch (error) {
      throw handleError(error, `DBUtils.where`);
    }
  },

  async orderBy<T>(
    table: Dexie.Table<T, number>,
    key: keyof T,
    direction: "asc" | "desc" = "asc",
  ): Promise<T[]> {
    try {
      if (direction === "desc") {
        return await table
          .orderBy(key as string)
          .reverse()
          .toArray();
      }
      return await table.orderBy(key as string).toArray();
    } catch (error) {
      throw handleError(error, `DBUtils.orderBy`);
    }
  },

  /** * File-specific operations*/
  async addFile(file: Omit<FileRow, "id">): Promise<number> {
    return await this.add(db.files, file);
  },

  async getFile(id: number): Promise<FileRow | undefined> {
    return await this.get(db.files, id);
  },

  async getAllFiles(): Promise<FileRow[]> {
    try {
      return await this.orderBy(db.files, "uploadedAt", "desc");
    } catch (error) {
      throw handleError(error, "DBUtils.getAllFiles");
    }
  },

  async findFilesByName(name: string): Promise<FileRow[]> {
    return await this.where(db.files, (file) => file.name.includes(name));
  },

  async getStorageUsage(): Promise<{
    totalSize: number;
    totalFiles: number;
    averageFileSize: number;
    largestFileSize: number;
    fileCountByType: Record<string, number>;
  }> {
    try {
      const files = await db.files.toArray();
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const fileCountByType = files.reduce(
        (acc, file) => {
          acc[file.type] = (acc[file.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        totalSize,
        totalFiles: files.length,
        averageFileSize: files.length > 0 ? Math.round(totalSize / files.length) : 0,
        largestFileSize: files.length > 0 ? Math.max(...files.map((f) => f.size)) : 0,
        fileCountByType,
      };
    } catch (error) {
      throw handleError(error, "DBUtils.getStorageUsage");
    }
  },

  async cleanupOldFiles(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const oldFiles = await db.files.where("uploadedAt").below(cutoffDate).toArray();

      // Delete files and their related data
      for (const file of oldFiles) {
        if (file.id) {
          await this.deleteFile(file.id);
        }
      }

      return oldFiles.length;
    } catch (error) {
      throw handleError(error, "DBUtils.cleanupOldFiles");
    }
  },

  /** * Delete a file and its associated data * Delete order: segments → transcripts → file (children first)*/
  async deleteFile(id: number): Promise<void> {
    try {
      await db.transaction("rw", db.files, db.transcripts, db.segments, async () => {
        // 1. Get related transcripts
        const transcripts = await db.transcripts.where("fileId").equals(id).toArray();

        // 2. Delete each transcript's segments first
        for (const transcript of transcripts) {
          if (transcript.id) {
            await db.segments.where("transcriptId").equals(transcript.id).delete();
          }
        }

        // 3. Delete transcripts
        await db.transcripts.where("fileId").equals(id).delete();

        // 4. Finally delete the file
        await db.files.delete(id);
      });
    } catch (error) {
      throw handleError(error, "DBUtils.deleteFile");
    }
  },

  /** * Transcript-specific operations*/
  async addTranscript(transcript: Omit<TranscriptRow, "id">): Promise<number> {
    return await this.add(db.transcripts, transcript);
  },

  async getTranscript(id: number): Promise<TranscriptRow | undefined> {
    return await this.get(db.transcripts, id);
  },

  async findTranscriptByFileId(fileId: number): Promise<TranscriptRow | undefined> {
    try {
      return await db.transcripts.where("fileId").equals(fileId).first();
    } catch (error) {
      throw handleError(error, "DBUtils.findTranscriptByFileId");
    }
  },

  async updateTranscriptStatus(id: number, status: TranscriptRow["status"]): Promise<void> {
    await this.update(db.transcripts, id, { status, updatedAt: new Date() });
  },

  async getTranscriptsByStatus(status: TranscriptRow["status"]): Promise<TranscriptRow[]> {
    return await this.where(db.transcripts, (transcript) => transcript.status === status);
  },

  /** * Segment-specific operations*/
  async addSegment(segment: Omit<Segment, "id">): Promise<number> {
    return await this.add(db.segments, segment);
  },

  async getSegment(id: number): Promise<Segment | undefined> {
    return await this.get(db.segments, id);
  },

  async getSegmentsByTranscriptId(transcriptId: number): Promise<Segment[]> {
    try {
      return await db.segments.where("transcriptId").equals(transcriptId).toArray();
    } catch (error) {
      throw handleError(error, "DBUtils.getSegmentsByTranscriptId");
    }
  },

  async getSegmentsByTranscriptIdOrdered(transcriptId: number): Promise<Segment[]> {
    try {
      return await db.segments.where("transcriptId").equals(transcriptId).sortBy("start");
    } catch (error) {
      throw handleError(error, "DBUtils.getSegmentsByTranscriptIdOrdered");
    }
  },

  async addSegments(
    segments: Omit<Segment, "id">[],
    options?: {
      batchSize?: number;
      onProgress?: (progress: {
        processed: number;
        total: number;
        percentage: number;
        status: string;
        message: string;
      }) => void;
    },
  ): Promise<void> {
    try {
      // Add timestamps
      const segmentsWithTimestamps = segments.map((segment) => ({
        ...segment,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // For small batches, use bulkAdd directly
      if (segmentsWithTimestamps.length <= 50) {
        await this.bulkAdd(db.segments, segmentsWithTimestamps);
        return;
      }

      // For large batches, use simplified batch processing
      const batchSize = options?.batchSize || 50;
      for (let i = 0; i < segmentsWithTimestamps.length; i += batchSize) {
        const batch = segmentsWithTimestamps.slice(i, i + batchSize);
        await this.bulkAdd(db.segments, batch);

        // Simple progress reporting
        if (options?.onProgress) {
          const progress = Math.min(
            100,
            Math.floor(((i + batch.length) / segmentsWithTimestamps.length) * 100),
          );
          options.onProgress({
            processed: i + batch.length,
            total: segmentsWithTimestamps.length,
            percentage: progress,
            status: "processing",
            message: `Processing ${i + batch.length}/${segmentsWithTimestamps.length}`,
          });
        }
      }
    } catch (error) {
      throw handleError(error, "DBUtils.addSegments");
    }
  },

  async updateSegmentsByTranscriptId(
    transcriptId: number,
    updates: Partial<Segment>,
  ): Promise<number> {
    try {
      return await db.segments.where("transcriptId").equals(transcriptId).modify(updates);
    } catch (error) {
      throw handleError(error, "DBUtils.updateSegmentsByTranscriptId");
    }
  },

  async findSegmentsByTimeRange(
    transcriptId: number,
    startTime: number,
    endTime: number,
  ): Promise<Segment[]> {
    try {
      return await db.segments
        .where("transcriptId")
        .equals(transcriptId)
        .and((segment) => segment.start >= startTime && segment.end <= endTime)
        .toArray();
    } catch (error) {
      throw handleError(error, "DBUtils.findSegmentsByTimeRange");
    }
  },

  /** * Database maintenance operations*/
  async clearAll(): Promise<void> {
    try {
      await db.transaction("rw", db.files, db.transcripts, db.segments, async () => {
        await db.segments.clear();
        await db.transcripts.clear();
        await db.files.clear();
      });
    } catch (error) {
      throw handleError(error, "DBUtils.clearAll");
    }
  },

  async getDatabaseStats(): Promise<{
    totalFiles: number;
    totalTranscripts: number;
    totalSegments: number;
    totalStorageSize: number;
    averageSegmentsPerTranscript: number;
    transcriptsByStatus: Record<string, number>;
  }> {
    try {
      const [files, transcripts, segments] = await Promise.all([
        db.files.toArray(),
        db.transcripts.toArray(),
        db.segments.toArray(),
      ]);

      const totalStorageSize = files.reduce((sum, file) => sum + file.size, 0);
      const transcriptsByStatus = transcripts.reduce(
        (acc, transcript) => {
          acc[transcript.status] = (acc[transcript.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      const averageSegmentsPerTranscript =
        transcripts.length > 0 ? segments.length / transcripts.length : 0;

      return {
        totalFiles: files.length,
        totalTranscripts: transcripts.length,
        totalSegments: segments.length,
        totalStorageSize,
        averageSegmentsPerTranscript: Math.round(averageSegmentsPerTranscript * 100) / 100,
        transcriptsByStatus,
      };
    } catch (error) {
      throw handleError(error, "DBUtils.getDatabaseStats");
    }
  },
};

// Export database instance
export default db;
