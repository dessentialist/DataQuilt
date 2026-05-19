import { useCallback, useState } from "react";
import { CloudUpload, FileText, X, FolderOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/telemetry";
import { api } from "@/lib/api";
import type { FileUploadResponse, FilePreviewResponse } from "@/lib/api";
import { useAuthContext } from "@/context/AuthProvider";
import { MC } from "@/lib/microcopy";
import { HelpTip } from "@/components/ui/help-tip";

interface CsvUploaderProps {
  onFileUploaded: (fileData: FileUploadResponse) => void;
  uploadedFile: FileUploadResponse | null;
  onRemoveFile: () => void;
}

export function CsvUploader({ onFileUploaded, uploadedFile, onRemoveFile }: CsvUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuthContext();

  // Fetch CSV preview data when file is uploaded
  const { data: previewData, isLoading: isPreviewLoading } = useQuery({
    queryKey: [`/api/files/${uploadedFile?.fileId}/preview`],
    queryFn: async () => {
      if (!uploadedFile?.fileId) return null;
      const response = await api.files.preview(uploadedFile.fileId);
      return await response.json() as FilePreviewResponse;
    },
    enabled: !!uploadedFile?.fileId && isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes - preview data doesn't change
  });

  const handleFileSelect = useCallback(
    async (file: File) => {
      console.log("CSV UPLOADER: handleFileSelect triggered", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isAuthenticated,
        timestamp: new Date().toISOString(),
      });

      // Guard against unauthenticated uploads for better UX
      if (!isAuthenticated) {
        console.log("CSV UPLOADER: Upload blocked - user not authenticated");
        toast({
          title: "Sign in required",
          description: "Please sign in to upload files.",
          variant: "destructive",
        });
        return;
      }

      if (!file.name.toLowerCase().endsWith(".csv")) {
        console.log("CSV UPLOADER: Upload blocked - invalid file type", { fileName: file.name });
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file.",
          variant: "destructive",
        });
        return;
      }

      // Surface file size limit to user early (10MB server-side)
      const maxBytes = 10 * 1024 * 1024;
      if (file.size > maxBytes) {
        console.log("CSV UPLOADER: Upload blocked - file too large", {
          fileSize: file.size,
          maxBytes,
          fileName: file.name,
        });
        toast({
          title: "File too large",
          description: "Maximum upload size is 10MB.",
          variant: "destructive",
        });
        return;
      }

      console.log("CSV UPLOADER: Starting upload process", {
        fileName: file.name,
        fileSize: file.size,
        isAuthenticated,
      });

      setIsUploading(true);
      try {
        console.log("CSV UPLOADER: Tracking upload start event");
        track("upload_start", { name: file.name, size: file.size });

        console.log("CSV UPLOADER: Creating FormData");
        const formData = new FormData();
        formData.append("file", file);

        console.log("CSV UPLOADER: Calling api.files.upload");

        console.log("CSV UPLOADER: Issuing upload via API helper (timeout and parsing centralized)");
        const fileData: FileUploadResponse = await api.files.upload(formData);
        console.log("CSV UPLOADER: Response parsed successfully", {
          fileId: fileData.fileId,
          originalName: fileData.originalName,
          rowCount: fileData.rowCount,
          columnHeaders: fileData.columnHeaders?.length,
        });
        onFileUploaded(fileData);

        toast({
          title: "File uploaded successfully",
          description: `${fileData.originalName} (${fileData.rowCount} rows, ${fileData.columnHeaders.length} columns)`,
        });
        console.log("CSV UPLOADER: Tracking upload success");
        track("upload_success", { fileId: fileData.fileId });
      } catch (error: any) {
        console.error("CSV UPLOADER: Upload error caught", {
          errorType: error?.constructor?.name,
          errorMessage: error?.message,
          errorStack: error?.stack,
          timestamp: new Date().toISOString(),
        });

        let errorMessage =
          "Failed to upload file. Please ensure it is a valid CSV and within size limits.";

        if (error?.message?.includes("timeout")) {
          errorMessage = "Upload timed out. Please check your connection and try again.";
        } else if (error?.message?.includes("network")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error?.message) {
          errorMessage = error.message;
        }

        toast({
          title: "Upload failed",
          description: errorMessage,
          variant: "destructive",
        });
        track("upload_error", {
          message: String(error?.message || error),
          errorType: error?.constructor?.name,
        });
      } finally {
        console.log("CSV UPLOADER: Upload process finished, setting isUploading to false");
        setIsUploading(false);
      }
    },
    [onFileUploaded, toast, isAuthenticated],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      console.log("CSV UPLOADER: File drop event", {
        hasFiles: !!e.dataTransfer.files.length,
        isAuthenticated,
      });
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect, isAuthenticated],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log("CSV UPLOADER: File input change event", {
        hasFiles: !!e.target.files?.length,
        fileCount: e.target.files?.length || 0,
        fileName: e.target.files?.[0]?.name,
        isAuthenticated, // Add current auth state to debug log
      });

      const file = e.target.files?.[0];
      if (file) {
        console.log("CSV UPLOADER: File selected, calling handleFileSelect");
        handleFileSelect(file);
      } else {
        console.log("CSV UPLOADER: No file selected in input");
      }

      // Reset input value to allow selecting the same file again
      e.target.value = "";
    },
    [handleFileSelect, isAuthenticated],
  );

  return (
    <div>
      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Upload Section */}
          <div className="bg-white rounded-lg shadow-sm border border-oracle-border">
            <div className="p-4 lg:p-6">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg lg:text-xl font-semibold oracle-heading">UPLOAD CSV FILE</h2>
              </div>
          <p className="text-xs oracle-muted oracle-mt-subheader">{MC.dashboard.sections.upload.subheader}</p>
          <p className="text-sm oracle-muted oracle-mt-guide">{MC.dashboard.sections.upload.guide}</p>
            </div>
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 lg:p-8 text-center hover:border-oracle-accent transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => {
              console.log("CSV UPLOADER: Upload area clicked", { isAuthenticated });
              if (!isAuthenticated) {
                console.log("CSV UPLOADER: Showing sign in required toast");
                toast({
                  title: "Sign in required",
                  description: "Please sign in to upload files.",
                  variant: "destructive",
                });
                return;
              }
              console.log("CSV UPLOADER: Triggering file input click");
              document.getElementById("file-input")?.click();
            }}
            data-testid="file-drop-zone"
          >
            <div className="mb-4">
              <CloudUpload className="mx-auto oracle-muted w-8 h-8 lg:w-12 lg:h-12" />
            </div>
            <p className="text-base lg:text-lg font-medium oracle-primary mb-2">Drop your CSV file here</p>"
            <p className="text-sm oracle-muted mb-4">or click to browse</p>
            {!isAuthenticated && (
              <p className="text-sm text-red-600 mb-4">Please sign in to upload files.</p>
            )}
            <Button
              disabled={isUploading || !isAuthenticated}
              data-testid="button-browse-files"
              className="bg-oracle-accent hover:bg-oracle-accent/90 text-white"
            >
              {isUploading ? "Uploading..." : "Browse Files"}
            </Button>
            <input
              id="file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
              disabled={isUploading || !isAuthenticated}
              data-testid="input-file-upload"
            />
          </div>
          
          {/* Detected Columns - moved here */}
          {uploadedFile && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="text-oracle-accent w-5 h-5 lg:w-6 lg:h-6" />
                  <div>
                    <div className="font-medium" data-testid="text-filename">{uploadedFile.originalName}</div>
                    <div className="text-sm oracle-muted" data-testid="text-file-stats">
                      {uploadedFile.rowCount.toLocaleString()} rows •{" "}
                      {uploadedFile.columnHeaders.length} columns
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemoveFile}
                  data-testid="button-remove-file"
                  className="text-gray-500 hover:text-red-500"
                >
                  <X size={16} />
                </Button>
              </div>
              <div>
                <div className="text-sm font-medium oracle-primary mb-3">Detected Columns:</div>
                <div className="flex flex-wrap gap-2">
                  {uploadedFile.columnHeaders.map((header) => (
                    <span
                      key={header}
                      className="bg-white border border-gray-200 px-3 py-1 rounded-full text-sm"
                      data-testid={`column-header-${header}`}
                    >
                      {header}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Section - CSV Content */}
      <div className="bg-white rounded-lg shadow-sm border border-oracle-accent-soft">
        <div className="p-4 lg:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg lg:text-xl font-semibold oracle-heading">CSV PREVIEW</h2>
          </div>
          <p className="text-xs oracle-muted oracle-mt-subheader">{MC.dashboard.sections.preview.subheader}</p>
          <p className="text-sm oracle-muted oracle-mt-guide">{MC.dashboard.sections.preview.guide}</p>
        </div>
        <div className="p-4 lg:p-6">
          {uploadedFile ? (
            <div className="space-y-4">
              <div className="text-sm oracle-muted mb-3">
                Preview of first few rows:
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {uploadedFile.columnHeaders.map((header, index) => (
                          <th key={index} className="px-3 py-2 text-left font-medium text-gray-900 border-r border-gray-200 last:border-r-0">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(previewData?.previewData) && previewData.previewData.length > 0 ? (
                        previewData.previewData.map((row, rowIndex) => (
                          <tr className="border-t" key={rowIndex}>
                            {uploadedFile.columnHeaders.map((header, colIndex) => (
                              <td key={colIndex} className="px-3 py-2 text-gray-600 border-r border-gray-200 last:border-r-0">
                                <div
                                  className="max-w-xs truncate"
                                  title={String(row?.[header] ?? "")}
                                >
                                  {String(row?.[header] ?? "")}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <>
                          <tr className="border-t">
                            {uploadedFile.columnHeaders.map((header, index) => (
                              <td key={index} className="px-3 py-2 text-gray-600 border-r border-gray-200 last:border-r-0">
                                <span className="text-gray-400 italic">{isPreviewLoading ? "Loading..." : "Sample data..."}</span>
                              </td>
                            ))}
                          </tr>
                          <tr className="border-t">
                            {uploadedFile.columnHeaders.map((header, index) => (
                              <td key={index} className="px-3 py-2 text-gray-600 border-r border-gray-200 last:border-r-0">
                                <span className="text-gray-400 italic">{isPreviewLoading ? "Loading..." : "Sample data..."}</span>
                              </td>
                            ))}
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Note: This shows the first few rows from your CSV. Actual data will be processed during enrichment.
              </div>
            </div>
          ) : (
            <div className="text-center py-8 lg:py-12 text-gray-400">
              <FileText className="mx-auto mb-4 opacity-50 w-10 h-10 lg:w-12 lg:h-12" />
              <p className="text-base lg:text-lg font-medium mb-2">No file uploaded yet</p>
              <p className="text-sm">Upload a CSV file to see the preview here</p>
            </div>
          )}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
