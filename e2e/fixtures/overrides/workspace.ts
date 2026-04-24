import type { JsonOverride } from "../../mocks/backends";

export const mockWorkspaceItems = [
  {
    name: "home",
    path: "/e2e-test-user@patricbrc.org/home",
    type: "folder",
    size: 0,
    created: "2026-01-01T00:00:00Z",
    updated: "2026-04-01T00:00:00Z",
  },
  {
    name: "sample.fastq",
    path: "/e2e-test-user@patricbrc.org/home/sample.fastq",
    type: "reads",
    size: 1048576,
    created: "2026-03-01T00:00:00Z",
    updated: "2026-03-01T00:00:00Z",
  },
  {
    name: "favorites.json",
    path: "/e2e-test-user@patricbrc.org/home/favorites.json",
    type: "json",
    size: 2,
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
  },
];

export const workspaceOverrides: JsonOverride[] = [
  {
    url: /\/services\/Workspace/,
    method: "POST",
    body: { result: [mockWorkspaceItems] },
  },
  {
    url: /\/api\/workspace\/view/,
    method: "GET",
    body: { items: mockWorkspaceItems },
  },
  {
    url: /\/api\/workspace\/preview/,
    method: "GET",
    body: { preview: "{}", contentType: "application/json" },
  },
];
