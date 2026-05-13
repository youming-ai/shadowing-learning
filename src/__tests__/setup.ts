import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";

// Set fake-indexeddb
import "fake-indexeddb/auto";

// 清理 mock
afterEach(() => {
  vi.clearAllMocks();
});

// 模拟 window.matchMedia
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // 模拟 ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // 模拟 IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // 模拟 PerformanceObserver
  const MockPerformanceObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  }));
  (MockPerformanceObserver as unknown as { supportedEntryTypes: string[] }).supportedEntryTypes = [
    "mark",
    "measure",
    "navigation",
  ];
  global.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver;

  // 模拟 URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

// 模拟 @tanstack/react-router
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: "/", search: {}, hash: "" }),
    useSearch: () => ({}),
    useParams: () => ({}),
  };
});

// 模拟 sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));
