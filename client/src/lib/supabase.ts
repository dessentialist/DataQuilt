import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Phase 10: Security Review - Add validation logging for environment variables
console.log("Supabase Client Initialization:", {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  urlLength: supabaseUrl.length,
  keyLength: supabaseAnonKey.length,
  urlPrefix: supabaseUrl.substring(0, 30) + "...",
  isDev: import.meta.env.DEV,
  mode: import.meta.env.MODE,
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Critical: Missing Supabase environment variables", {
    url: !!supabaseUrl,
    anonKey: !!supabaseAnonKey,
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type RealtimeChannel = ReturnType<typeof supabase.channel>;
