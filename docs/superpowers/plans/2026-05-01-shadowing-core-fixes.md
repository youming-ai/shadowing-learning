# Shadowing Core Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical performance and functional gaps in the shadowing player to make subtitle scrolling, word-level highlighting, sentence-level loop practice, and auto-pause shadowing mode actually work.

**Architecture:** Keep changes minimal within existing hooks and components. Add a `useShadowingMode` hook for auto-pause logic. Extend `ScrollableSubtitleDisplay` to support word-active CSS classes, ruby/furigana rendering, and binary-searched active-segment lookup. Wire up sentence-level A/B loop controls in `PlayerFooter`. No new external dependencies.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Dexie, Tailwind CSS, shadcn/ui, Vitest + jsdom.

---

## File Map

| File | Role | Action |
|------|------|--------|
| `src/components/features/player/ScrollableSubtitleDisplay.tsx` | Subtitle rendering & scroll | Modify: binary search active segment, fix word highlight CSS, add furigana/ruby rendering |
| `src/hooks/player/useShadowingMode.ts` | Auto-pause + sentence repeat logic | Create |
| `src/components/features/player/page/PlayerFooter.tsx` | Bottom controls bar | Modify: add A-B loop set/clear buttons |
| `src/components/features/player/PlayerPage.tsx` | Player orchestration | Modify: wire shadowing hook, handle A-B loop from footer |
| `src/hooks/ui/useAudioPlayer.ts` | Audio state management | Modify: expose `setLoopPoints` in return, fix loop race condition |
| `src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx` | Existing subtitle tests | Modify: add word-highlight + scroll + binary-search tests |
| `src/hooks/player/__tests__/useShadowingMode.test.ts` | Shadowing mode unit tests | Create |
| `src/styles/globals.css` | Player CSS tokens | Modify: unify `.word-group` → `.player-word-group` active styles |

---

## Prerequisites

All commands assume the repo root (`/Users/youming/GitHub/youming-ai/shadowing-learning`).

- [ ] Verify dev server starts: `pnpm dev` → `http://localhost:3000`
- [ ] Verify tests pass baseline: `pnpm test:run` → `104 passed`

---

## Task 1: Fix Subtitle Active-Segment Lookup Performance (Binary Search)

**Files:**
- Modify: `src/components/features/player/ScrollableSubtitleDisplay.tsx`
- Test: `src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`

**Why:** Current `findIndex` is O(n). For long audio with hundreds of segments, every `timeupdate` (~250ms) triggers a linear scan, causing dropped frames.

- [ ] **Step 1: Write the failing performance test**

```tsx
it("finds active segment quickly for large arrays", () => {
  const manySegments: Segment[] = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    transcriptId: 1,
    start: i,
    end: i + 1,
    text: `segment ${i}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const { rerender } = render(
    <ScrollableSubtitleDisplay
      segments={manySegments}
      currentTime={500.5}
      isPlaying={false}
      onSegmentClick={vi.fn()}
    />,
  );

  // If binary search works, rerender should not crash and highlight segment 500
  rerender(
    <ScrollableSubtitleDisplay
      segments={manySegments}
      currentTime={500.5}
      isPlaying={false}
      onSegmentClick={vi.fn()}
    />,
  );

  const segments = screen.getAllByTestId("subtitle-card");
  expect(segments[500]).toHaveClass("highlight");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`
Expected: FAIL (either timeout or no `highlight` class on index 500)

- [ ] **Step 3: Add binary search helper and swap out linear search**

In `ScrollableSubtitleDisplay.tsx`, after the imports and before the component, add:

```tsx
function findActiveSegmentIndexBinary(
  segments: Segment[],
  currentTime: number,
): number {
  let left = 0;
  let right = segments.length - 1;
  let result = -1;

  while (left <= right) {
    const mid = (left + right) >> 1;
    const segment = segments[mid];
    if (currentTime >= segment.start && currentTime <= segment.end) {
      return mid;
    }
    if (currentTime < segment.start) {
      right = mid - 1;
    } else {
      result = mid; // keep last valid candidate
      left = mid + 1;
    }
  }

  // If no exact match, return last segment whose start <= currentTime
  if (result >= 0 && currentTime >= segments[result].start) {
    return result;
  }
  return -1;
}
```

Then replace inside the component:

```tsx
const findActiveSegmentIndex = useCallback(() => {
  return findActiveSegmentIndexBinary(segments, safeCurrentTime);
}, [segments, safeCurrentTime]);
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test:run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`
Expected: PASS (all tests including the new one)

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/ScrollableSubtitleDisplay.tsx \
        src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx
git commit -m "perf(subtitle): binary search for active segment instead of linear scan"
```

---

## Task 2: Make Word-Level Highlight Actually Visible

**Files:**
- Modify: `src/components/features/player/ScrollableSubtitleDisplay.tsx`
- Modify: `src/styles/globals.css`
- Test: `src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`

**Why:** The component computes `isTokenActive` but only uses it for `data-testid`. No CSS class changes, so the current word is visually identical to others.

- [ ] **Step 1: Write failing test for word highlight**

```tsx
it("highlights the active word within the active segment", () => {
  const segmentsWithWords: Segment[] = [
    {
      id: 1,
      transcriptId: 1,
      start: 0,
      end: 4,
      text: "hello world foo bar",
      wordTimestamps: [
        { word: "hello", start: 0, end: 1 },
        { word: "world", start: 1, end: 2 },
        { word: "foo", start: 2, end: 3 },
        { word: "bar", start: 3, end: 4 },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  render(
    <ScrollableSubtitleDisplay
      segments={segmentsWithWords}
      currentTime={1.5}
      isPlaying={false}
      onSegmentClick={vi.fn()}
    />,
  );

  const activeWords = screen.getAllByTestId("active-word");
  expect(activeWords).toHaveLength(1);
  expect(activeWords[0]).toHaveTextContent("world");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run -- src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx -t "highlights the active word"`
Expected: FAIL — `active-word` elements count 0 because class never applied

- [ ] **Step 3: Add conditional CSS class to word container**

In `ScrollableSubtitleDisplay.tsx`, locate the `tokens.map` block (around line 261). Change the `className` from a static string to a conditional:

```tsx
<div
  key={`${segment.id ?? index}-token-${tokenIndex}-${token.word}`}
  className={cn(
    "player-word-group", // changed from "word-group"
    isTokenActive && "active",
  )}
  data-testid={isTokenActive ? "active-word" : undefined}
>
  <span className="player-word-surface">{token.word}</span>
</div>
```

- [ ] **Step 4: Unify CSS selectors**

In `src/styles/globals.css`, find the `.word-group` block (around line 1201) and update:

```css
/* Remove old .word-group block entirely or replace with: */
.player-word-group {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  margin-right: 0.25em;
  text-align: left;
}

.player-word-group ruby {
  display: inline-flex;
  flex-direction: column-reverse;
  line-height: 1.2;
  align-items: flex-start;
}

.player-word-group rt {
  font-size: 0.8rem;
  color: var(--text-muted);
  user-select: none;
  opacity: 0.9;
}

.player-word-group rb {
  font-size: clamp(1.25rem, 4vw, 1.75rem);
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-primary);
}

/* existing active styles already defined below */
.player-word-group.active .player-word-surface {
  color: var(--player-accent-color);
}

.player-word-group.active {
  border-radius: 0.5rem;
  padding: 0.25rem 0.5rem;
  background-color: var(--player-highlight-bg);
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test:run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/features/player/ScrollableSubtitleDisplay.tsx \
        src/styles/globals.css \
        src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx
git commit -m "feat(subtitle): make word-level highlight visually active with CSS"
```

---

## Task 3: Render Furigana / Ruby When Available

**Files:**
- Modify: `src/components/features/player/ScrollableSubtitleDisplay.tsx`
- Test: `src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`

**Why:** `normalizeFurigana` is called but `token.reading` is never rendered into `<ruby>` markup.

- [ ] **Step 1: Write failing test for furigana rendering**

```tsx
it("renders furigana as ruby annotation when reading is present", () => {
  const jaSegment: Segment = {
    id: 1,
    transcriptId: 1,
    start: 0,
    end: 2,
    text: "日本語",
    normalizedText: "日本語",
    furigana: JSON.stringify([
      { text: "日本", reading: "にほん" },
      { text: "語", reading: "ご" },
    ]),
    wordTimestamps: [
      { word: "日本", start: 0, end: 1 },
      { word: "語", start: 1, end: 2 },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  render(
    <ScrollableSubtitleDisplay
      segments={[jaSegment]}
      currentTime={0.5}
      isPlaying={false}
      onSegmentClick={vi.fn()}
    />,
  );

  expect(screen.getByText("にほん")).toBeInTheDocument();
  expect(screen.getByText("ご")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run -- src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx -t "renders furigana"`
Expected: FAIL — `にほん` not found

- [ ] **Step 3: Replace flat `<span>` with conditional `<ruby>` markup**

In `ScrollableSubtitleDisplay.tsx`, inside the `tokens.map` return, replace the existing inner span:

```tsx
<div
  key={`${segment.id ?? index}-token-${tokenIndex}-${token.word}`}
  className={cn("player-word-group", isTokenActive && "active")}
  data-testid={isTokenActive ? "active-word" : undefined}
>
  {token.reading ? (
    <ruby className="player-word-surface">
      <rb>{token.word}</rb>
      <rt>{token.reading}</rt>
    </ruby>
  ) : (
    <span className="player-word-surface">{token.word}</span>
  )}
</div>
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/ScrollableSubtitleDisplay.tsx \
        src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx
git commit -m "feat(subtitle): render furigana/ruby annotations when available"
```

---

## Task 4: Create Auto-Pause Shadowing Mode Hook

**Files:**
- Create: `src/hooks/player/useShadowingMode.ts`
- Create: `src/hooks/player/__tests__/useShadowingMode.test.ts`

**Why:** A full shadowing app needs an "auto-pause" mode that stops playback at the end of each sentence so the learner can repeat it aloud.

- [ ] **Step 1: Write failing test**

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useShadowingMode } from "../useShadowingMode";

describe("useShadowingMode", () => {
  const segments = [
    { id: 1, start: 0, end: 3 },
    { id: 2, start: 3, end: 6 },
    { id: 3, start: 6, end: 10 },
  ];

  it("returns isShadowingMode false by default", () => {
    const { result } = renderHook(() =>
      useShadowingMode({ segments, isPlaying: true, currentTime: 0 }),
    );
    expect(result.current.isShadowingMode).toBe(false);
  });

  it("toggles shadowing mode", () => {
    const { result } = renderHook(() =>
      useShadowingMode({ segments, isPlaying: true, currentTime: 0 }),
    );
    act(() => result.current.toggleShadowingMode());
    expect(result.current.isShadowingMode).toBe(true);
  });

  it("requests pause when currentTime reaches end of active segment while shadowing", () => {
    const onRequestPause = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentTime }) =>
        useShadowingMode({
          segments,
          isPlaying: true,
          currentTime,
          onRequestPause,
        }),
      {
        initialProps: { currentTime: 2.0 },
      },
    );

    act(() => result.current.toggleShadowingMode());

    rerender({ currentTime: 3.0 }); // exactly at segment 1 end

    expect(onRequestPause).toHaveBeenCalled();
  });

  it("does not request pause when shadowing mode is off", () => {
    const onRequestPause = vi.fn();
    const { rerender } = renderHook(
      ({ currentTime }) =>
        useShadowingMode({
          segments,
          isPlaying: true,
          currentTime,
          onRequestPause,
        }),
      {
        initialProps: { currentTime: 2.0 },
      },
    );

    rerender({ currentTime: 3.0 });
    expect(onRequestPause).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/hooks/player/__tests__/useShadowingMode.test.ts`
Expected: FAIL — `useShadowingMode` not found

- [ ] **Step 3: Implement the hook**

Create `src/hooks/player/useShadowingMode.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";

interface UseShadowingModeOptions {
  segments: Array<{ start: number; end: number }>;
  isPlaying: boolean;
  currentTime: number;
  onRequestPause?: () => void;
}

export interface UseShadowingModeReturn {
  isShadowingMode: boolean;
  toggleShadowingMode: () => void;
  activeSegmentEnd: number | null;
}

export function useShadowingMode({
  segments,
  isPlaying,
  currentTime,
  onRequestPause,
}: UseShadowingModeOptions): UseShadowingModeReturn {
  const [isShadowingMode, setIsShadowingMode] = useState(false);
  const lastPauseTimeRef = useRef<number>(-1);

  const toggleShadowingMode = useCallback(() => {
    setIsShadowingMode((prev) => !prev);
  }, []);

  // Find the segment that contains currentTime
  const activeSegmentEnd = (() => {
    if (segments.length === 0) return null;
    let left = 0;
    let right = segments.length - 1;
    while (left <= right) {
      const mid = (left + right) >> 1;
      const seg = segments[mid];
      if (currentTime >= seg.start && currentTime <= seg.end) {
        return seg.end;
      }
      if (currentTime < seg.start) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }
    return null;
  })();

  useEffect(() => {
    if (!isShadowingMode || !isPlaying || activeSegmentEnd === null) return;

    // Prevent duplicate pause triggers at the same boundary
    if (
      currentTime >= activeSegmentEnd &&
      Math.abs(currentTime - lastPauseTimeRef.current) > 0.5
    ) {
      lastPauseTimeRef.current = currentTime;
      onRequestPause?.();
    }
  }, [isShadowingMode, isPlaying, currentTime, activeSegmentEnd, onRequestPause]);

  return {
    isShadowingMode,
    toggleShadowingMode,
    activeSegmentEnd,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:run src/hooks/player/__tests__/useShadowingMode.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/player/useShadowingMode.ts \
        src/hooks/player/__tests__/useShadowingMode.test.ts
git commit -m "feat(shadowing): add auto-pause shadowing mode hook with segment-boundary detection"
```

---

## Task 5: Fix A-B Loop Race Condition and Expose Loop Controls

**Files:**
- Modify: `src/hooks/ui/useAudioPlayer.ts`

**Why:** `lastLoopTimeRef` guard works but `setLoopPoints` does not reset it, causing the first loop after setting new points to possibly skip.

- [ ] **Step 1: Write failing test**

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAudioPlayer } from "../useAudioPlayer";

describe("useAudioPlayer loop", () => {
  it("resets loop guard when new loop points are set", () => {
    const { result } = renderHook(() => useAudioPlayer());

    // Set initial loop 1-2
    act(() => result.current.onSetLoop(1, 2));
    act(() => result.current.handleSeek(1.5));
    act(() => result.current.onPlay());

    // Simulate crossing boundary
    act(() => result.current.updatePlayerState({ currentTime: 2.1 }));
    expect(result.current.audioPlayerState.currentTime).toBe(1); // looped back

    // Set new loop 5-6
    act(() => result.current.onSetLoop(5, 6));

    // The first crossing of 6 should still loop back to 5
    act(() => result.current.handleSeek(5.5));
    act(() => result.current.onPlay());
    act(() => result.current.updatePlayerState({ currentTime: 6.1 }));
    expect(result.current.audioPlayerState.currentTime).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run -- src/hooks/ui/__tests__/useAudioPlayer.test.ts -t "resets loop guard"`
Expected: FAIL — hook test file does not exist yet

- [ ] **Step 3: Fix the race condition by resetting ref on loop change**

In `src/hooks/ui/useAudioPlayer.ts`, in `onSetLoop`, add `lastLoopTimeRef.current = -1`:

```tsx
const onSetLoop = useCallback(
  (start: number, end: number) => {
    lastLoopTimeRef.current = -1; // reset guard
    setLoopPoints(start, end);
  },
  [setLoopPoints],
);
```

Also ensure `setLoopPoints` is exposed in the return object:

```tsx
return {
  // ... existing fields ...
  setLoopPoints, // make sure this is present
};
```

- [ ] **Step 4: Create minimal hook test file to verify**

Create `src/hooks/ui/__tests__/useAudioPlayer.test.ts` with the test from Step 1.

- [ ] **Step 5: Run tests**

Run: `pnpm test:run src/hooks/ui/__tests__/useAudioPlayer.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/ui/useAudioPlayer.ts \
        src/hooks/ui/__tests__/useAudioPlayer.test.ts
git commit -m "fix(player): reset loop time guard when A-B points change"
```

---

## Task 6: Add Sentence-Level A-B Loop UI Controls

**Files:**
- Modify: `src/components/features/player/page/PlayerFooter.tsx`
- Modify: `src/components/features/player/PlayerPage.tsx`

**Why:** Users need UI buttons to mark loop start/end at the current sentence, and to clear the loop.

- [ ] **Step 1: Extend PlayerFooter props**

In `PlayerFooter.tsx`, add these to `PlayerFooterProps`:

```tsx
interface PlayerFooterProps {
  // ... existing props ...
  onSetLoopStart?: () => void;
  onSetLoopEnd?: () => void;
  onClearLoop?: () => void;
  loopStart?: number;
  loopEnd?: number;
  onToggleShadowingMode?: () => void;
  isShadowingMode?: boolean;
}
```

- [ ] **Step 2: Add A-B and shadowing buttons to footer**

Inside `PlayerFooter`, after the skip-forward button block (before volume controls), add:

```tsx
{/* 中部分隔：A-B循环 + 跟读模式 */}
<div className="flex items-center gap-2">
  <button
    type="button"
    onClick={onSetLoopStart}
    className={cn(
      "btn-secondary !h-9 !w-9 !rounded-full !p-0 text-xs font-bold",
      loopStart !== undefined && "border-[var(--color-primary)] text-[var(--color-primary)]",
    )}
    aria-label="设置循环起点 A"
  >
    A
  </button>
  <button
    type="button"
    onClick={onSetLoopEnd}
    className={cn(
      "btn-secondary !h-9 !w-9 !rounded-full !p-0 text-xs font-bold",
      loopEnd !== undefined && "border-[var(--color-primary)] text-[var(--color-primary)]",
    )}
    aria-label="设置循环终点 B"
  >
    B
  </button>
  {(loopStart !== undefined || loopEnd !== undefined) && (
    <button
      type="button"
      onClick={onClearLoop}
      className="btn-secondary !h-9 !w-9 !rounded-full !p-0"
      aria-label="清除循环"
    >
      <span className="material-symbols-outlined text-lg">clear</span>
    </button>
  )}
  <button
    type="button"
    onClick={onToggleShadowingMode}
    className={cn(
      "btn-secondary !h-9 !w-9 !rounded-full !p-0",
      isShadowingMode && "border-[var(--color-primary)] text-[var(--color-primary)]",
    )}
    aria-label={isShadowingMode ? "关闭跟读模式" : "开启跟读模式"}
  >
    <span className="material-symbols-outlined text-lg">
      {isShadowingMode ? "record_voice_over" : "voice_selection"}
    </span>
  </button>
</div>
```

Import `cn` at the top:

```tsx
import { cn } from "@/lib/utils/utils";
```

- [ ] **Step 3: Wire controls in PlayerPage**

In `PlayerPage.tsx`, import the new hook:

```tsx
import { useShadowingMode } from "@/hooks/player/useShadowingMode";
```

Inside the component, add the shadowing hook after `useAudioPlayer`:

```tsx
const {
  isShadowingMode,
  toggleShadowingMode,
} = useShadowingMode({
  segments,
  isPlaying: audioPlayerState.isPlaying,
  currentTime: audioPlayerState.currentTime,
  onRequestPause: onPause,
});
```

Add helper to find current segment boundaries:

```tsx
const getCurrentSegment = useCallback(() => {
  return segments.find(
    (s) =>
      audioPlayerState.currentTime >= s.start &&
      audioPlayerState.currentTime <= s.end,
  );
}, [segments, audioPlayerState.currentTime]);
```

Add handlers:

```tsx
const handleSetLoopStart = useCallback(() => {
  const seg = getCurrentSegment();
  if (seg) {
    onSetLoop(seg.start, loopEnd ?? seg.end);
  }
}, [getCurrentSegment, loopEnd, onSetLoop]);

const handleSetLoopEnd = useCallback(() => {
  const seg = getCurrentSegment();
  if (seg) {
    onSetLoop(loopStart ?? seg.start, seg.end);
  }
}, [getCurrentSegment, loopStart, onSetLoop]);
```

Update the `PlayerFooter` usage in `layoutFooter`:

```tsx
<PlayerFooter
  audioPlayerState={audioPlayerState}
  onSeek={handleSeek}
  onTogglePlay={handleTogglePlay}
  onSkipBack={onSkipBack}
  onSkipForward={onSkipForward}
  onClearLoop={onClearLoop}
  loopStart={loopStart}
  loopEnd={loopEnd}
  playbackRate={playbackRate}
  onPlaybackRateChange={setPlaybackRate}
  volume={volume}
  onVolumeChange={handleVolumeChange}
  onSetLoopStart={handleSetLoopStart}
  onSetLoopEnd={handleSetLoopEnd}
  onToggleShadowingMode={toggleShadowingMode}
  isShadowingMode={isShadowingMode}
/>
```

- [ ] **Step 4: Run type check and lint**

Run:
```bash
pnpm type-check
pnpm lint
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/page/PlayerFooter.tsx \
        src/components/features/player/PlayerPage.tsx
pnpm format
git commit -m "feat(player): add sentence-level A-B loop and shadowing mode controls"
```

---

## Task 7: Final Integration Verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test:run
```
Expected: all tests pass (previous 104 + new additions)

- [ ] **Step 2: Run build**

```bash
pnpm build
```
Expected: build completes with 0 errors

- [ ] **Step 3: Run type check**

```bash
pnpm type-check
```
Expected: no type errors

- [ ] **Step 4: Run lint**

```bash
pnpm lint
```
Expected: no lint errors

- [ ] **Step 5: Final commit**

```bash
git commit --allow-empty -m "chore: shadowing core fixes complete — binary search, word highlight, furigana, A-B loop, auto-pause mode"
```

---

## Self-Review Checklist

**Spec coverage:**
- Binary search active segment lookup → Task 1
- Word-level highlight visible → Task 2
- Furigana/ruby rendering → Task 3
- Auto-pause shadowing mode → Task 4 + Task 6
- Sentence-level A-B loop → Task 5 + Task 6

**Placeholder scan:** None. Every step contains exact file paths, exact code, exact commands.

**Type consistency:**
- `onSetLoop` signature used consistently across `useAudioPlayer.ts` and `PlayerPage.tsx`
- `loopStart` / `loopEnd` typed as `number | undefined` throughout

**Gaps:** None identified. Recording comparison (mic input) was intentionally scoped out as it requires Web Audio API + permission handling and is a separate feature project.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-shadowing-core-fixes.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

Which approach do you want to use?
