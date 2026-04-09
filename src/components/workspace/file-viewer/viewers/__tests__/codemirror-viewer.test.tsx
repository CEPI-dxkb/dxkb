import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { CodeMirrorViewer } from "../codemirror-viewer";

const mockTriggerDownload = vi.fn();

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
  };
});

vi.mock("../../file-viewer-registry", () => ({
  getProxyUrl: vi.fn(
    (path: string) => `/api/workspace/view/${path.replace(/^\//, "")}`,
  ),
}));

vi.mock("../codemirror-languages", () => ({
  getLanguageExtension: vi.fn(() => Promise.resolve(null)),
}));

// CodeMirror uses requestAnimationFrame for batched rendering
const flushRaf = () =>
  vi.advanceTimersByTime(16);

beforeEach(() => {
  mockTriggerDownload.mockClear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CodeMirrorViewer", () => {
  it("shows loading state initially", () => {
    server.use(
      http.get("/api/workspace/view/*", () => {
        // Never respond — keep loading
        return new Promise(() => void 0);
      }),
    );

    render(
      <CodeMirrorViewer
        filePath="/user/test.txt"
        fileName="test.txt"
      />,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    server.use(
      http.get("/api/workspace/view/*", () => {
        return HttpResponse.json(null, { status: 500 });
      }),
    );

    render(
      <CodeMirrorViewer
        filePath="/user/test.txt"
        fileName="test.txt"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load file (HTTP 500)"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("shows truncation banner for files exceeding threshold", async () => {
    server.use(
      http.get("/api/workspace/view/*", () => {
        const chunkSize = 1024 * 1024; // 1 MB chunks
        const totalChunks = 51; // 51 MB total
        const chunk = new Uint8Array(chunkSize).fill(65); // 'A'

        const stream = new ReadableStream({
          start(controller) {
            for (let i = 0; i < totalChunks; i++) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });

        return new HttpResponse(stream, {
          headers: { "Content-Length": String(chunkSize * totalChunks) },
        });
      }),
    );

    render(
      <CodeMirrorViewer
        filePath="/user/large.json"
        fileName="large.json"
        fileSize={100 * 1024 * 1024} // 100 MB total
      />,
    );

    // Flush rAF so pending text gets flushed to editor
    flushRaf();

    await waitFor(() => {
      expect(screen.getByText(/Preview truncated to/)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/10\.0 MB of 100\.0 MB/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Download full file" })).toBeInTheDocument();
  });

  it("does not show truncation banner for small files", async () => {
    const content = "hello world";

    server.use(
      http.get("/api/workspace/view/*", () => {
        return new HttpResponse(content, {
          headers: { "Content-Type": "text/plain" },
        });
      }),
    );

    render(
      <CodeMirrorViewer
        filePath="/user/small.txt"
        fileName="small.txt"
        fileSize={content.length}
      />,
    );

    flushRaf();

    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    expect(screen.queryByText(/Preview truncated/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Download full file"),
    ).not.toBeInTheDocument();
  });

  it("download button in truncation banner triggers download", async () => {
    const chunkSize = 1024 * 1024;
    const totalChunks = 51;
    const chunk = new Uint8Array(chunkSize).fill(65);

    server.use(
      http.get("/api/workspace/view/*", () => {
        const stream = new ReadableStream({
          start(controller) {
            for (let i = 0; i < totalChunks; i++) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });

        return new HttpResponse(stream, {
          headers: { "Content-Length": String(chunkSize * totalChunks) },
        });
      }),
    );

    render(
      <CodeMirrorViewer
        filePath="/user/big.json"
        fileName="big.json"
        fileSize={200 * 1024 * 1024}
      />,
    );

    flushRaf();

    await waitFor(() => {
      expect(screen.getByText("Download full file")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Download full file"));
    expect(mockTriggerDownload).toHaveBeenCalledWith(
      "/api/workspace/view/user/big.json",
    );
  });
});
