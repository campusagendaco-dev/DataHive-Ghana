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
    // Explicit no-op custom lock to mirror main client and neutralize console warnings
    lock: async (_, __, fn) => await fn(),
  },
});

export async function invokePublicFunction(functionName: string, options?: { body?: unknown; headers?: Record<string, string> }) {
  let retries = 0;
  const maxRetries = 2;
  
  while (retries <= maxRetries) {
    try {
      const result = await publicFunctionClient.functions.invoke(functionName, options);
      // If we got a result (even an error), return it
      return result;
    } catch (error) {
      if (retries === maxRetries) throw error;
      console.warn(`Function ${functionName} failed (retry ${retries + 1}):`, error);
      retries++;
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 500 * retries));
    }
  }
  return await publicFunctionClient.functions.invoke(functionName, options);
}

export async function invokePublicFunctionAsUser(functionName: string, options?: { body?: unknown; headers?: Record<string, string> }) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  const headers = { ...(options?.headers || {}) };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
    headers["x-user-access-token"] = accessToken;
  }

  return await invokePublicFunction(functionName, {
    ...options,
    headers,
  });
}
