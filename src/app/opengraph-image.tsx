import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "影子跟读 Shadowing - AI 驱动的多语言跟读学习工具";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "80px",
        background: "linear-gradient(135deg, #0b1120 0%, #1e3a8a 60%, #3b82f6 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 32,
          letterSpacing: 8,
          opacity: 0.85,
          marginBottom: 24,
        }}
      >
        SHADOWING
      </div>
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          lineHeight: 1.05,
          marginBottom: 32,
        }}
      >
        影子跟读
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 500,
          opacity: 0.92,
          maxWidth: 960,
          lineHeight: 1.3,
        }}
      >
        AI 驱动的多语言跟读学习工具
      </div>
      <div
        style={{
          marginTop: 40,
          fontSize: 28,
          opacity: 0.75,
        }}
      >
        中文 · English · 日本語 · 한국어
      </div>
    </div>,
    { ...size },
  );
}
