import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FileUpload from "../FileUpload";

// Mock dependencies
vi.mock("@/components/layout/contexts/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "file.upload.dragDrop": "Drag and drop audio files",
        "file.upload.orClick": "or click to select",
        "file.upload.uploading": "Uploading...",
        "file.upload.selectFiles": "Select Files",
        "file.upload.maxFilesReached": "Max files reached",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("@/lib/utils/logger", () => ({
  fileLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("FileUpload Component", () => {
  const defaultProps = {
    onFilesSelected: vi.fn(),
    className: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders upload area correctly", () => {
    render(<FileUpload {...defaultProps} />);

    expect(screen.getByText(/Drag and drop audio files/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to select/i)).toBeInTheDocument();
  });

  it("shows loading state when uploading", () => {
    render(<FileUpload {...defaultProps} isUploading={true} />);

    expect(screen.getByText(/Uploading/i)).toBeInTheDocument();
  });

  it("applies theme classes based on state", () => {
    const { container } = render(<FileUpload {...defaultProps} isUploading={true} />);
    const uploadArea = container.querySelector(".upload-area");
    expect(uploadArea).toHaveClass("disabled");
  });

  it("displays max files reached message when limit exceeded", () => {
    render(<FileUpload {...defaultProps} currentFileCount={5} maxFiles={5} />);

    expect(screen.getAllByText(/Max files reached/i).length).toBeGreaterThan(0);
  });
});
