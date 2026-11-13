import type { CopilotChat } from "@/hooks/copilot/use-copilot-chat";
import type { useCopilot } from "../../copilot-provider";

export type CopilotValue = ReturnType<typeof useCopilot>;

export function fakeChat(overrides: Partial<CopilotChat> = {}): CopilotChat {
  return {
    active: null,
    error: null,
    stopping: false,
    dismissError: vi.fn(),
    send: vi.fn(),
    stop: vi.fn(),
    reload: vi.fn(),
    pausedPlans: new Set(),
    pausePlan: vi.fn(),
    resumePlan: vi.fn(),
    isPlanPaused: () => false,
    ...overrides,
  };
}

/** A signed-in provider value with the side panel open on chat "s1". */
export function fakeCopilot(
  overrides: Partial<Omit<CopilotValue, "chat">> & {
    chat?: Partial<CopilotChat>;
  } = {},
): CopilotValue {
  const { chat, ...rest } = overrides;
  return {
    available: true,
    username: "alice",
    onCopilotPage: false,
    openSurface: "sheet",
    preferredSurface: "sheet",
    open: vi.fn(),
    close: vi.fn(),
    minimized: false,
    unread: false,
    minimize: vi.fn(),
    restore: vi.fn(),
    sessionId: "s1",
    selectSession: vi.fn(),
    newChat: vi.fn(),
    models: [
      {
        model: "m1",
        modelType: null,
        priority: null,
        maxTokens: null,
        supportsImage: true,
        isDefault: true,
      },
    ],
    modelsError: null,
    modelsLoading: false,
    model: "m1",
    setModel: vi.fn(),
    ...rest,
    chat: fakeChat(chat),
  };
}
