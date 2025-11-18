"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from "../../../../hooks/use-workspace";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Alert, AlertDescription } from "../../../../components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Separator } from "../../../../components/ui/separator";
import { RefreshCw, ArrowLeft, StopCircle, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { JobStatus } from "@/types/workspace";

const statusColors: Record<JobStatus, string> = {
  pending: "bg-yellow-500",
  queued: "bg-blue-500",
  running: "bg-green-500",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
  error: "bg-red-600",
};

const statusLabels: Record<JobStatus, string> = {
  pending: "Pending",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  error: "Error",
};

// Skeleton components for job detail page
function JobDetailHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-9 w-9" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

function JobInfoCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

function TabsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function JobDetailLoadingFallback() {
  return (
    <div className="space-y-6">
      <JobDetailHeaderSkeleton />
      <JobInfoCardSkeleton />
      <TabsSkeleton />
    </div>
  );
}

// Main job detail content component
function JobDetailContent() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  
  const {
    jobDetails,
    jobSummary,
    getJobDetails,
    getJobSummary,
    killJob,
    loading,
    error,
  } = useWorkspace();

  const [includeLogs, setIncludeLogs] = useState(false);

  // Load job details on mount
  useEffect(() => {
    if (jobId) {
      getJobDetails(jobId, includeLogs);
      getJobSummary(jobId);
    }
  }, [jobId, includeLogs, getJobDetails, getJobSummary]);

  const handleRefresh = () => {
    if (jobId) {
      getJobDetails(jobId, includeLogs);
      getJobSummary(jobId);
    }
  };

  const handleKillJob = async () => {
    if (jobId) {
      try {
        await killJob(jobId);
        toast.success("Job killed successfully");
        handleRefresh();
      } catch (error) {
        toast.error("Failed to kill job");
        console.error("Failed to kill job:", error);
      }
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(jobId);
    toast.success("Job ID copied to clipboard");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = endTime - startTime;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (error.details) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Job Details</h1>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            Error loading job details: {error.details}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!jobDetails) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Job Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{jobDetails.app}</h1>
            <div className="flex items-center space-x-2 mt-1">
              <p className="text-sm text-gray-500">ID: {jobDetails.id}</p>
              <Button variant="ghost" size="sm" onClick={handleCopyId}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge 
            variant="secondary" 
            className={`${statusColors[jobDetails.status]} text-white`}
          >
            {statusLabels[jobDetails.status]}
          </Badge>
          {(jobDetails.status === "running" || jobDetails.status === "queued") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleKillJob}
              disabled={loading.kill}
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Kill Job
            </Button>
          )}
          <Button onClick={handleRefresh} disabled={loading.details}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading.details ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Job Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="font-medium">Status</p>
              <p className="text-gray-600">{statusLabels[jobDetails.status]}</p>
            </div>
            <div>
              <p className="font-medium">Submitted</p>
              <p className="text-gray-600">{formatDate(jobDetails.submit_time)}</p>
            </div>
            {jobDetails.start_time && (
              <div>
                <p className="font-medium">Started</p>
                <p className="text-gray-600">{formatDate(jobDetails.start_time)}</p>
              </div>
            )}
            {jobDetails.completed_time && (
              <div>
                <p className="font-medium">Completed</p>
                <p className="text-gray-600">{formatDate(jobDetails.completed_time)}</p>
              </div>
            )}
          </div>
          
          {jobDetails.start_time && (
            <div className="mt-4">
              <p className="font-medium">Duration</p>
              <p className="text-gray-600">
                {formatDuration(jobDetails.start_time, jobDetails.completed_time)}
              </p>
            </div>
          )}
          
          {jobDetails.output_path && (
            <div className="mt-4">
              <p className="font-medium">Output Path</p>
              <p className="text-gray-600 font-mono text-sm">{jobDetails.output_path}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Information */}
      <Tabs defaultValue="parameters" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="system">System Info</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="app">Application</TabsTrigger>
        </TabsList>
        
        <TabsContent value="parameters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(jobDetails.parameters || {}).map(([key, value]) => (
                  <div key={key}>
                    <p className="font-medium">{key}</p>
                    <p className="text-gray-600 font-mono text-sm bg-gray-50 p-2 rounded">
                      {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {jobDetails.hostname && (
                  <div>
                    <p className="font-medium">Hostname</p>
                    <p className="text-gray-600">{jobDetails.hostname}</p>
                  </div>
                )}
                {jobDetails.pid && (
                  <div>
                    <p className="font-medium">Process ID</p>
                    <p className="text-gray-600">{jobDetails.pid}</p>
                  </div>
                )}
                {jobDetails.exitcode !== undefined && (
                  <div>
                    <p className="font-medium">Exit Code</p>
                    <p className="text-gray-600">{jobDetails.exitcode}</p>
                  </div>
                )}
                {jobDetails.maxrss && (
                  <div>
                    <p className="font-medium">Max RSS (MB)</p>
                    <p className="text-gray-600">{(jobDetails.maxrss / 1024).toFixed(2)}</p>
                  </div>
                )}
                {jobDetails.user_cpu && (
                  <div>
                    <p className="font-medium">User CPU Time</p>
                    <p className="text-gray-600">{jobDetails.user_cpu}s</p>
                  </div>
                )}
                {jobDetails.sys_cpu && (
                  <div>
                    <p className="font-medium">System CPU Time</p>
                    <p className="text-gray-600">{jobDetails.sys_cpu}s</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Job Logs</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIncludeLogs(!includeLogs)}
                >
                  {includeLogs ? "Hide Logs" : "Load Logs"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {includeLogs ? (
                <div className="space-y-4">
                  {jobDetails.stdout && (
                    <div>
                      <p className="font-medium mb-2">Standard Output</p>
                      <pre className="text-sm bg-gray-50 p-4 rounded overflow-x-auto">
                        {jobDetails.stdout}
                      </pre>
                    </div>
                  )}
                  {jobDetails.stderr && (
                    <div>
                      <p className="font-medium mb-2">Standard Error</p>
                      <pre className="text-sm bg-red-50 p-4 rounded overflow-x-auto">
                        {jobDetails.stderr}
                      </pre>
                    </div>
                  )}
                  {!jobDetails.stdout && !jobDetails.stderr && (
                    <p className="text-gray-500">No logs available</p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">Click "Load Logs" to view job output</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="app" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent>
              {jobDetails.app_definition ? (
                <div className="space-y-4">
                  <div>
                    <p className="font-medium">Application ID</p>
                    <p className="text-gray-600">{jobDetails.app_definition.id}</p>
                  </div>
                  <div>
                    <p className="font-medium">Label</p>
                    <p className="text-gray-600">{jobDetails.app_definition.label}</p>
                  </div>
                  <div>
                    <p className="font-medium">Description</p>
                    <p className="text-gray-600">{jobDetails.app_definition.description}</p>
                  </div>
                  <div>
                    <p className="font-medium">Script</p>
                    <p className="text-gray-600 font-mono text-sm">{jobDetails.app_definition.script}</p>
                  </div>
                  {jobDetails.app_definition.parameters && (
                    <div>
                      <p className="font-medium">Available Parameters</p>
                      <div className="space-y-2 mt-2">
                        {jobDetails.app_definition.parameters.map((param, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{param.label}</p>
                              <Badge variant={param.required ? "destructive" : "secondary"}>
                                {param.required ? "Required" : "Optional"}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">ID: {param.id}</p>
                            <p className="text-sm text-gray-600">Type: {param.type}</p>
                            {param.default !== undefined && (
                              <p className="text-sm text-gray-600">Default: {String(param.default)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No application details available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Main page component with Suspense
export default function JobDetailPage() {
  return (
    <Suspense fallback={<JobDetailLoadingFallback />}>
      <JobDetailContent />
    </Suspense>
  );
} 