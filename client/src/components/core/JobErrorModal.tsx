/**
 * JobErrorModal Component
 *
 * Displays error details when a job is auto-paused due to a critical LLM error.
 * Shows error category, user-friendly message, context (row, prompt, etc.), and actions.
 *
 * Usage:
 *   <JobErrorModal
 *     isOpen={isOpen}
 *     onClose={onClose}
 *     errorDetails={job.errorDetails}
 *     onResume={handleResume}
 *     onStop={handleStop}
 *   />
 */

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Play, Square, X } from "lucide-react";
import { validateJobErrorDetails, type JobErrorDetails } from "@shared/llm.errors";
import { MC } from "@/lib/microcopy";
import { MessageWithLinks } from "@/components/ui/MessageWithLinks";

interface JobErrorModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;

  /**
   * Callback when modal should close (dismiss action)
   */
  onClose: () => void;

  /**
   * Error details from job.errorDetails (may be null or invalid)
   */
  errorDetails: unknown;

  /**
   * Callback when user clicks Resume
   */
  onResume: () => void;

  /**
   * Callback when user clicks Stop
   */
  onStop: () => void;

  /**
   * Whether resume/stop actions are loading
   */
  isLoading?: boolean;
}

/**
 * Get badge variant and label for error category
 */
function getCategoryBadge(category: string) {
  switch (category) {
    case "AUTH_ERROR":
      return { variant: "destructive" as const, label: MC.dashboard.errorModal.category.AUTH_ERROR };
    case "QUOTA_EXCEEDED":
      return { variant: "destructive" as const, label: MC.dashboard.errorModal.category.QUOTA_EXCEEDED };
    case "CONTENT_FILTERED":
      return { variant: "default" as const, label: MC.dashboard.errorModal.category.CONTENT_FILTERED };
    default:
      return { variant: "default" as const, label: category };
  }
}

/**
 * Get help text for error category
 */
function getCategoryHelp(category: string): string {
  switch (category) {
    case "AUTH_ERROR":
      return MC.dashboard.errorModal.help.authError;
    case "QUOTA_EXCEEDED":
      return MC.dashboard.errorModal.help.quotaExceeded;
    case "CONTENT_FILTERED":
      return MC.dashboard.errorModal.help.contentFiltered;
    default:
      return "Review the error details and take appropriate action.";
  }
}

export function JobErrorModal({
  isOpen,
  onClose,
  errorDetails,
  onResume,
  onStop,
  isLoading = false,
}: JobErrorModalProps) {
  // Validate error details structure
  const validated = validateJobErrorDetails(errorDetails);
  if (!validated) {
    // Invalid error details - show fallback message
    return (
      <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent
          onInteractOutside={(e) => {
            e.preventDefault();
            onClose();
          }}
          onEscapeKeyDown={onClose}
        >
          <AlertDialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Job Paused Due to Error
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-2">
                  The job was paused due to an error, but error details could not be loaded. Please check the job logs for more information.
                </AlertDialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-sm opacity-70 hover:opacity-100 -mt-1 -mr-1"
                onClick={onClose}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>
            <AlertDialogAction onClick={onResume} disabled={isLoading}>
              Resume Job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const categoryBadge = getCategoryBadge(validated.category);
  const helpText = getCategoryHelp(validated.category);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent 
        className="max-w-2xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => {
          e.preventDefault();
          onClose();
        }}
        onEscapeKeyDown={onClose}
      >
        <AlertDialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                {MC.dashboard.errorModal.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                {MC.dashboard.errorModal.description}
              </AlertDialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-sm opacity-70 hover:opacity-100 -mt-1 -mr-1"
              onClick={onClose}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </AlertDialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Error Category Badge */}
          <div className="flex items-center gap-2">
            <Badge variant={categoryBadge.variant}>{categoryBadge.label}</Badge>
            <span className="text-xs oracle-muted">
              {new Date(validated.timestamp).toLocaleString()}
            </span>
          </div>

          {/* User-Friendly Error Message */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive mb-2">Error Message</p>
            <p className="text-sm leading-relaxed">
              <MessageWithLinks message={validated.userMessage} />
            </p>
          </div>

          {/* Help Text */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900 mb-1">What to do:</p>
            <p className="text-sm text-blue-800 leading-relaxed">{helpText}</p>
          </div>

          {/* Error Context */}
          <div className="rounded-lg border border-oracle-border bg-muted/50 p-4">
            <p className="text-sm font-medium mb-3">Error Context</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="oracle-muted">{MC.dashboard.errorModal.context.row}:</span>{" "}
                <span className="font-medium">{validated.rowNumber}</span>
              </div>
              <div>
                <span className="oracle-muted">{MC.dashboard.errorModal.context.prompt}:</span>{" "}
                <span className="font-medium">{validated.promptIndex + 1}</span>
              </div>
              <div>
                <span className="oracle-muted">{MC.dashboard.errorModal.context.outputColumn}:</span>{" "}
                <span className="font-medium">{validated.promptOutputColumn}</span>
              </div>
              <div>
                <span className="oracle-muted">{MC.dashboard.errorModal.context.provider}:</span>{" "}
                <span className="font-medium capitalize">{validated.provider}</span>
              </div>
              {validated.modelId && (
                <div className="col-span-2">
                  <span className="oracle-muted">{MC.dashboard.errorModal.context.model}:</span>{" "}
                  <span className="font-medium">{validated.modelId}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <AlertDialogFooter className="flex-shrink-0 flex-col sm:flex-row gap-2 mt-4">
          <AlertDialogCancel onClick={onClose} disabled={isLoading}>
            {MC.dashboard.errorModal.actions.dismiss}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={onStop}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <Square className="h-4 w-4 mr-2" />
            {MC.dashboard.errorModal.actions.stop}
          </Button>
          <AlertDialogAction onClick={onResume} disabled={isLoading} className="w-full sm:w-auto">
            <Play className="h-4 w-4 mr-2" />
            {MC.dashboard.errorModal.actions.resume}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

