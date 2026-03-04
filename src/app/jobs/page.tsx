"use client";

import { useEffect, useState, useRef, useMemo, Suspense } from "react";
import { useWorkspace } from "@/hooks/services/workspace/use-workspace";
import { JobStatus, JobListItem } from "@/types/workspace";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from "next/link";
import {
  RefreshCw,
  Search,
  Eye,
  StopCircle,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Download,
  Pause,
  Trash2,
} from "lucide-react";

const statusColors: Record<JobStatus, string> = {
  pending: "bg-gray-500",
  queued: "bg-blue-500",
  "in-progress": "bg-yellow-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-orange-500",
  error: "bg-red-600",
  running: "bg-yellow-500",
};

const statusLabels: Record<JobStatus, string> = {
  pending: "Pending",
  queued: "Queued",
  "in-progress": "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  error: "Error",
  running: "Running",
};

// Skeleton components for different sections
function JobsHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-10 w-24" />
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-20" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
      <div className="flex-1">
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="flex space-x-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}

function JobCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-row gap-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-6 w-16" />
            <div className="flex space-x-1">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-row gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function JobsLoadingFallback() {
  return (
    <div className="w-full space-y-6">
      <JobsHeaderSkeleton />
      <SummaryCardSkeleton />
      <FiltersSkeleton />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// Main jobs content component
function JobsContent() {
  const { jobs, enumerateJobs, killJob, fetchJobOutput, loading, error } =
    useWorkspace();
  const isMountedRef = useRef(false);

  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [jobOutputs, setJobOutputs] = useState<
    Record<string, { stdout?: string; stderr?: string }>
  >({});

  // Load jobs on mount only
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      enumerateJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter jobs based on search and filters - memoized to prevent unnecessary re-computations
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Skip jobs with missing required fields
      if (!job?.id || !job?.app) {
        return false;
      }

      const outputFile = String(job.parameters?.output_file ?? "");
      const matchesSearch =
        job.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.app.toLowerCase().includes(searchTerm.toLowerCase()) ||
        outputFile.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || job.status === statusFilter;
      const matchesApp = appFilter === "all" || job.app === appFilter;

      return matchesSearch && matchesStatus && matchesApp;
    });
  }, [jobs, searchTerm, statusFilter, appFilter]);

  // Get unique apps for filter - memoized
  const uniqueApps = useMemo(() => {
    return Array.from(
      new Set(jobs.map((job) => job.app).filter(Boolean)),
    ).sort();
  }, [jobs]);

  const handleRefresh = () => {
    enumerateJobs();
  };

  const handleKillJob = async (jobId: string) => {
    try {
      await killJob(jobId);
      // Refresh the jobs list after killing
      await enumerateJobs();
    } catch (error) {
      console.error("Failed to kill job:", error);
    }
  };

  const onViewDetails = (job: JobListItem) => {
    window.open(`/jobs/${job.id}`, "_blank");
  };

  const handleExpandJob = async (jobId: string) => {
    const newExpandedJobIds = new Set(expandedJobIds);

    if (newExpandedJobIds.has(jobId)) {
      newExpandedJobIds.delete(jobId);
    } else {
      newExpandedJobIds.add(jobId);
    }

    setExpandedJobIds(newExpandedJobIds);

    if (newExpandedJobIds.has(jobId) && !jobOutputs[jobId]) {
      try {
        const [stdout, stderr] = await Promise.all([
          fetchJobOutput({ job_id: jobId, output_type: "stdout" }),
          fetchJobOutput({ job_id: jobId, output_type: "stderr" }),
        ]);

        setJobOutputs((prev) => ({
          ...prev,
          [jobId]: { stdout, stderr },
        }));
      } catch (error) {
        console.error("Failed to fetch job outputs:", error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">Jobs</h1>
        <Button
          onClick={handleRefresh}
          disabled={loading.enumerate}
          className="text-white"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading.enumerate ? "animate-spin" : ""}`}
            data-icon="inline-start"
          />
          Refresh
        </Button>
      </div>

      {error.enumerate && (
        <Alert variant="destructive">
          <AlertDescription>
            Error loading jobs: {error.enumerate}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-2xl font-bold">{jobs.length}</p>
              <p className="text-sm text-gray-500">Total Jobs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {jobs.filter((t) => t.status === "completed").length}
              </p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {jobs.filter((t) => t.status === "in-progress").length}
              </p>
              <p className="text-sm text-gray-500">Running</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {jobs.filter((t) => t.status === "failed").length}
              </p>
              <p className="text-sm text-gray-500">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <Select
            items={[
              { value: "all", label: "All Status" },
              ...Object.entries(statusLabels).map(([status, label]) => ({ value: status, label })),
            ]}
            value={statusFilter}
            onValueChange={(value) =>
              value != null && setStatusFilter(value as JobStatus | "all")
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusLabels).map(([status, label]) => (
                  <SelectItem key={status} value={status}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            items={[
              { value: "all", label: "All Apps" },
              ...uniqueApps.map((app) => ({ value: app, label: app })),
            ]}
            value={appFilter}
            onValueChange={(value) => setAppFilter(value ?? "")}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Application" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All Apps</SelectItem>
                {uniqueApps.map((app, index) => (
                  <SelectItem key={`app-${app}-${index}`} value={app}>
                    {app}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Job Cards */}
      <div className="space-y-4">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-gray-500">No jobs found</p>
                <p className="text-sm text-gray-400">
                  {searchTerm || statusFilter !== "all" || appFilter !== "all"
                    ? "Try adjusting your filters"
                    : "You haven't submitted any jobs yet"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex flex-row gap-4">
                    <CardTitle className="text-lg">{job.app}</CardTitle>
                    <p className="text-muted-foreground flex items-center text-sm">
                      ID: {job.id}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant="secondary"
                      className={`${statusColors[job.status]} text-white`}
                    >
                      {statusLabels[job.status]}
                    </Badge>
                    <div className="flex space-x-1">
                      <Link
                        href={`/jobs/${job.id}`}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        <Eye className="h-4 w-4" data-icon="inline-start" />
                      </Link>
                      {(job.status === "in-progress" ||
                        job.status === "queued") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleKillJob(job.id)}
                          disabled={loading.kill}
                        >
                          <StopCircle className="h-4 w-4" data-icon="inline-start" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div className="flex flex-row gap-2">
                    <p className="font-medium">Submitted</p>
                    <p className="text-muted-foreground">
                      {formatDate(job.submit_time)}
                    </p>
                  </div>
                  {job.start_time && (
                    <div className="flex flex-row gap-2">
                      <p className="font-medium">Started</p>
                      <p className="text-muted-foreground">
                        {formatDate(job.start_time)}
                      </p>
                    </div>
                  )}
                  {job.completed_time && (
                    <div className="flex flex-row gap-2">
                      <p className="font-medium">Completed</p>
                      <p className="text-muted-foreground">
                        {formatDate(job.completed_time)}
                      </p>
                    </div>
                  )}
                  {job.parameters?.output_file != null && String(job.parameters.output_file) !== "" && (
                    <div className="flex flex-row gap-2">
                      <p className="text-sm font-medium">Output File</p>
                      <p className="text-muted-foreground text-sm">
                        {String(job.parameters.output_file)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
                      <MoreHorizontal className="h-4 w-4" data-icon="inline-start" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetails(job)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="mr-2 h-4 w-4" />
                        Download Results
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {job.status === "in-progress" && (
                        <DropdownMenuItem>
                          <Pause className="mr-2 h-4 w-4" />
                          Pause Job
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Job
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExpandJob(job.id)}
                  >
                    {expandedJobIds.has(job.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {expandedJobIds.has(job.id) && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-sm font-medium">
                          Input Size
                        </p>
                        <p>N/A</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-sm font-medium">
                          Output Size
                        </p>
                        <p>N/A</p>
                      </div>
                    </div>

                    {/* Parameters */}
                    <Accordion>
                      <AccordionItem
                        value={`parameters-${job.id}`}
                      >
                        <AccordionTrigger>
                          Job Parameters
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="bg-muted rounded-md p-3">
                            <pre className="text-foreground text-xs whitespace-pre-wrap">
                              {JSON.stringify(job.parameters, null, 2)}
                            </pre>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <Accordion>
                      <AccordionItem
                        value={`stdout-${job.id}`}
                      >
                        <AccordionTrigger>
                          Standard Output
                        </AccordionTrigger>
                        <AccordionContent className="accordion-content">
                          <div className="bg-muted rounded-md p-3">
                            <pre className="text-foreground text-xs whitespace-pre-wrap">
                              {loading.output
                                ? "Loading..."
                                : jobOutputs[job.id]?.stdout ||
                                  "No output available"}
                            </pre>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <Accordion>
                      <AccordionItem
                        value={`stderr-${job.id}`}
                      >
                        <AccordionTrigger>
                          Standard Error
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="bg-muted rounded-md p-3">
                            <pre className="text-foreground text-xs whitespace-pre-wrap">
                              {loading.output
                                ? "Loading..."
                                : jobOutputs[job.id]?.stderr ||
                                  "No output available"}
                            </pre>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {job.status === "failed" && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3">
                        <p className="mb-1 text-sm font-medium text-red-800">
                          Error Message
                        </p>
                        <p className="text-sm text-red-700">
                          Job failed to complete
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// Main page component with Suspense
export default function JobsPage() {
  return (
    <Suspense fallback={<JobsLoadingFallback />}>
      <JobsContent />
    </Suspense>
  );
}
