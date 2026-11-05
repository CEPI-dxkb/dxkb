import type { JsonOverride } from "../../mocks/backends";

/**
 * `/api/copilot/*` as the routes answer them: one model, no saved chats, and
 * an empty session, so the Copilot opens on its empty state ("Try asking").
 * The browser calls these same-origin routes, so this browser-side override
 * is the whole mock; the gateway is never reached.
 */
export const copilotOverrides: JsonOverride[] = [
  {
    url: /\/api\/copilot\/models(?:\?|$)/,
    method: "GET",
    body: {
      models: [
        {
          model: "e2e-model",
          modelType: "chat",
          priority: 1,
          maxTokens: 32768,
          supportsImage: false,
          isDefault: true,
        },
      ],
    },
  },
  {
    url: /\/api\/copilot\/sessions\/[^/?]+\/workflow-watches$/,
    method: "GET",
    body: { watches: [] },
  },
  {
    url: /\/api\/copilot\/sessions\?/,
    method: "GET",
    body: { sessions: [], total: 0, hasMore: false },
  },
  {
    url: /\/api\/copilot\/sessions\/[^/?]+(?:\?|$)/,
    method: "GET",
    body: {
      sessionId: "e2e-session",
      messages: [],
      executionMode: "plan",
      activeJobId: null,
    },
  },
];
