export const SUPPORTED_AUDIO_TYPES = [
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/mp4",
  "audio/ogg",
  "audio/flac",
] as const;

export const SUPPORTED_AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|ogg|flac)$/i;

export const MAX_FILES = 5;

export function isValidAudioFile(file: File): boolean {
  return (
    (SUPPORTED_AUDIO_TYPES as readonly string[]).includes(file.type) ||
    SUPPORTED_AUDIO_EXTENSIONS.test(file.name)
  );
}

interface AudioSignature {
  bytes: number[];
  offset: number;
  type: string;
}

const AUDIO_SIGNATURES: AudioSignature[] = [
  { bytes: [0x49, 0x44, 0x33], offset: 0, type: "audio/mpeg" }, // MP3 with ID3
  { bytes: [0xff, 0xfb], offset: 0, type: "audio/mpeg" }, // MP3 frame
  { bytes: [0xff, 0xfa], offset: 0, type: "audio/mpeg" },
  { bytes: [0xff, 0xf3], offset: 0, type: "audio/mpeg" },
  { bytes: [0xff, 0xf2], offset: 0, type: "audio/mpeg" },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, type: "audio/wav" }, // RIFF
  { bytes: [0x66, 0x4c, 0x61, 0x43], offset: 0, type: "audio/flac" }, // fLaC
  { bytes: [0x4f, 0x67, 0x67, 0x53], offset: 0, type: "audio/ogg" }, // OggS
  { bytes: [0xff, 0xf1], offset: 0, type: "audio/aac" }, // AAC ADTS
  { bytes: [0xff, 0xf9], offset: 0, type: "audio/aac" },
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, type: "audio/mp4" }, // ftyp (M4A)
];

const MALICIOUS_SIGNATURES: number[][] = [
  [0x4d, 0x5a], // PE executable (MZ)
  [0x7f, 0x45, 0x4c, 0x46], // ELF
  [0xfe, 0xed, 0xfa, 0xcf], // Mach-O
  [0xce, 0xfa, 0xed, 0xfe], // Mach-O universal
  [0x50, 0x4b, 0x03, 0x04], // ZIP — 防止伪装的归档
];

async function readHeader(file: File, bytesToRead = 32): Promise<Uint8Array> {
  const slice = file.slice(0, Math.min(bytesToRead, file.size));
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

function bytesMatch(header: Uint8Array, signature: number[], offset: number): boolean {
  if (header.length < offset + signature.length) return false;
  return signature.every((byte, i) => header[offset + i] === byte);
}

export interface FileSignatureCheck {
  isValid: boolean;
  detectedType: string | null;
  reason?: string;
}

/**
 * 通过文件头 magic number 检测真实类型，过滤掉伪装成音频的可执行文件等。
 * 仅做轻量校验，不做完整音频解码（那个交给后端 Whisper 处理）。
 */
export async function checkFileSignature(file: File): Promise<FileSignatureCheck> {
  try {
    const header = await readHeader(file);

    if (header.length === 0) {
      return { isValid: false, detectedType: null, reason: "EMPTY_FILE" };
    }

    for (const sig of MALICIOUS_SIGNATURES) {
      if (bytesMatch(header, sig, 0)) {
        return { isValid: false, detectedType: null, reason: "MALICIOUS_SIGNATURE" };
      }
    }

    for (const sig of AUDIO_SIGNATURES) {
      if (bytesMatch(header, sig.bytes, sig.offset)) {
        // WAV 需要确认 RIFF 后面是 WAVE
        if (sig.type === "audio/wav" && header.length >= 12) {
          const wave = String.fromCharCode(...header.slice(8, 12));
          if (wave !== "WAVE") continue;
        }
        return { isValid: true, detectedType: sig.type };
      }
    }

    return { isValid: false, detectedType: null, reason: "UNKNOWN_SIGNATURE" };
  } catch (error) {
    return {
      isValid: false,
      detectedType: null,
      reason: error instanceof Error ? error.message : "READ_ERROR",
    };
  }
}
