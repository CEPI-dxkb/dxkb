import { checkWorkspaceObjectExists } from "@/lib/services/workspace/validation";

describe("checkWorkspaceObjectExists", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when response.ok", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const result = await checkWorkspaceObjectExists("/user/home/file.txt");

    expect(result).toBe(true);
  });

  it("returns false when response is not ok", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await checkWorkspaceObjectExists("/user/home/missing.txt");

    expect(result).toBe(false);
  });

  it("returns false when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await checkWorkspaceObjectExists("/user/home/file.txt");

    expect(result).toBe(false);
  });

  it("returns false for empty path", async () => {
    const result = await checkWorkspaceObjectExists("");

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns false for whitespace-only path", async () => {
    const result = await checkWorkspaceObjectExists("   ");

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("passes AbortSignal to fetch", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    const controller = new AbortController();

    await checkWorkspaceObjectExists("/user/home/file.txt", {
      signal: controller.signal,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/services/workspace",
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it("sends Workspace.get request with the full path", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    await checkWorkspaceObjectExists("/user/home/my-file.txt");

    expect(mockFetch).toHaveBeenCalledWith("/api/services/workspace", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "Workspace.get",
        params: [{ objects: ["/user/home/my-file.txt"], metadata_only: true }],
      }),
      signal: undefined,
    });
  });
});
