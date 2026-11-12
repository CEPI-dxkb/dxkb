import { act, renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useCopilotChat } from "@/hooks/copilot/use-copilot-chat";
import { copilotPagePath } from "@/lib/copilot/paths";
import { startCopilotTurn } from "@/lib/copilot/turn";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { CopilotProvider, useCopilot } from "../copilot-provider";
import { fakeChat } from "./fixtures/fake-copilot";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ user: { username: "alice" } }),
}));
vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("@/hooks/copilot/use-copilot-chat", () => ({ useCopilotChat: vi.fn() }));

function renderCopilot() {
  const QueryWrapper = createQueryClientWrapper();
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryWrapper>
      <CopilotProvider>{children}</CopilotProvider>
    </QueryWrapper>
  );
  return renderHook(() => useCopilot(), { wrapper });
}

beforeEach(() => {
  vi.mocked(usePathname).mockReturnValue("/jobs");
  vi.mocked(useCopilotChat).mockReturnValue(fakeChat());
  server.use(
    http.get("*/api/copilot/models", () => HttpResponse.json({ models: [] })),
  );
});

afterEach(() => {
  localStorage.clear();
});

describe("CopilotProvider minimize", () => {
  it("minimizes and restores the open surface", () => {
    const { result } = renderCopilot();
    act(() => {
      result.current.minimize();
    });
    expect(result.current.minimized).toBe(false);

    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.minimize();
    });
    expect(result.current).toMatchObject({ openSurface: "sheet", minimized: true });

    act(() => {
      result.current.restore();
    });
    expect(result.current).toMatchObject({ openSurface: "sheet", minimized: false });
  });

  it("opens the next time open, after a close", () => {
    const { result } = renderCopilot();
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.minimize();
    });
    act(() => {
      result.current.close();
    });
    expect(result.current).toMatchObject({ openSurface: null, minimized: false });

    act(() => {
      result.current.open();
    });
    expect(result.current.minimized).toBe(false);
  });

  it("opens another surface open", () => {
    const { result } = renderCopilot();
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.minimize();
    });
    act(() => {
      result.current.open("floating");
    });
    expect(result.current).toMatchObject({
      openSurface: "floating",
      preferredSurface: "floating",
      minimized: false,
    });
  });

  it("closes and resets on the full page, and leaving it reopens nothing", () => {
    const { result, rerender } = renderCopilot();
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.minimize();
    });

    vi.mocked(usePathname).mockReturnValue(copilotPagePath);
    rerender();
    expect(result.current).toMatchObject({ openSurface: null, minimized: false });

    vi.mocked(usePathname).mockReturnValue("/jobs");
    rerender();
    expect(result.current).toMatchObject({ openSurface: null, minimized: false });
  });

  it("marks a turn that ran while minimized as unread until restored", () => {
    const { result, rerender } = renderCopilot();
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.minimize();
    });
    expect(result.current.unread).toBe(false);

    vi.mocked(useCopilotChat).mockReturnValue(
      fakeChat({
        active: {
          sessionId: "s1",
          turn: { ...startCopilotTurn("t1", "hi"), status: "running" },
          baseCount: 0,
          clarificationAnswers: null,
          hidden: false,
          attachments: [],
        },
      }),
    );
    rerender();
    expect(result.current.unread).toBe(true);

    vi.mocked(useCopilotChat).mockReturnValue(fakeChat());
    rerender();
    expect(result.current.unread).toBe(true);

    act(() => {
      result.current.restore();
    });
    expect(result.current.unread).toBe(false);
  });
});
