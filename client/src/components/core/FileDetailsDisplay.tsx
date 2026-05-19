import { FileText } from "lucide-react";
import type { FileUploadResponse } from "@/lib/api";

interface FileDetailsDisplayProps {
  file: FileUploadResponse;
}

export function FileDetailsDisplay({ file }: FileDetailsDisplayProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-3 mb-3">
        <FileText className="text-oracle-accent" size={24} />
        <div>
          <div className="font-medium">{file.originalName}</div>
          <div className="text-sm oracle-muted">
            {file.rowCount.toLocaleString()} rows • {file.columnHeaders.length} columns
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium oracle-primary mb-2">Detected Columns:</div>
        <div className="flex flex-wrap gap-2">
          {file.columnHeaders.map((header) => (
            <span
              key={header}
              className="bg-white border border-gray-200 px-3 py-1 rounded-full text-sm"
            >
              {header}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
