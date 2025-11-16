import { createClient } from "@supabase/supabase-js";

/**
 * Shared Supabase Storage service used by both server and worker to avoid drift.
 * - Uses Service Role Key for privileged storage operations
 * - Bucket name defaults to "oracle-files"
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
  },
});

export const supabaseService = {
  async createStoragePolicies(bucket: string): Promise<void> {
    try {
      // Create policies to allow service role access to the bucket
      const policies = [
        {
          name: `${bucket}_select_policy`,
          sql: `CREATE POLICY "${bucket}_select_policy" ON storage.objects FOR SELECT USING (bucket_id = '${bucket}');`,
        },
        {
          name: `${bucket}_insert_policy`,
          sql: `CREATE POLICY "${bucket}_insert_policy" ON storage.objects FOR INSERT WITH CHECK (bucket_id = '${bucket}');`,
        },
        {
          name: `${bucket}_update_policy`,
          sql: `CREATE POLICY "${bucket}_update_policy" ON storage.objects FOR UPDATE USING (bucket_id = '${bucket}');`,
        },
        {
          name: `${bucket}_delete_policy`,
          sql: `CREATE POLICY "${bucket}_delete_policy" ON storage.objects FOR DELETE USING (bucket_id = '${bucket}');`,
        },
      ];

      for (const policy of policies) {
        try {
          console.log(`[supabaseStorage] Creating policy: ${policy.name}`);
          await supabase.rpc("exec_sql", { sql: policy.sql });
        } catch (error) {
          console.warn(`[supabaseStorage] Policy creation warning for ${policy.name}:`, error);
        }
      }
    } catch (error) {
      console.warn("[supabaseStorage] Could not create storage policies:", error);
    }
  },
  async ensureBucketExists(bucket = "oracle-files"): Promise<void> {
    console.log(
      `[supabaseStorage] Assuming bucket '${bucket}' exists (managed via Supabase dashboard)`,
    );
    // Note: Bucket should be created via Supabase dashboard with proper RLS policies
    // Service role key will handle all file operations once bucket exists
  },

  async uploadFile(
    path: string,
    fileBuffer: Buffer,
    opts?: { contentType?: string },
  ): Promise<{ data: any; error: any }> {
    try {
      console.log("[supabaseStorage] Starting upload with service role key", {
        path,
        bufferSize: fileBuffer.length,
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        serviceKeyPreview: supabaseServiceKey?.substring(0, 20) + "...",
      });

      // Service role key should bypass ALL RLS policies
      let contentType = opts?.contentType || "text/csv";
      const attempt = async (ct: string) =>
        supabase.storage.from("oracle-files").upload(path, fileBuffer, { contentType: ct, upsert: true });

      let { data, error } = await attempt(contentType);

      // Supabase rejects certain charset parameters; retry without charset on 415
      if (error && (error as any)?.statusCode === "415" && typeof contentType === "string") {
        const sanitized = contentType.split(";")[0].trim();
        if (sanitized !== contentType) {
          console.warn(`[supabaseStorage] Retrying upload without charset`, { original: contentType, sanitized });
          ({ data, error } = await attempt(sanitized));
        }
        // If still 415 after sanitizing, fall back to text/plain to bypass MIME restrictions
        if (error && (error as any)?.statusCode === "415") {
          console.warn(`[supabaseStorage] Retrying upload with text/plain due to 415`, { original: contentType });
          ({ data, error } = await attempt("text/plain"));
        }
      }

      console.log("[supabaseStorage] Upload result", {
        hasData: !!data,
        hasError: !!error,
        error: error,
        path,
      });

      if (error) {
        console.error("[supabaseStorage] Upload failed with service role key:", {
          error,
          errorMessage: error?.message,
          statusCode: (error as any)?.statusCode,
        });
      }

      return { data, error };
    } catch (error) {
      console.error("[supabaseStorage] upload error:", error);
      return { data: null, error };
    }
  },

  async createPublicBucket(): Promise<void> {
    try {
      console.log("[supabaseStorage] Attempting to create public bucket with policies");

      // Delete existing bucket if it has no policies
      try {
        await supabase.storage.deleteBucket("oracle-files");
        console.log("[supabaseStorage] Deleted existing bucket");
      } catch (e) {
        console.log("[supabaseStorage] Could not delete existing bucket (may not exist)");
      }

      // Create new bucket with public access
      const { error } = await supabase.storage.createBucket("oracle-files", {
        public: true, // Make it public to bypass RLS policies
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ["text/csv", "application/vnd.ms-excel"],
      });

      if (error) {
        console.error("[supabaseStorage] Could not create public bucket:", error);
      } else {
        console.log("[supabaseStorage] Created public bucket successfully");
      }
    } catch (error) {
      console.warn("[supabaseStorage] createPublicBucket failed:", error);
    }
  },

  async downloadFile(path: string): Promise<Buffer | null> {
    try {
      const { data, error } = await supabase.storage.from("oracle-files").download(path);
      if (error || !data) {
        // eslint-disable-next-line no-console
        console.error("[supabaseStorage] download error:", error);
        return null;
      }
      return Buffer.from(await data.arrayBuffer());
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[supabaseStorage] download error:", error);
      return null;
    }
  },

  async getSignedUrl(
    path: string,
    expiresInSeconds = 3600,
    downloadFileName?: string,
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from("oracle-files")
        .createSignedUrl(path, expiresInSeconds, downloadFileName ? { download: downloadFileName } : undefined as any);
      if (error || !data?.signedUrl) {
        return null;
      }
      return data.signedUrl;
    } catch (error) {
      return null;
    }
  },

  async deleteFile(path: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage.from("oracle-files").remove([path]);
      return !error;
    } catch (error) {
      return false;
    }
  },

  /**
   * List all file paths directly under a given prefix (folder path) within the bucket.
   * - Not recursive across nested folders; our app stores files flatly under user-specific prefixes
   */
  async list(prefix: string): Promise<string[]> {
    const collected: string[] = [];
    try {
      const pageSize = 100;
      let offset = 0;
      // Normalize prefix: no leading slash; no duplicate trailing slash handling in join below
      const base = prefix.startsWith("/") ? prefix.slice(1) : prefix;
      while (true) {
        const { data, error } = await supabase.storage
          .from("oracle-files")
          // cast sortBy to any to avoid strict type coupling
          .list(base, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } as any });
        if (error) break;
        const items = Array.isArray(data) ? data : [];
        for (const item of items) {
          // Heuristic: file objects have metadata or id; folders often have null metadata
          const isFile = (item as any)?.id || (item as any)?.metadata;
          if (isFile) {
            const sep = base.endsWith("/") ? "" : "/";
            collected.push(`${base}${sep}${(item as any).name}`);
          }
        }
        if (items.length < pageSize) break;
        offset += items.length;
      }
    } catch {
      // best-effort; return what we have
    }
    return collected;
  },

  /**
   * Delete all objects under the provided prefix. Returns how many paths were attempted for deletion.
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    try {
      const paths = await this.list(prefix);
      if (!paths.length) return 0;
      const chunkSize = 100;
      for (let i = 0; i < paths.length; i += chunkSize) {
        const chunk = paths.slice(i, i + chunkSize);
        try {
          await supabase.storage.from("oracle-files").remove(chunk);
        } catch {
          // continue best-effort
        }
      }
      return paths.length;
    } catch {
      return 0;
    }
  },

  /**
   * Delete a Supabase auth user (requires service role key).
   */
  async deleteAuthUser(userId: string): Promise<boolean> {
    try {
      // eslint-disable-next-line no-console
      console.log("[supabaseAuthAdmin] deleteUser:start", {
        userId,
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        urlPrefix: supabaseUrl?.slice(0, 30),
        keyPreview: supabaseServiceKey?.slice(0, 8) + "...",
      });
      // Some supabase-js versions expect a boolean param for shouldSoftDelete
      const { error } = await (supabase as any).auth.admin.deleteUser(userId, false);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[supabaseAuthAdmin] deleteUser:error", { userId, error: String(error) });
      } else {
        // eslint-disable-next-line no-console
        console.log("[supabaseAuthAdmin] deleteUser:success", { userId });
      }
      return !error;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[supabaseAuthAdmin] deleteUser:exception", { userId, error: String(e) });
      return false;
    }
  },
  
  /**
   * Check if an auth user still exists (requires service role key).
   */
  async authUserExists(userId: string): Promise<boolean> {
    try {
      // eslint-disable-next-line no-console
      console.log("[supabaseAuthAdmin] getUserById:start", { userId });
      const { data, error } = await (supabase as any).auth.admin.getUserById(userId);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[supabaseAuthAdmin] getUserById:error", { userId, error: String(error) });
        return false;
      }
      const exists = !!data?.user;
      // eslint-disable-next-line no-console
      console.log("[supabaseAuthAdmin] getUserById:success", { userId, exists });
      return exists;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[supabaseAuthAdmin] getUserById:exception", { userId, error: String(e) });
      return false;
    }
  },
};
