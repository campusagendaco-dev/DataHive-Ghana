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
  const maxRetries = 3;
  const baseDelay = 800; // start with 800ms
  
  // Dynamic Cache-Buster to prevent Opera Mini, Phoenix, and Telecom caching proxies from serving stale API responses
  const cacheBuster = `cb=${Date.now()}`;
  const finalFunctionName = functionName.includes("?") 
    ? `${functionName}&${cacheBuster}` 
    : `${functionName}?${cacheBuster}`;

  const headers = {
    ...(options?.headers || {}),
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  };

  const finalOptions = {
    ...options,
    headers,
  };
  
  while (retries <= maxRetries) {
    try {
      const result = await publicFunctionClient.functions.invoke(finalFunctionName, finalOptions);
      // If we got a result (even an error), return it
      return result;
    } catch (error: any) {
      const isConnectionError = 
        error?.message?.includes("failed to fetch") || 
        error?.message?.includes("Network error") ||
        error?.message?.includes("ERR_CONNECTION_CLOSED");

      if (retries === maxRetries || !isConnectionError) {
        if (isConnectionError) {
          console.error(`[Resilience] Final retry for ${functionName} failed:`, error);
        }
        throw error;
      }

      retries++;
      const delay = baseDelay * Math.pow(2, retries - 1); // 800, 1600, 3200ms
      console.warn(`[Resilience] ${functionName} failed (retry ${retries}/${maxRetries} after ${delay}ms):`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return await publicFunctionClient.functions.invoke(finalFunctionName, finalOptions);
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
