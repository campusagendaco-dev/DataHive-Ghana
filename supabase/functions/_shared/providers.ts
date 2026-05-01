import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface Provider {
  id: string;
  name: string;
  api_key: string;
  base_url: string;
  provider_type: "data" | "airtime" | "utility" | "sms";
  priority: number;
  is_active: boolean;
}

export async function getActiveProviders(supabaseAdmin: any, type: string): Promise<Provider[]> {
  const { data, error } = await supabaseAdmin
    .from("providers")
    .select("*")
    .eq("provider_type", type)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) {
    console.error("Error fetching providers:", error);
    return [];
  }
  return data || [];
}

export async function logProviderError(supabaseAdmin: any, providerId: string, orderId: string, error: string) {
  await supabaseAdmin.from("provider_errors").insert({
    provider_id: providerId,
    order_id: orderId,
    error_message: error
  });
}
