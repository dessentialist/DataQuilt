import { v4 as uuidv4 } from "uuid";
import { FilesRepository } from "../repositories/files.repository";
import { supabaseService } from "./supabase.service";
import { createNormalizedCsvParser, serializeRowsToCsv } from "@shared/csv";
import { Readable } from "stream";
import { isProbablyCsv } from "./csv.service";
import { logInfo, logError } from "@shared/logger";

export const FilesService = {
  /**
   * Handles CSV upload with validation, storage write, DB write, and compensation on failure.
   */
  async upload(params: {
    userId: string;
    file: { buffer: Buffer; originalname: string };
    requestId?: string;
  }) {
    const { userId, file, requestId } = params;
    logInfo("FilesService.upload:start", {
      userId,
      requestId,
      fileName: file?.originalname,
      fileSize: file?.buffer?.length,
    });

    if (!file?.buffer) {
      const err: any = new Error("No file uploaded");
      err.code = "FILES_NO_FILE";
      throw err;
    }

    if (!isProbablyCsv(file.buffer)) {
      const err: any = new Error("Invalid CSV content");
      err.code = "FILES_INVALID_CONTENT";
      throw err;
    }

    await supabaseService.ensureBucketExists("oracle-files");

    const fileId = uuidv4();
    const storagePath = `uploads/${userId}/${fileId}.csv`;

    // Stream-parse and clean: drop rows where all cells are empty/whitespace
    const cleanedRows: any[] = [];
    let columnHeaders: string[] = [];
    let originalRowCount = 0;
    const stream = Readable.from(file.buffer);
    const parser = createNormalizedCsvParser();

    await new Promise<void>((resolve, reject) => {
      parser
        .on("headers", (h: string[]) => {
          // Normalize header names by trimming; BOM already stripped by parser mapHeaders
          columnHeaders = (h || []).filter((s) => typeof s === "string" && s.length > 0) as string[];
        })
        .on("data", (row: any) => {
          originalRowCount += 1;
          const keys = columnHeaders.length ? columnHeaders : Object.keys(row);
          const isEmpty = keys.every((k) => {
            const v = row[k];
            if (v === null || v === undefined) return true;
            const s = typeof v === "string" ? v : String(v);
            return s.trim().length === 0;
          });
          if (!isEmpty) cleanedRows.push(row);
        })
        .on("end", () => resolve())
        .on("error", (err: any) => reject(err));

      stream.pipe(parser);
    });

    if (!columnHeaders.length) {
      const err: any = new Error("CSV file is empty or invalid");
      err.code = "FILES_EMPTY_OR_INVALID_CSV";
      throw err;
    }

    if (cleanedRows.length === 0) {
      const err: any = new Error("CSV contains no non-empty rows after cleaning");
      err.code = "FILES_EMPTY_AFTER_CLEAN";
      throw err;
    }

    const cleanedBuffer = serializeRowsToCsv(cleanedRows, columnHeaders, true);

    // Upload cleaned CSV to storage
    const uploadResult = await supabaseService.uploadFile(storagePath, cleanedBuffer);
    if (!uploadResult.data) {
      const err: any = new Error("Failed to upload file to storage");
      err.code = "FILES_UPLOAD_FAILED";
      throw err;
    }

    // Write DB row; compensate storage on failure
    try {
      const created = await FilesRepository.create({
        fileId,
        userId,
        storagePath,
        originalName: file.originalname,
        rowCount: cleanedRows.length,
        columnHeaders,
      });

      logInfo("FilesService.upload:success", { userId, fileId, requestId });
      return {
        fileId: created.fileId,
        originalName: created.originalName,
        columnHeaders: created.columnHeaders as unknown as string[],
        rowCount: created.rowCount,
      } as const;
    } catch (dbError) {
      // Compensate: delete uploaded object if DB write fails
      const deleted = await supabaseService.deleteFile(storagePath);
      logError("FilesService.upload:db_error_compensated", {
        userId,
        fileId,
        requestId,
        storagePath,
        dbError: String(dbError),
        storageDeleted: deleted,
      });
      throw dbError;
    }
  },
  
  /**
   * Stream the first N rows of a CSV file owned by the user.
   * - Enforces ownership lookup by `fileId` and `userId`
   * - Uses streaming parser with early termination after `limit` rows
   * - Avoids reading the full file for performance
   */
  async previewFirstRows(params: { userId: string; fileId: string; limit?: number; requestId?: string }) {
    const { userId, fileId, requestId } = params;
    const limit = params.limit && Number.isFinite(params.limit) && (params.limit as number) > 0 ? (params.limit as number) : 5;
    logInfo("FilesService.previewFirstRows:start", { userId, fileId, limit, requestId });

    const fileRow = await FilesRepository.getByIdForUser(fileId, userId);
    if (!fileRow) {
      const err: any = new Error("File not found");
      err.code = "JOBS_FILE_NOT_FOUND";
      throw err;
    }

    const fileData = await supabaseService.downloadFile(fileRow.storagePath);
    if (!fileData) {
      const err: any = new Error("File not found in storage");
      err.code = "JOBS_FILE_NOT_FOUND";
      throw err;
    }

    const previewData: any[] = [];
    const stream = Readable.from(fileData);
    const parser = createNormalizedCsvParser();

    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const complete = () => {
        if (!resolved) {
          resolved = true;
          try {
            stream.removeAllListeners();
            parser.removeAllListeners();
          } catch {}
          resolve();
        }
      };

      parser
        .on("data", (row: any) => {
          if (previewData.length < limit) {
            previewData.push(row);
          }
          if (previewData.length >= limit) {
            // Early terminate stream after collecting desired rows (graceful)
            try {
              stream.unpipe(parser);
            } catch {}
            try {
              parser.destroy();
            } catch {}
            try {
              stream.destroy();
            } catch {}
            complete();
          }
        })
        .on("end", () => complete())
        .on("error", (err: any) => {
          if (!resolved) reject(err);
        });

      stream.pipe(parser);
    });

    logInfo("FilesService.previewFirstRows:success", { userId, fileId, rows: previewData.length, requestId });
    return { previewData } as const;
  },
  
  /**
   * Generate a signed URL for a file owned by the user, looked up by fileId.
   */
  async getDownloadUrlById(params: { userId: string; fileId: string; requestId?: string }) {
    const { userId, fileId, requestId } = params;
    logInfo("FilesService.getDownloadUrlById:start", { userId, fileId, requestId });

    const fileRow = await FilesRepository.getByIdForUser(fileId, userId);
    if (!fileRow) {
      const err: any = new Error("File not found");
      err.code = "JOBS_FILE_NOT_FOUND";
      throw err;
    }

    const url = await supabaseService.getSignedUrl(fileRow.storagePath);
    if (!url) {
      const err: any = new Error("Download not accessible");
      err.code = "JOBS_DOWNLOAD_NOT_ACCESSIBLE";
      throw err;
    }

    logInfo("FilesService.getDownloadUrlById:success", { userId, fileId, requestId });
    return { url } as const;
  },

  /**
   * Legacy support: generate a signed URL from a storage path param, enforcing ownership.
   * Expects filePath like `uploads/<userId>/<fileId>.csv`.
   */
  async getDownloadUrlForPath(params: { userId: string; filePath: string; requestId?: string }) {
    const { userId, filePath, requestId } = params;
    logInfo("FilesService.getDownloadUrlForPath:start", { userId, requestId });

    // Basic format validation and extraction
    const parts = filePath.split("/");
    if (parts.length !== 3 || parts[0] !== "uploads") {
      const err: any = new Error("Invalid file path");
      err.code = "FILES_INVALID_INPUT";
      throw err;
    }
    const pathUserId = parts[1];
    const fileName = parts[2];
    const fileId = fileName.replace(/\.csv$/i, "");

    if (!fileId || pathUserId !== userId) {
      const err: any = new Error("Invalid or unauthorized path");
      err.code = "FILES_INVALID_INPUT";
      throw err;
    }

    // Check the file exists and belongs to user; also verify storagePath matches
    const fileRow = await FilesRepository.getByIdForUser(fileId, userId);
    if (!fileRow || fileRow.storagePath !== filePath) {
      const err: any = new Error("File not found");
      err.code = "JOBS_FILE_NOT_FOUND";
      throw err;
    }

    const url = await supabaseService.getSignedUrl(fileRow.storagePath);
    if (!url) {
      const err: any = new Error("Download not accessible");
      err.code = "JOBS_DOWNLOAD_NOT_ACCESSIBLE";
      throw err;
    }
    logInfo("FilesService.getDownloadUrlForPath:success", { userId, fileId, requestId });
    return { url } as const;
  },
};


