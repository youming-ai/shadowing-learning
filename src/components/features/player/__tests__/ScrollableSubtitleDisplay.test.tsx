import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Segment } from "@/types/db/database";
import ScrollableSubtitleDisplay from "../ScrollableSubtitleDisplay";

const mockSegments: Segment[] = [
  {
    id: 1,
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
  },
  {
    id: 2,
    transcriptId: 1,
    start: 3,
    end: 6,
    text: "This is a test",
    wordTimestamps: [],
    normalizedText: "This is a test",
    translation: "这是一个测试",
    annotations: [],
    furigana: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("ScrollableSubtitleDisplay Component", () => {
  const defaultProps = {
    segments: mockSegments,
    currentTime: 0,
    isPlaying: false,
    onSegmentClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all segments correctly", () => {
    render(<ScrollableSubtitleDisplay {...defaultProps} />);

    // Since text is split into words, we check for word elements
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
    expect(screen.getByText("This")).toBeInTheDocument();
    expect(screen.getByText("test")).toBeInTheDocument();
  });

  it("highlights current segment based on currentTime", () => {
    render(<ScrollableSubtitleDisplay {...defaultProps} currentTime={4} />);

    const segments = screen.getAllByTestId("subtitle-card");
    expect(segments[0]).not.toHaveClass("highlight");
    expect(segments[1]).toHaveClass("highlight");
  });

  it("does not highlight any segment when currentTime is after last segment", () => {
    render(<ScrollableSubtitleDisplay {...defaultProps} currentTime={10} />);

    const segments = screen.getAllByTestId("subtitle-card");
    segments.forEach((segment) => {
      expect(segment).not.toHaveClass("highlight");
    });
  });

  it("calls onSegmentClick when a segment is clicked", async () => {
    const user = userEvent.setup();
    const onSegmentClick = vi.fn();

    render(<ScrollableSubtitleDisplay {...defaultProps} onSegmentClick={onSegmentClick} />);

    const firstSegment = screen.getAllByTestId("subtitle-card")[0];
    await user.click(firstSegment);

    expect(onSegmentClick).toHaveBeenCalledWith(mockSegments[0]);
  });

  it("displays normalized text components when available", () => {
    const segmentsWithNormalized = [
      {
        ...mockSegments[0],
        normalizedText: "Normalized text",
        text: "Original text",
      },
    ];

    render(<ScrollableSubtitleDisplay {...defaultProps} segments={segmentsWithNormalized} />);

    expect(screen.getByText("Normalized")).toBeInTheDocument();
    expect(screen.getByText("text")).toBeInTheDocument();
  });

  it("displays translation when available", () => {
    render(<ScrollableSubtitleDisplay {...defaultProps} />);

    expect(screen.getByText("你好世界")).toBeInTheDocument();
    expect(screen.getByText("这是一个测试")).toBeInTheDocument();
  });

  it("handles empty segments array", () => {
    render(<ScrollableSubtitleDisplay {...defaultProps} segments={[]} />);

    expect(screen.getByText(/暂无字幕内容/i)).toBeInTheDocument();
  });

  it("handles scroll logic calls implicitly", () => {
    // Check if component renders without crashing with currentTime change
    const { rerender } = render(<ScrollableSubtitleDisplay {...defaultProps} />);
    rerender(<ScrollableSubtitleDisplay {...defaultProps} currentTime={4} />);
    expect(screen.getAllByTestId("subtitle-card")[1]).toHaveClass("highlight");
  });
});
