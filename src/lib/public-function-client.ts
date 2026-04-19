import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

// Use an authless client for public purchase/verification edge function calls.
// This avoids browser session JWT algorithm mismatches at the gateway level.
const publicFunctionClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: "swiftdata-public-function-client",
  },
});

export async function invokePublicFunction(functionName: string, options?: { body?: unknown; headers?: Record<string, string> }) {
  return await publicFunctionClient.functions.invoke(functionName, options);
}

export async function invokePublicFunctionAsUser(functionName: string, options?: { body?: unknown; headers?: Record<string, string> }) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  const headers = { ...(options?.headers || {}) };

  if (accessToken) {
    headers["x-user-access-token"] = accessToken;
  }

  return await invokePublicFunction(functionName, {
    ...options,
    headers,
  });
}
