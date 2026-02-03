import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Link } from "wouter";
import { useAuthContext } from "@/context/AuthProvider";
import { CsvUploader } from "@/components/core/CsvUploader";
import { PromptManager } from "@/components/core/PromptManager";
import { ProcessMonitor } from "@/components/core/ProcessMonitor";
import { PreviewModal } from "@/components/core/PreviewModal";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/telemetry";
import { api } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import type { PromptConfig } from "@shared/schema";
import type { EnrichmentJob } from "@shared/schema";
import type { FileUploadResponse, PreviewResponse, JobWithLogs } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { validatePrompts, type PromptValidationIssue } from "@shared/promptValidation";
import { createEmptyUiPrompt, type UiPrompt } from "@/lib/uiPrompts";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Gauge, FolderOpen, Workflow, ListChecks } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MC } from "@/lib/microcopy";
import { HelpTip } from "@/components/ui/help-tip";
import { useRealtimeJob } from "@/hooks/useRealtimeJob";

// Using shared UiPrompt type and factory from lib/uiPrompts

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuthContext();
  const [uploadedFile, setUploadedFile] = useState<FileUploadResponse | null>(null);
  const [prompts, setPrompts] = useState<UiPrompt[]>([createEmptyUiPrompt()]);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(() => {
    // Try to restore job ID from sessionStorage on page load
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("currentJobId");
    }
    return null;
  });
  
  // Separate state for ProcessMonitor display - persists job data independent of active state
  const [displayJobData, setDisplayJobData] = useState<JobWithLogs | null>(null);

  // Validation error modal state
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<PromptValidationIssue[]>([]);
  // Collision confirmation state
  const [isCollisionConfirmOpen, setIsCollisionConfirmOpen] = useState(false);
  const [collisionIssues, setCollisionIssues] = useState<PromptValidationIssue[]>([]);
  const [pendingStartPayload, setPendingStartPayload] = useState<{ fileId: string; promptsConfig: PromptConfig[]; options?: { skipIfExistingValue?: boolean } } | null>(null);
  // Global job-level skip toggle (default OFF)
  const [skipIfExistingValue, setSkipIfExistingValue] = useState<boolean>(false);
  // Queue confirmation state
  const [isQueueConfirmOpen, setIsQueueConfirmOpen] = useState(false);

  // Queries
  const { data: jobData, isLoading: isJobLoading } = useQuery({
    queryKey: [`/api/jobs/${currentJobId}`],
    enabled: !!currentJobId,
    // Light polling to avoid missing last logs if realtime closes early
    refetchInterval: (data) => {
      // data here is the parsed response from the API
      const jobWithLogs = data as unknown as JobWithLogs | null;
      const job = jobWithLogs?.job;
      if (!job) return 0;
      return ["completed", "failed", "stopped"].includes(job.status) ? false : 5000;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Queued jobs count for quick visibility (refetch periodically)
  const { data: queuedJobs } = useQuery<EnrichmentJob[] | null>({
    queryKey: ["/api/history?status=queued&limit=200"],
    refetchInterval: 10000,
    staleTime: 5000,
  });
  const queuedCount = Array.isArray(queuedJobs) ? queuedJobs.length : 0;

  // Sync job data: update displayJobData whenever we receive new job data
  useEffect(() => {
    const latestJobData = jobData as JobWithLogs | null;
    if (latestJobData) {
      console.log(`[Dashboard] Updating displayJobData with latest job state: ${latestJobData.job.status}`);
      setDisplayJobData(latestJobData);
    }
  }, [jobData]);

  // Clear currentJobId when job reaches terminal state (for enabling new jobs)
  useEffect(() => {
    const job = (jobData as JobWithLogs | null)?.job;
    if (job && currentJobId && ["completed", "failed", "stopped"].includes(job.status)) {
      console.log(`[Dashboard] Job ${job.jobId} reached terminal state: ${job.status}. Clearing active job state.`);
      
      // Clear active job state immediately - displayJobData persists for ProcessMonitor
      setCurrentJobId(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("currentJobId");
      }
    }
  }, [jobData, currentJobId]);

  // Mutations
  const previewMutation = useMutation({
    mutationFn: (data: { fileId: string; promptsConfig: PromptConfig[]; options?: { skipIfExistingValue?: boolean } }) => api.jobs.preview(data as any),
    onSuccess: async (response) => {
      const preview: PreviewResponse = await response.json();
      console.debug("[Dashboard] preview response", {
        hasDetailed: Boolean((preview as any)?.detailed),
        detailedLen: Array.isArray((preview as any)?.detailed) ? (preview as any).detailed.length : 0,
        previewDataLen: Array.isArray(preview?.previewData) ? preview.previewData.length : 0,
        meta: (preview as any)?.meta,
      });
      setPreviewData(preview);
      setIsPreviewModalOpen(true);
      track("preview_success", { requestId: preview?.meta?.requestId });
    },
    onError: (error: any) => {
      // If server returned structured validation issues, surface them in the existing modal
      const issues = (error as any)?.details?.validationIssues as PromptValidationIssue[] | undefined;
      if (error?.code === "JOBS_INVALID_INPUT" && Array.isArray(issues) && issues.length > 0) {
        console.log("[Dashboard] Preview failed with server-side validation issues – showing modal", issues);
        setValidationIssues(issues);
        setIsValidationOpen(true);
      } else {
        toast({
          title: "Preview failed",
          description:
            (error?.code ? `Code: ${error.code}. ` : "") +
            "Failed to generate preview. Please check your prompts and try again.",
          variant: "destructive",
        });
      }
      track("preview_error", {
        message: String(error?.message || error),
        code: (error as any)?.code,
        requestId: (error as any)?.requestId,
      });
    },
  });

  const createJobMutation = useMutation({
    mutationFn: (data: { fileId: string; promptsConfig: PromptConfig[]; options?: { skipIfExistingValue?: boolean }; forceQueue?: boolean }) => api.jobs.create(data as any),
    onSuccess: async (response) => {
      const { jobId, requestId } = await response.json();
      
      // Clear any previous job display data when starting a new job
      setDisplayJobData(null);
      setCurrentJobId(jobId);

      // Save to sessionStorage to persist across re-renders
      if (typeof window !== "undefined") {
        sessionStorage.setItem("currentJobId", jobId);
      }
      toast({
        title: "Job started",
        description: "Your data enrichment job has been started successfully.",
      });
      track("job_start_success", { jobId, requestId });
    },
    onError: (error: any) => {
      let errorMessage = "Please check your prompts and try again.";
      let errorTitle = "Failed to start job";
      
      // Handle specific error codes
      if (error?.code === "JOBS_ACTIVE_JOB_EXISTS") {
        // Sync active job if provided
        if (error?.activeJobId && error.activeJobId !== currentJobId) {
          console.log(`[Dashboard] Backend reports active job: ${error.activeJobId}. Syncing frontend state.`);
          setCurrentJobId(error.activeJobId);
          if (typeof window !== "undefined") {
            sessionStorage.setItem("currentJobId", error.activeJobId);
          }
          // Keep informational toast (requested)
          toast({
            title: "Active job found",
            description: `Found an active job that wasn't visible. The process monitor will now show it.`,
          });
        }
        // Open queue modal; do not show a destructive toast
        track("queue_modal_open", { activeJobId: error?.activeJobId || currentJobId });
        setIsQueueConfirmOpen(true);
        return;
      } else if (error?.code === "JOBS_QUEUE_LIMIT_EXCEEDED") {
        errorTitle = "Queue is full";
        errorMessage = "You already have 2 queued jobs. Please wait or delete one of the queued jobs before adding another.";
      } else {
        errorMessage = (error?.code ? `Code: ${error.code}. ` : "") + errorMessage;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      track("job_start_error", {
        message: String(error?.message || error),
        code: (error as any)?.code,
        requestId: (error as any)?.requestId,
        activeJobId: (error as any)?.activeJobId,
      });
    },
  });

  // Debug mutation to sync state with backend
  const debugSyncMutation = useMutation({
    mutationFn: async () => {
      // Align with apiRequest to ensure Authorization header is sent
      const res = await apiRequest('GET', '/api/debug/active-jobs');
      return await res.json();
    },
    onSuccess: (data) => {
      console.log('[Dashboard] Debug sync response:', data);
      
      if (data.activeJobs && data.activeJobs.length > 0) {
        const activeJob = data.activeJobs[0];
        console.log(`[Dashboard] Found active job via debug sync: ${activeJob.jobId}`);
        
        // Sync frontend state with the active job
        setCurrentJobId(activeJob.jobId);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("currentJobId", activeJob.jobId);
        }
        
        toast({
          title: "Job state synchronized",
          description: `Found active job (${activeJob.status}). Process monitor will now display it.`,
        });
      } else {
        toast({
          title: "No active jobs found",
          description: "Your account has no active jobs in the database.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: "Unable to sync job state. Please try refreshing the page.",
        variant: "destructive",
      });
      console.error('[Dashboard] Debug sync failed:', error);
    },
  });

  const handleFileUploaded = (fileData: FileUploadResponse) => {
    setUploadedFile(fileData);
    setCurrentJobId(null);
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setCurrentJobId(null);
    setDisplayJobData(null); // Clear display data when removing file
    
    // Clear job ID from session storage
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("currentJobId");
    }
    setPrompts([createEmptyUiPrompt()]);
  };

  const handlePreview = () => {
    if (!uploadedFile) return;

    const validPrompts = prompts.filter((p) => p.promptText && p.outputColumnName);
    if (validPrompts.length === 0) {
      toast({
        title: "No valid prompts",
        description: "Please add at least one complete prompt before previewing.",
        variant: "destructive",
      });
      return;
    }

    // Run shared validation before calling backend
    const payloadPrompts: PromptConfig[] = validPrompts.map(({ promptText, outputColumnName, model, ...rest }) => ({
      systemText: (rest as any).systemText,
      promptText,
      outputColumnName,
      model,
      modelId: (rest as any).modelId,
    }));

    const validation = validatePrompts(payloadPrompts, uploadedFile.columnHeaders || []);
    if (!validation.ok) {
      // Treat collisions as warnings for Preview; block on other issues
      const blocking = validation.issues.filter((iss) => iss.type !== "outputCollidesWithInputHeader");
      const collisions = validation.issues.filter((iss) => iss.type === "outputCollidesWithInputHeader");
      if (blocking.length > 0) {
        console.log("[Dashboard] Prompt validation failed with blocking issues (preview)", blocking);
        setValidationIssues(blocking);
        setIsValidationOpen(true);
        return;
      }
      if (collisions.length > 0) {
        console.log("[Dashboard] Prompt validation encountered collisions (preview) – proceeding with warning", collisions);
        toast({
          title: "Column collisions detected",
          description: "Preview will proceed, but some output names match existing CSV headers.",
        });
        // fall through to proceed with preview
      }
    }

    // Strip UI-only localId before sending to API
    previewMutation.mutate({
      fileId: uploadedFile.fileId,
      promptsConfig: payloadPrompts,
      options: { skipIfExistingValue },
    });
  };

  const handleStartProcessing = () => {
    if (!uploadedFile) return;

    const validPrompts = prompts.filter((p) => p.promptText && p.outputColumnName);
    if (validPrompts.length === 0) {
      toast({
        title: "No valid prompts",
        description: "Please add at least one complete prompt before starting.",
        variant: "destructive",
      });
      return;
    }

    // Preemptive queue modal when we already know there is an active job
    if (currentJobId) {
      const payloadPromptsPre: PromptConfig[] = validPrompts.map(({ promptText, outputColumnName, model, ...rest }) => ({
        systemText: (rest as any).systemText,
        promptText,
        outputColumnName,
        model,
        modelId: (rest as any).modelId,
      }));
      setPendingStartPayload({ fileId: uploadedFile.fileId, promptsConfig: payloadPromptsPre, options: { skipIfExistingValue } });
      console.log("[Dashboard] Active job detected; opening queue confirmation modal (preemptive)");
      track("queue_modal_open", { activeJobId: currentJobId });
      setIsQueueConfirmOpen(true);
      return;
    }

    // Strip UI-only localId and validate before sending to API
    const payloadPrompts: PromptConfig[] = validPrompts.map(({ promptText, outputColumnName, model, ...rest }) => ({
      systemText: (rest as any).systemText,
      promptText,
      outputColumnName,
      model,
      modelId: (rest as any).modelId,
    }));

    const validation = validatePrompts(payloadPrompts, uploadedFile.columnHeaders || []);
    if (!validation.ok) {
      // Split into blocking vs collisions; collisions are warnings that can be confirmed
      const blocking = validation.issues.filter((iss) => iss.type !== "outputCollidesWithInputHeader");
      const collisions = validation.issues.filter((iss) => iss.type === "outputCollidesWithInputHeader");
      if (blocking.length > 0) {
        console.log("[Dashboard] Prompt validation failed with blocking issues (start)", blocking);
        setValidationIssues(blocking);
        setIsValidationOpen(true);
        return;
      }
      if (collisions.length > 0) {
        console.log("[Dashboard] Prompt validation encountered collisions (start) – showing confirmation", collisions);
        setCollisionIssues(collisions);
        setPendingStartPayload({ fileId: uploadedFile.fileId, promptsConfig: payloadPrompts, options: { skipIfExistingValue } });
        setIsCollisionConfirmOpen(true);
        return;
      }
    }

    // If an active job is present, open queue confirmation
    if (currentJobId) {
      setPendingStartPayload({ fileId: uploadedFile.fileId, promptsConfig: payloadPrompts, options: { skipIfExistingValue } });
      console.log("[Dashboard] Active job detected; opening queue confirmation modal");
      track("queue_modal_open", { activeJobId: currentJobId });
      setIsQueueConfirmOpen(true);
      return;
    }

    // Save payload so fallback (server-side active detection) can open queue modal
    setPendingStartPayload({ fileId: uploadedFile.fileId, promptsConfig: payloadPrompts, options: { skipIfExistingValue } });
    createJobMutation.mutate({ fileId: uploadedFile.fileId, promptsConfig: payloadPrompts, options: { skipIfExistingValue } });
  };

  const handleProceedFromPreview = () => {
    setIsPreviewModalOpen(false);
    handleStartProcessing();
  };

  // Determine whether any API key is configured for this user
  const savedKeys = (user?.llmApiKeys as Record<string, string>) || {};
  const hasAnyKeyConfigured = Object.values(savedKeys).some((v) => !!v);
  console.log("[Dashboard] API key configured status:", hasAnyKeyConfigured);

  // Realtime connection status for status indicator
  const { isConnected: rtConnected } = useRealtimeJob(currentJobId);

  // Status indicator helper functions (extracted from ProcessMonitor)
  const currentJob = displayJobData?.job || null;
  const getStatusColor = () => {
    if (!currentJob) return "bg-gray-500";
    switch (currentJob.status) {
      case "processing":
        return "bg-green-500";
      case "paused":
        return "bg-yellow-500";
      case "completed":
        return "bg-blue-500";
      case "failed":
        return "bg-red-500";
      case "stopped":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    if (!currentJob) return "No active job";
    switch (currentJob.status) {
      case "processing":
        return "Processing";
      case "paused":
        return "Paused";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      case "stopped":
        return "Stopped - Download Available";
      default:
        return "Queued";
    }
  };

  const isActive = currentJob?.status === "processing" || currentJob?.status === "queued";

  return (
    <MainLayout>
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl lg:text-4xl font-bold oracle-heading mb-3 lg:mb-4">Enrich Your Data With AI</h1>
        <p className="text-sm lg:text-base oracle-muted">
          Upload spreadsheets and enhance them using any LLM provider by sending custom prompts for all rows of your table, one row at a time.
          Upload your CSV, set up your prompts, and start processing to get enriched data.
        </p>
      </div>

      <div className="space-y-9 lg:space-y-12">
        {/* Settings CTA – shown only if no API keys are configured */}
        {!hasAnyKeyConfigured && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4" data-testid="cta-setup-keys">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium oracle-heading">Set up your API keys</div>
                <div className="text-sm oracle-muted">
                  To use OpenAI, Perplexity, Gemini, or DeepSeek, configure your keys in Settings.
                </div>
              </div>
              <Link href="/settings">
                <Button stackOnNarrow size="compact"
                  className="bg-oracle-accent hover:bg-oracle-accent/90 text-white"
                  data-testid="button-go-settings"
                >
                  Manage API Keys
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="space-y-9 lg:space-y-12">
        {/* CSV Upload and Preview */}
        <section aria-labelledby="upload-preview">
          <SectionHeader
            id="upload-preview"
            title="1. Upload & Preview"
            level={2}
            icon={<FolderOpen className="h-5 w-5 text-oracle-accent" />}
            tooltip={<HelpTip ariaLabel="Upload CSV info" content={MC.dashboard.sections.upload.tooltip} buttonClassName="mt-0.5 h-6 w-6" iconClassName="h-4 w-4" />}
            variant="plain"
            className="mb-0"
          />
          <CsvUploader
            onFileUploaded={handleFileUploaded}
            uploadedFile={uploadedFile}
            onRemoveFile={handleRemoveFile}
          />
        </section>

          {/* Prompt Manager - Full Width */}
          <section aria-labelledby="configure-prompts">
            <SectionHeader
              id="configure-prompts"
              title="2. Create Your Expert AI"
              level={2}
              icon={<Workflow className="h-5 w-5 text-oracle-accent" />}
              tooltip={<HelpTip ariaLabel="Prompt Manager info" content={MC.dashboard.sections.prompts.tooltip} buttonClassName="mt-0.5 h-6 w-6" iconClassName="h-4 w-4" />}
              subheader={MC.dashboard.sections.prompts.subheader}
              guide={MC.dashboard.sections.prompts.guide}
              variant="plain"
              className="mb-0"
            />
            <PromptManager
              prompts={prompts}
              setPrompts={setPrompts}
              onPreview={handlePreview}
              onStartProcessing={handleStartProcessing}
              uploadedFile={uploadedFile}
              isPreviewLoading={previewMutation.isPending}
              isProcessing={createJobMutation.isPending}
              hasActiveJob={!!currentJobId}
              skipIfExistingValue={skipIfExistingValue}
              onToggleSkipIfExisting={setSkipIfExistingValue}
            />
          </section>

          {/* Process Monitor - Page Header + Content Card */}
          <SectionHeader
            id="view-progress"
            title="3. View Progress"
            level={2}
            icon={<Gauge className="h-5 w-5 text-oracle-accent" />}
            tooltip={<HelpTip ariaLabel="Process Monitor info" content={MC.dashboard.sections.processMonitor.tooltip} buttonClassName="mt-0.5 h-6 w-6" iconClassName="h-4 w-4" />}
            subheader={MC.dashboard.sections.processMonitor.subheader}
            guide={MC.dashboard.sections.processMonitor.guide}
            variant="plain"
            className="mb-0"
          />
          <section aria-labelledby="view-progress" className="bg-white rounded-lg shadow-sm">
            <div className="px-4 lg:px-6 pb-2 lg:pb-4 space-y-4">
              {/* Sync/Queue actions row with captions and status indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-4">
                  {/* Sync Jobs (equal width + caption) */}
                  <div className="flex flex-col items-start">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          stackOnNarrow
                          size="compact"
                          variant="outline"
                          onClick={() => {
                            console.debug("[Dashboard] Sync Jobs clicked");
                            debugSyncMutation.mutate();
                          }}
                          disabled={debugSyncMutation.isPending}
                          data-testid="button-sync-jobs"
                          className="min-w-[160px] text-oracle-accent border-oracle-accent hover:bg-oracle-accent hover:text-white"
                        >
                          {debugSyncMutation.isPending ? "Syncing..." : "🔄 Sync Jobs"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm text-sm">{MC.dashboard.sections.syncJobs.tooltip}</TooltipContent>
                    </Tooltip>
                    <div className="text-xs oracle-muted oracle-mt-subheader">Refresh job status</div>
                  </div>

                  {/* View Queued (equal width + caption) */}
                  <div className="flex flex-col items-start">
                    <a href="/history?status=queued" target="_blank" rel="noopener noreferrer">
                      <Button
                        stackOnNarrow
                        size="compact"
                        variant="outline"
                        data-testid="button-view-queued"
                        className="min-w-[160px] text-gray-700 border-gray-400 hover:bg-gray-700 hover:text-white inline-flex items-center gap-2"
                        onClick={() => {
                          console.debug("[Dashboard] View Queued Jobs clicked (new tab)");
                          track("view_queued_clicked", { from: "dashboard", target: "new_tab" });
                        }}
                      >
                        <ListChecks size={16} />
                        View Queued Jobs
                      </Button>
                    </a>
                    <div className="text-xs oracle-muted oracle-mt-subheader">Queued: {Math.min(queuedCount, 2)}/2</div>
                  </div>
                </div>
                {/* Status indicator - always visible, right-aligned */}
                <div className="flex items-center gap-3 ml-auto">
                  <div
                    className={`w-3 h-3 rounded-full ${getStatusColor()} ${isActive ? "animate-pulse" : ""}`}
                    data-testid="status-indicator"
                  ></div>
                  <Badge variant="outline" className="capitalize" data-testid="text-status">{getStatusText()}</Badge>
                  <span className={`text-xs ${rtConnected ? "text-green-600" : "text-muted-foreground"}`} data-testid="text-connection">
                    {rtConnected ? "realtime" : "offline"}
                  </span>
                </div>
              </div>

              <ProcessMonitor
                jobData={displayJobData}
                isLoading={isJobLoading}
                jobId={currentJobId}
              />
            </div>
          </section>
        </div>
      </div>

      <PreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        previewData={previewData}
        onProceedWithJob={handleProceedFromPreview}
        isLoading={createJobMutation.isPending}
        promptsConfig={prompts as any}
        inputHeaders={uploadedFile?.columnHeaders || []}
      />

      {/* Validation issues modal */}
      <AlertDialog open={isValidationOpen} onOpenChange={setIsValidationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Prompt Validation Errors</AlertDialogTitle>
            <AlertDialogDescription>
              Please fix the issues below before proceeding. Variables are case-sensitive and must reference CSV headers or prior prompt outputs.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-80 overflow-auto space-y-3">
            {(() => {
              // Group by promptIndex for display
              const groups = new Map<number, PromptValidationIssue[]>();
              for (const issue of validationIssues) {
                const arr = groups.get(issue.promptIndex) || [];
                arr.push(issue);
                groups.set(issue.promptIndex, arr);
              }
              const ordered = Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
              return ordered.length === 0 ? (
                <div className="text-sm oracle-muted">No issues to display.</div>
              ) : (
                ordered.map(([idx, issues]) => (
                  <div key={idx} className="border border-oracle-border rounded p-3">
                    <div className="font-medium mb-2">Prompt {idx + 1}</div>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {issues.map((iss, i) => (
                        <li key={i}>
                          {iss.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              );
            })()}
          </div>

          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsValidationOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Collision confirmation modal */}
      <AlertDialog open={isCollisionConfirmOpen} onOpenChange={setIsCollisionConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proceed with overwriting existing columns?</AlertDialogTitle>
            <AlertDialogDescription>
              We detected that one or more prompt output column names match existing CSV headers. If you continue, the job will overwrite those input columns in the enriched output. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-80 overflow-auto space-y-3">
            {collisionIssues.length === 0 ? (
              <div className="text-sm oracle-muted">No collisions listed.</div>
            ) : (
              <ul className="list-disc list-inside space-y-1 text-sm">
                {collisionIssues.map((iss, i) => (
                  <li key={i}>{iss.message}</li>
                ))}
              </ul>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsCollisionConfirmOpen(false);
              setCollisionIssues([]);
              setPendingStartPayload(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const payload = pendingStartPayload;
              setIsCollisionConfirmOpen(false);
              setCollisionIssues([]);
              // If an active job exists, open queue confirm instead of immediate start
              if (currentJobId) {
                console.log("[Dashboard] Active job present after collision confirm; opening queue confirmation modal");
                track("queue_modal_open", { activeJobId: currentJobId });
                setIsQueueConfirmOpen(true);
                return;
              }
              setPendingStartPayload(null);
              if (payload) {
                console.log("[Dashboard] User confirmed proceeding with collisions. Starting job.");
                // Ensure options are included (skip toggle)
                createJobMutation.mutate({ ...payload, options: payload.options ?? { skipIfExistingValue } });
              }
            }}>Proceed and Overwrite</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Queue confirmation modal */}
      <AlertDialog open={isQueueConfirmOpen} onOpenChange={(v) => {
        setIsQueueConfirmOpen(v);
        if (!v) {
          track("queue_modal_dismiss", { activeJobId: currentJobId });
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>A job is running</AlertDialogTitle>
            <AlertDialogDescription>
              You already have an active job. You can queue this job to run after the current job finishes, or dismiss to keep editing.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsQueueConfirmOpen(false);
              // Do not clear pending payload; user may reopen quickly
            }}>Dismiss</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const payload = pendingStartPayload;
              if (!payload) {
                setIsQueueConfirmOpen(false);
                return;
              }
              console.log("[Dashboard] Queue confirm: queuing job with forceQueue");
              track("queue_modal_confirm", { activeJobId: currentJobId });
              setIsQueueConfirmOpen(false);
              setPendingStartPayload(null);
              // Force queue on server
              createJobMutation.mutate({ ...payload, forceQueue: true });
            }}>Queue Job</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
