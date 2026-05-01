"use client";

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils/utils";
import type { Segment } from "@/types/db/database";

interface ScrollableSubtitleDisplayProps {
  segments: Segment[];
  currentTime: number;
  isPlaying: boolean;
  onSegmentClick?: (segment: Segment) => void;
  className?: string;
}

interface FuriganaEntry {
  text: string;
  reading: string;
}

interface Token {
  word: string;
  reading?: string;
  romaji?: string;
  start?: number;
  end?: number;
}

/**
 * 沿 DOM 树向上查找最近的可滚动祖先元素。
 * 用于判断字幕是否已经在滚动视口内可见。
 */
function findActiveSegmentIndexBinary(segments: Segment[], currentTime: number): number {
  let left = 0;
  let right = segments.length - 1;

  while (left <= right) {
    const mid = (left + right) >> 1;
    const segment = segments[mid];
    if (currentTime >= segment.start && currentTime <= segment.end) {
      return mid;
    }
    if (currentTime < segment.start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return -1;
}

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return document.scrollingElement as HTMLElement | null;
}

function normalizeFurigana(rawFurigana: unknown): FuriganaEntry[] {
  if (!rawFurigana) {
    return [];
  }

  if (Array.isArray(rawFurigana)) {
    return rawFurigana
      .map((entry) => {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          return trimmed ? { text: trimmed, reading: trimmed } : null;
        }

        if (entry && typeof entry === "object") {
          const candidate = entry as Record<string, unknown>;
          const textValue = typeof candidate.text === "string" ? candidate.text : undefined;
          const readingValue =
            typeof candidate.reading === "string" ? candidate.reading : undefined;

          if (textValue || readingValue) {
            const safeText = (textValue ?? readingValue ?? "").trim();
            const safeReading = (readingValue ?? textValue ?? "").trim();
            if (safeText && safeReading) {
              return { text: safeText, reading: safeReading };
            }
          }
        }

        return null;
      })
      .filter((entry): entry is FuriganaEntry => !!entry);
  }

  if (typeof rawFurigana === "string") {
    const trimmed = rawFurigana.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeFurigana(parsed);
    } catch (_error) {
      return trimmed
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => ({ text: token, reading: token }));
    }
  }

  if (typeof rawFurigana === "object") {
    return normalizeFurigana(Object.values(rawFurigana ?? {}));
  }

  return [];
}

const ScrollableSubtitleDisplay = React.memo<ScrollableSubtitleDisplayProps>(
  ({ segments, currentTime, isPlaying, onSegmentClick, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const activeSegmentRef = useRef<HTMLButtonElement>(null);
    const previousActiveIndex = useRef<number>(-1);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const safeCurrentTime =
      Number.isFinite(currentTime) && !Number.isNaN(currentTime) ? currentTime : 0;

    const findActiveSegmentIndex = useCallback(() => {
      return findActiveSegmentIndexBinary(segments, safeCurrentTime);
    }, [segments, safeCurrentTime]);

    useEffect(() => {
      const activeIndex = findActiveSegmentIndex();

      // 只有当active segment发生变化时才滚动
      if (activeIndex === previousActiveIndex.current || activeIndex === -1) {
        return;
      }

      previousActiveIndex.current = activeIndex;

      // 清除之前timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 实际滚动容器是 ScrollableSubtitleDisplay 的最近 overflow 祖先（通常是 <main>）。
      // 之前的实现错把 .player-subtitle-container 当滚动容器，但它没设 overflow。
      // 改用 scrollIntoView，由浏览器自动查找滚动祖先；同时手动检查可见性避免抖动。
      scrollTimeoutRef.current = setTimeout(
        () => {
          const activeElement = activeSegmentRef.current;
          if (!activeElement) return;

          const scrollParent = findScrollParent(activeElement);
          if (!scrollParent) return;

          const elementRect = activeElement.getBoundingClientRect();
          const parentRect = scrollParent.getBoundingClientRect();

          const fullyVisible =
            elementRect.top >= parentRect.top && elementRect.bottom <= parentRect.bottom;

          if (fullyVisible) {
            return;
          }

          activeElement.scrollIntoView({
            block: "center",
            behavior: isPlaying ? "smooth" : "auto",
          });
        },
        isPlaying ? 100 : 0,
      );

      return () => {
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }, [findActiveSegmentIndex, isPlaying]);

    const activeIndex = findActiveSegmentIndex();

    const segmentTokens = useMemo<Token[][]>(() => {
      return segments.map((segment) => {
        const furiganaEntries = normalizeFurigana(segment.furigana as unknown);

        if (Array.isArray(segment.wordTimestamps) && segment.wordTimestamps.length > 0) {
          return segment.wordTimestamps.map((timestamp, index) => ({
            word: timestamp.word,
            reading: furiganaEntries[index]?.reading,
            romaji: furiganaEntries[index]?.reading,
            start: timestamp.start,
            end: timestamp.end,
          })) as Token[];
        }

        if (furiganaEntries.length > 0) {
          return furiganaEntries.map((entry) => ({
            word: entry.text,
            reading: entry.reading,
            romaji: entry.reading,
          })) as Token[];
        }

        const tokenBaseText = segment.normalizedText || segment.text;
        if (tokenBaseText) {
          const tokens = tokenBaseText.split(/\s+/).filter(Boolean);

          if (tokens.length > 1) {
            return tokens.map((word) => ({ word })) as Token[];
          }
        }

        return [] as Token[];
      }) as Token[][];
    }, [segments]);

    return (
      <>
        {/*Subtitle容器*/}
        <div
          ref={containerRef}
          className={cn(
            "player-subtitle-container space-y-[var(--space-subtitle-gap)] text-left",
            className,
          )}
          data-testid="subtitle-scroll-container"
        >
          {segments.length === 0 ? (
            <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
              <p>暂无字幕内容</p>
            </div>
          ) : (
            segments.map((segment, index) => {
              const isActive = index === activeIndex;
              const tokens = segmentTokens[index] || [];
              const hasTokens = tokens.length > 0;

              // 显示文本
              const displayText = segment.normalizedText || segment.text;
              const lines = displayText
                .split(/\n+/)
                .map((line) => line.trim())
                .filter(Boolean);

              return (
                <button
                  type="button"
                  key={segment.id ?? `${segment.start}-${segment.end}-${index}`}
                  ref={isActive ? activeSegmentRef : null}
                  onClick={() => onSegmentClick?.(segment)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSegmentClick?.(segment);
                    }
                  }}
                  data-testid="subtitle-card"
                  data-active={isActive}
                  className={cn(
                    "subtitle-line mb-[var(--space-subtitle-gap)] w-full text-left",
                    isActive && "highlight",
                  )}
                  style={{
                    marginBottom: isActive
                      ? "var(--space-status-gap)"
                      : "var(--space-subtitle-gap)",
                  }}
                >
                  {hasTokens ? (
                    <div className="flex flex-wrap items-end justify-start gap-2">
                      {tokens.map((token, tokenIndex) => {
                        const isTokenActive =
                          isActive &&
                          typeof token.start === "number" &&
                          typeof token.end === "number" &&
                          safeCurrentTime >= token.start &&
                          safeCurrentTime <= token.end;

                        return (
                          <div
                            key={`${segment.id ?? index}-token-${tokenIndex}-${token.word}`}
                            className="word-group"
                            data-testid={isTokenActive ? "active-word" : undefined}
                          >
                            <span className="player-word-surface">{token.word}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1 text-left">
                      {lines.length > 0 ? (
                        lines.map((line, lineIndex) => (
                          <p
                            key={`${segment.id ?? index}-line-${lineIndex}`}
                            className="player-subtitle-original"
                          >
                            {line}
                          </p>
                        ))
                      ) : (
                        <p className="player-subtitle-original">{displayText}</p>
                      )}
                    </div>
                  )}

                  {/*Translation显示 - 在原文下方，使用较小灰色字体*/}
                  {segment.translation && (
                    <p className="player-subtitle-translation">{segment.translation}</p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </>
    );
  },
);

ScrollableSubtitleDisplay.displayName = "ScrollableSubtitleDisplay";

export default ScrollableSubtitleDisplay;
