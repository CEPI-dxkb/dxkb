import type { JsonOverride } from "../../mocks/backends";

/**
 * Same-origin `/api/copilot/*` answers (one model, no saved chats, empty
 * session) so the Copilot opens on its empty state; the gateway is never
 * reached.
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
