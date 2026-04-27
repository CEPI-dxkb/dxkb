import type { JsonOverride } from "../../mocks/backends";

export interface MockJob {
  id: string;
  app: string;
  status:
    | "queued"
    | "running"
    | "in-progress"
    | "completed"
    | "failed"
    | "cancelled";
  submit_time: string;
  start_time?: string;
  completed_time?: string;
  owner?: string;
  parameters?: Record<string, unknown>;
  output_path?: string;
  output_file?: string;
}

export const mockJobs: MockJob[] = [
  {
    id: "job-001",
    app: "GenomeAssembly",
    status: "completed",
    submit_time: "2026-04-01T09:55:00Z",
    start_time: "2026-04-01T10:00:00Z",
    completed_time: "2026-04-01T10:30:00Z",
    parameters: { paired_end_libs: [{ read1: "r1.fastq", read2: "r2.fastq" }] },
  },
  {
    id: "job-002",
    app: "ProteomeComparison",
    status: "running",
    submit_time: "2026-04-20T11:58:00Z",
    start_time: "2026-04-20T12:00:00Z",
    parameters: {},
  },
];

/** 3-job lifecycle fixture used by jobs-lifecycle spec: queued / running / completed. */
export const mockLifecycleJobs: MockJob[] = [
  {
    id: "job-queued",
    app: "GenomeAssembly2",
    status: "queued",
    submit_time: "2026-04-20T08:00:00Z",
    parameters: {},
  },
  {
    id: "job-running",
    app: "GenomeAssembly2",
    status: "running",
    submit_time: "2026-04-20T07:50:00Z",
    start_time: "2026-04-20T07:55:00Z",
    parameters: {},
  },
  {
    id: "job-completed",
    app: "GenomeAnnotation",
    status: "completed",
    submit_time: "2026-04-20T06:00:00Z",
    start_time: "2026-04-20T06:05:00Z",
    completed_time: "2026-04-20T06:45:00Z",
    parameters: {},
    output_path: "/e2e-test-user@patricbrc.org/home",
    output_file: "annotation-result",
  },
];

/** Summary buckets derived from a job list. Drives the toolbar status counts. */
function summarizeJobs(jobs: MockJob[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const j of jobs) {
    summary[j.status] = (summary[j.status] ?? 0) + 1;
  }
  return summary;
}

function appSummary(jobs: MockJob[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const j of jobs) {
    summary[j.app] = (summary[j.app] ?? 0) + 1;
  }
  return summary;
}

interface BuildJobsOverridesOptions {
  jobs?: MockJob[];
  /** Per-job stdout content. Defaults to "Starting job...\nDone.\n". */
  stdoutById?: Record<string, string>;
  stderrById?: Record<string, string>;
  /** Response shape for the kill POST. Defaults to `{ success: true, message: "killed" }`. */
  killResponse?: unknown;
  /** Response for the submit POST. Defaults to a freshly-generated job. */
  submitResponse?: unknown;
  /** Fails the enumerate endpoint with a 500 when true. */
  simulateFailure?: boolean;
}

export function buildJobsOverrides(
  options: BuildJobsOverridesOptions = {},
): JsonOverride[] {
  const jobs = options.jobs ?? mockJobs;
  const stdoutById = options.stdoutById ?? {};
  const stderrById = options.stderrById ?? {};
  const killResponse = options.killResponse ?? {
    success: true,
    message: "Kill request accepted",
  };

  const overrides: JsonOverride[] = [];

  overrides.push({
    url: /\/api\/services\/app-service\/jobs\/enumerate-tasks-filtered$/,
    method: "POST",
    ...(options.simulateFailure
      ? { status: 500, body: { message: "Simulated jobs failure" } }
      : { body: { jobs, totalTasks: jobs.length } }),
  });

  overrides.push({
    url: /\/api\/services\/app-service\/jobs\/summary$/,
    method: "POST",
    body: {
      taskSummary: summarizeJobs(jobs),
      appSummary: appSummary(jobs),
    },
  });

  for (const job of jobs) {
    overrides.push({
      url: new RegExp(`/api/services/app-service/jobs/${job.id}(?:\\?|$)`),
      method: "GET",
      body: job,
    });
    overrides.push({
      url: new RegExp(`/api/services/app-service/jobs/${job.id}/stdout$`),
      method: "GET",
      body: stdoutById[job.id] ?? "Starting job...\nDone.\n",
    });
    overrides.push({
      url: new RegExp(`/api/services/app-service/jobs/${job.id}/stderr$`),
      method: "GET",
      body: stderrById[job.id] ?? "",
    });
    overrides.push({
      url: new RegExp(`/api/services/app-service/jobs/${job.id}/kill$`),
      method: "POST",
      body: killResponse,
    });
  }

  overrides.push({
    url: /\/api\/services\/app-service\/submit$/,
    method: "POST",
    body:
      options.submitResponse ??
      {
        job: [
          {
            id: "job-new",
            app: "GenomeAssembly2",
            status: "queued",
            submit_time: "2026-04-24T12:00:00Z",
          },
        ],
      },
  });

  return overrides;
}

export const jobsOverrides: JsonOverride[] = buildJobsOverrides({ jobs: mockJobs });

export const jobsListOverrides: JsonOverride[] = buildJobsOverrides({
  jobs: mockLifecycleJobs,
});

export const jobsEmptyOverrides: JsonOverride[] = buildJobsOverrides({ jobs: [] });

export const jobsErrorOverrides: JsonOverride[] = buildJobsOverrides({
  jobs: [],
  simulateFailure: true,
});
