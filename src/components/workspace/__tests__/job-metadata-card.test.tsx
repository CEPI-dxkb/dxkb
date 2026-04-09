import { render, screen } from "@testing-library/react";
import { JobMetadataCard } from "../job-metadata-card";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";

vi.mock("@/lib/jobs/formatting", () => ({
  formatElapsedSeconds: vi.fn((s: number | undefined) =>
    s != null ? `${s}s` : "—",
  ),
  formatUnixTimestamp: vi.fn((ts: number | undefined) =>
    ts != null ? `ts:${ts}` : "—",
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: vi.fn((...args: unknown[]) => args.filter(Boolean).join(" ")),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="collapsible-trigger">{children}</button>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    title?: string;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

function makeMeta(
  overrides?: Partial<ResolvedPathObject>,
): ResolvedPathObject {
  return {
    name: "TestJob",
    type: "job_result",
    path: "/user/home/TestJob",
    creation_time: "2024-01-01",
    id: "job-123",
    owner_id: "user@bvbrc",
    size: 0,
    userMeta: {},
    sysMeta: {},
    jobSysMeta: {
      id: "meta-id-1",
      app: { label: "Genome Assembly" },
      start_time: 1700000000,
      end_time: 1700003600,
      elapsed_time: 3600,
      parameters: { output_file: "result.fasta", recipe: "auto" },
    },
    taskData: undefined,
    ...overrides,
  } as ResolvedPathObject;
}

describe("JobMetadataCard", () => {
  it("renders the job title from app label", () => {
    render(<JobMetadataCard resolvedJobMeta={makeMeta()} />);
    expect(screen.getByText("Genome Assembly Job Result")).toBeInTheDocument();
  });

  it("renders job ID from jobSysMeta", () => {
    render(<JobMetadataCard resolvedJobMeta={makeMeta()} />);
    expect(screen.getByText("meta-id-1")).toBeInTheDocument();
  });

  it("falls back to taskData.task_id when jobSysMeta.id is missing", () => {
    const meta = makeMeta({
      jobSysMeta: {} as ResolvedPathObject["jobSysMeta"],
      taskData: { task_id: "task-456" } as ResolvedPathObject["taskData"],
    });
    render(<JobMetadataCard resolvedJobMeta={meta} />);
    expect(screen.getByText("task-456")).toBeInTheDocument();
  });

  it("shows em-dash when no job ID is available", () => {
    const meta = makeMeta({
      jobSysMeta: {} as ResolvedPathObject["jobSysMeta"],
      taskData: undefined,
    });
    render(<JobMetadataCard resolvedJobMeta={meta} />);
    // Should show "—" for job ID
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders elapsed time", () => {
    render(<JobMetadataCard resolvedJobMeta={makeMeta()} />);
    expect(screen.getByText("3600s")).toBeInTheDocument();
  });

  it("renders start and end timestamps", () => {
    render(<JobMetadataCard resolvedJobMeta={makeMeta()} />);
    expect(screen.getByText("ts:1700000000")).toBeInTheDocument();
    expect(screen.getByText("ts:1700003600")).toBeInTheDocument();
  });

  it("falls back to taskData for app label", () => {
    const meta = makeMeta({
      jobSysMeta: {} as ResolvedPathObject["jobSysMeta"],
      taskData: { app_id: "MetaCATS" } as ResolvedPathObject["taskData"],
    });
    render(<JobMetadataCard resolvedJobMeta={meta} />);
    expect(screen.getByText("MetaCATS Job Result")).toBeInTheDocument();
  });

  it("falls back to resolvedJobMeta.name for app label", () => {
    const meta = makeMeta({
      jobSysMeta: {} as ResolvedPathObject["jobSysMeta"],
      taskData: undefined,
    });
    render(<JobMetadataCard resolvedJobMeta={meta} />);
    expect(screen.getByText("TestJob Job Result")).toBeInTheDocument();
  });

  it("renders job parameters section", () => {
    render(<JobMetadataCard resolvedJobMeta={makeMeta()} />);
    expect(screen.getByText("Job Parameters")).toBeInTheDocument();
  });

  it("renders parameters as formatted JSON", () => {
    render(<JobMetadataCard resolvedJobMeta={makeMeta()} />);
    const pre = document.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain('"output_file"');
    expect(pre?.textContent).toContain('"recipe"');
  });
});
