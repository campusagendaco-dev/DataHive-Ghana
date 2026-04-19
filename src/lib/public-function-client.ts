import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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
