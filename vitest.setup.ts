import "@testing-library/jest-dom/vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => props,
}));

// Suppress console.error noise in tests (auto-restored by restoreMocks)
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

// MSW server lifecycle — strict mode rejects any unhandled fetch calls
import { server } from "@/test-helpers/msw-server";
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
