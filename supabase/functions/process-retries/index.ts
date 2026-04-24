import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const DATA_PROVIDER_BASE_URL = Deno.env.get("DATA_PROVIDER_BASE_URL") || "";
const DATA_PROVIDER_API_KEY = Deno.env.get("DATA_PROVIDER_API_KEY") || "";
const DATA_PROVIDER_WEBHOOK_URL = Deno.env.get("DATA_PROVIDER_WEBHOOK_URL") || "";

async function callProviderApi(baseUrl: string, apiKey: string, endpoint: string, data: any, webhookUrl?: string) {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/${endpoint}`;
  try {
    const payload = { ...data };
    if (webhookUrl) payload.webhook_url = webhookUrl;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = { body }; }

    return { 
      ok: response.ok && (parsed.status === "success" || parsed.status === true || parsed.ok === true), 
      status: response.status, 
      reason: parsed.message || parsed.reason || body,
      data: parsed
    };
  } catch (error) {
    return { ok: false, status: 500, reason: error instanceof Error ? error.message : "Network error" };
  }
}

function mapNetworkKey(network: string): string {
  const normalized = network.trim().toUpperCase();
  if (normalized === "MTN") return "YELLO";
  if (normalized === "TELECEL" || normalized === "VODAFONE") return "TELECEL";
  if (normalized === "AIRTELTIGO" || normalized === "AIRTEL TIGO" || normalized === "AT") return "AT_PREMIUM";
  return normalized;
}

function parseCapacity(packageSize: string): number {
  const match = packageSize.replace(/\s+/g, "").match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function normalizeRecipient(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  if (digits.length === 9) return `0${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return digits;
  if (digits.startsWith("233") && digits.length === 12) return `0${digits.slice(3)}`;
  return phone.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("[retry-orders] Starting retry cycle...");

    // Find orders to retry:
    // 1. Status is fulfillment_failed OR (processing and created_at < 5 mins ago)
    // 2. retry_count < 4
    // 3. last_retry_at is null OR older than 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: ordersToRetry, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .in("status", ["fulfillment_failed", "processing", "paid"])
      .lt("retry_count", 4)
      .or(`last_retry_at.is.null,last_retry_at.lt.${twoMinutesAgo}`)
      .limit(10);

    if (fetchError) throw fetchError;
    if (!ordersToRetry || ordersToRetry.length === 0) {
      console.log("[retry-orders] No orders found for retry.");
      return new Response(JSON.stringify({ message: "No orders to retry" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[retry-orders] Found ${ordersToRetry.length} orders to retry.`);

    const results = [];

    for (const order of ordersToRetry) {
      // For processing orders, only retry if they are older than 2 minutes
      const createdAt = new Date(order.created_at).getTime();
      if (order.status === "processing" && (Date.now() - createdAt) < 120000) {
        continue;
      }

      console.log(`[retry-orders] Retrying order ${order.id} (Attempt ${order.retry_count + 1})`);

      // Increment retry count immediately to prevent concurrent loops
      await supabaseAdmin
        .from("orders")
        .update({ 
          retry_count: order.retry_count + 1, 
          last_retry_at: new Date().toISOString(),
          status: "processing" 
        })
        .eq("id", order.id);

      let success = false;
      let failureReason = "";

      if (order.order_type === "afa") {
        const result = await callProviderApi(DATA_PROVIDER_BASE_URL, DATA_PROVIDER_API_KEY, "afa-registration", {
          afa_full_name: order.afa_full_name,
          afa_ghana_card: order.afa_ghana_card,
          afa_occupation: order.afa_occupation,
          afa_email: order.afa_email,
          afa_residence: order.afa_residence,
          afa_date_of_birth: order.afa_date_of_birth,
        });
        success = result.ok;
        failureReason = result.reason;
      } else if (order.order_type === "data") {
        const result = await callProviderApi(DATA_PROVIDER_BASE_URL, DATA_PROVIDER_API_KEY, "purchase", {
          networkRaw: order.network,
          networkKey: mapNetworkKey(order.network || ""),
          recipient: normalizeRecipient(order.customer_phone || ""),
          capacity: parseCapacity(order.package_size || ""),
        }, DATA_PROVIDER_WEBHOOK_URL);
        success = result.ok;
        failureReason = result.reason;
      }

      if (success) {
        await supabaseAdmin.from("orders").update({ status: "fulfilled", failure_reason: null }).eq("id", order.id);
        
        // Atomic Profit Credit (since it might have failed before)
        await supabaseAdmin.rpc("credit_order_profits", { p_order_id: order.id });
        
        results.push({ id: order.id, status: "fulfilled" });
      } else {
        await supabaseAdmin.from("orders").update({ 
          status: "fulfillment_failed", 
          failure_reason: failureReason 
        }).eq("id", order.id);
        results.push({ id: order.id, status: "failed", reason: failureReason });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[retry-orders] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
