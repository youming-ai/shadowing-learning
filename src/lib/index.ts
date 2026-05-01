/**
 * 统一导入入口文件
 * 减少项目中重复导入语句
 */

export type {
  FileRow,
  ProcessingStatus,
  Segment,
  TranscriptRow,
} from "../types/db/database";
// 数据库相关
export { db } from "./db/db";
// API 相关
export { apiError, apiFromError, apiSuccess } from "./utils/api-response";
// 错误处理相关
export { handleError, logError } from "./utils/error-handler";
export {
  handleTranscriptionError,
  handleTranscriptionProgress,
  handleTranscriptionSuccess,
  type TranscriptionErrorContext,
} from "./utils/transcription-error-handler";

// 常量相关
export const API_ENDPOINTS = {
  TRANSCRIBE: "/api/transcribe",
  POSTPROCESS: "/api/postprocess",
  HEALTH: "/api/health",
} as const;

export const CACHE_TIMES = {
  DEFAULT: 5 * 60 * 1000, // 5 分钟
  LONG: 15 * 60 * 1000, // 15 分钟
  SHORT: 60 * 1000, // 1 分钟
} as const;

export {
  isValidAudioFile,
  MAX_FILES,
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_AUDIO_TYPES,
} from "./utils/file-validation";

export const TRANSCRIPTION_LANGUAGES = {
  JAPANESE: "ja",
  ENGLISH: "en",
  CHINESE: "zh",
} as const;
