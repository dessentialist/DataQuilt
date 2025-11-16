import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Try to parse standardized error shape { message, code, requestId }
    let body: any = undefined;
    try {
      body = await res.clone().json();
    } catch {
      // ignore
    }
    const code = body?.code as string | undefined;
    const requestId = body?.requestId as string | undefined;
    const message = body?.message || (await res.text()) || res.statusText;
    const err = new Error(`${res.status}: ${message}`);
    // @ts-expect-error attach metadata to error for toasts/telemetry
    err.code = code;
    // @ts-expect-error attach metadata to error for toasts/telemetry
    err.requestId = requestId;
    // @ts-expect-error attach structured details when present (e.g., validationIssues)
    err.details = body?.details;
    throw err;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Inject Supabase access token into Authorization header for all API calls
  // Server validates this token and never uses cookies.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // DEBUG: Log session details for API requests
  console.log("API REQUEST DEBUG:", {
    method,
    url,
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    tokenPreview: session?.access_token ? `${session.access_token.substring(0, 20)}...` : null,
    userId: session?.user?.id,
  });

  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  // Hint proxies/servers that we expect JSON
  headers["Accept"] = "application/json";
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
    console.log("Authorization header added successfully");
  } else {
    console.warn("No access token available for API request");
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "omit",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Multipart-aware API request helper.
 * - Injects Supabase bearer token
 * - Does NOT set Content-Type when body is FormData (browser sets boundary)
 * - Returns raw Response by default to preserve current upload behavior
 */
export async function apiRequestMultipart(
  method: string,
  url: string,
  formData: FormData,
  options?: { raw?: boolean; timeoutMs?: number },
): Promise<Response | any> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("API REQUEST MULTIPART DEBUG:", {
    method,
    url,
    hasSession: !!session,
    hasAccessToken: !!session?.access_token,
    tokenPreview: session?.access_token ? `${session.access_token.substring(0, 20)}...` : null,
    formDataKeys: Array.from(formData.keys()),
  });

  // Preflight: require authentication (matches previous component behavior)
  if (!session?.access_token) {
    console.error("FILE UPLOAD ERROR: No access token available");
    throw new Error("Sign in required: please login before uploading a file.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };

  // Timeout via AbortController (defaults to 30s to match prior behavior)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 30000);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: formData,
      credentials: "omit",
      signal: controller.signal,
    });

    // Preserve existing behavior when raw=true (skip ok-check and parsing)
    if (options?.raw === true) {
      return res;
    }

    await throwIfResNotOk(res);
    return await res.json();
  } catch (error: any) {
    // Normalize timeout and network errors for consistent UX
    if (error?.name === "AbortError") {
      throw new Error("Upload timeout - request took longer than 30 seconds");
    }
    if (error?.message?.toLowerCase().includes("network")) {
      throw new Error("Network error. Please check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Read current session and attach Authorization for all queries
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // DEBUG: Log query function session details
    console.log("QUERY FUNCTION DEBUG:", {
      queryKey: queryKey[0],
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      tokenPreview: session?.access_token ? `${session.access_token.substring(0, 20)}...` : null,
    });

    const headers: Record<string, string> = {};
    headers["Accept"] = "application/json";
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    } else {
      console.warn("Query function: No access token available");
    }

    const res = await fetch(queryKey[0] as string, {
      credentials: "omit",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
