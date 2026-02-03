import { useEffect, useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

export function useAuth() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Phase 10: Security Review - Add comprehensive auth state logging
  console.log("useAuth hook initialized:", {
    isLoading,
    hasUser: !!user,
    isAuthenticated,
    userId: user?.userId,
  });

  const saveApiKeysMutation = useMutation({
    mutationFn: api.auth.saveApiKeys,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    },
  });

  // Ensure the Supabase-authenticated user exists in our DB, then fetch masked session details
  const syncUserWithBackend = useCallback(async () => {
    try {
      console.log("Starting syncUserWithBackend...");

      // DEBUG: Check current Supabase session before sync
      const {
        data: { session },
      } = await supabase.auth.getSession();
      console.log("DEBUG - Current session before sync:", {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        tokenLength: session?.access_token?.length,
        userId: session?.user?.id,
        expiresAt: session?.expires_at,
      });

      if (!session?.access_token) {
        console.warn("No access token available, cannot sync user");
        return;
      }

      // Ensure user exists in our DB (server derives identity from bearer token)
      console.log("Syncing user with backend...");
      await apiRequest("POST", "/api/auth/sync");
      console.log("User sync successful");

      // Fetch session details (masked keys)
      console.log("Fetching session details...");
      const response = await api.auth.getSession();
      console.log("Session response status:", response.status);

      if (response.ok) {
        const sessionUser = await response.json();
        console.log("Session user retrieved:", {
          userId: sessionUser.userId,
          email: sessionUser.email,
        });
        setUser(sessionUser);
        setIsAuthenticated(true);
      } else {
        console.error("Failed to fetch session details:", response.status);
        const errorText = await response.text();
        console.error("Session fetch error response:", errorText);
      }
    } catch (error) {
      console.error("Error syncing user:", error);
      console.error("Sync error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }, []);

  // Helper to cap backend sync duration so auth loading can't hang forever
  const SYNC_TIMEOUT_MS = 5000;
  const syncWithTimeout = useCallback(async () => {
    const timeout = new Promise<void>((resolve) =>
      setTimeout(() => {
        console.warn("syncUserWithBackend timed out");
        resolve();
      }, SYNC_TIMEOUT_MS),
    );
    await Promise.race([syncUserWithBackend(), timeout]);
  }, [syncUserWithBackend]);

  useEffect(() => {
    console.log("useAuth useEffect triggered");

    let isActive = true;

    // React to Supabase auth changes and keep backend session in sync
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AUTH STATE CHANGE:", {
        event,
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        accessToken: session?.access_token ? `${session.access_token.substring(0, 20)}...` : null,
        expiresAt: session?.expires_at,
        tokenType: session?.token_type,
      });

      if (session?.user) {
        console.log("Session established, syncing with backend...");
        await syncWithTimeout();
      } else {
        console.log("Session ended, clearing user state");
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    // On initial load, check Supabase session and sync with backend if present
    (async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        console.log("Initial session check:", {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id,
          error: error?.message,
        });

        if (session?.user) {
          console.log("Found existing session, syncing with backend...");
          await syncWithTimeout();
          console.log("Initial session sync complete");
        } else {
          console.log("No existing session found");
        }
      } catch (error) {
        console.error("Initial session restoration failed:", error);
      } finally {
        if (isActive) {
          setIsLoading(false);
          console.log("Initial auth load finished");
        }
      }
    })();

    return () => {
      console.log("useAuth cleanup - unsubscribing");
      isActive = false;
      subscription.unsubscribe();
    };
  }, [syncWithTimeout]);

  const loginWithGoogle = async () => {
    console.log("OAUTH DEBUG - Starting Google login...");
    console.log("OAUTH DEBUG - Current URL origin:", window.location.origin);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      console.log("OAUTH DEBUG - OAuth response:", {
        hasData: !!data,
        hasUrl: !!data?.url,
        url: data?.url,
        error: error?.message,
      });

      // In some embedded/preview environments auto-redirects can be suppressed.
      // If Supabase returned a URL but the browser hasn't navigated yet, force it.
      if (data?.url) {
        console.log("OAUTH DEBUG - Forcing navigation to OAuth URL");
        window.location.assign(data.url);
      }

      if (error) {
        console.error("OAUTH ERROR:", error);
      }
    } catch (error) {
      console.error("OAUTH EXCEPTION:", error);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    queryClient.clear();
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    loginWithGoogle,
    logout,
    saveApiKeys: saveApiKeysMutation.mutate,
    isLogoutPending: false,
    isSavingKeys: saveApiKeysMutation.isPending,
  };
}
