import { act, render, renderHook, screen } from "@testing-library/react";

const answer = "Found **12** genomes";

// The renderer's load state is module-level: each test starts from a fresh
// copy of the module, before anything has loaded.
async function freshLazyMarkdown() {
  vi.resetModules();
  return import("../copilot-markdown-lazy");
}

afterEach(() => {
  vi.doUnmock("../copilot-markdown");
});

describe("lazy CopilotMarkdown", () => {
  it("shows the text as written until the renderer is in, then the markdown", async () => {
    const { CopilotMarkdown } = await freshLazyMarkdown();
    render(<CopilotMarkdown content={answer} />);

    expect(screen.getByText(answer)).toHaveClass("whitespace-pre-wrap");
    expect(await screen.findByText("12", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText(answer)).not.toBeInTheDocument();
  });

  it("is ready once loaded, and from then on draws markdown on the first render", async () => {
    const { CopilotMarkdown, loadCopilotMarkdown, useCopilotMarkdownReady } =
      await freshLazyMarkdown();
    const ready = renderHook(() => useCopilotMarkdownReady());
    expect(ready.result.current).toBe(false);

    await act(() => loadCopilotMarkdown());
    expect(ready.result.current).toBe(true);

    render(<CopilotMarkdown content={answer} />);
    expect(screen.getByText("12", { selector: "strong" })).toBeInTheDocument();
  });

  it("is ready with plain text answers when the renderer cannot load", async () => {
    vi.doMock("../copilot-markdown", () => {
      throw new Error("Failed to load chunk");
    });
    const { CopilotMarkdown, loadCopilotMarkdown, useCopilotMarkdownReady } =
      await freshLazyMarkdown();

    await expect(loadCopilotMarkdown()).resolves.toBeUndefined();
    const ready = renderHook(() => useCopilotMarkdownReady());
    expect(ready.result.current).toBe(true);

    render(<CopilotMarkdown content={answer} />);
    expect(screen.getByText(answer)).toHaveClass("whitespace-pre-wrap");
  });
});
