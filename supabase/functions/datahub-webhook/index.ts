import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyApiClient } from "../_shared/webhooks.ts";

// DataHub Ghana webhook handler
// Receives: order.status_updated events from DatahubGHMainServer-Webhook/1.0
// Docs: https://app.datahubgh.com/docs/api

const DATAHUB_USER_AGENT = "DatahubGHMainServer-Webhook/1.0";

// Maps DataHub statuses to internal system statuses
function mapDatahubStatus(status: string): "processing" | "fulfilled" | "fulfillment_failed" | null {
  switch (status.toUpperCase()) {
    case "SUCCESSFUL":
      return "fulfilled";
    case "FAILED":
    case "CANCELLED":
      return "fulfillment_failed";
    case "INITIATED":
    case "PENDING":
    case "PROCESSING":
      return "processing";
    default:
      return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "online" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Validate User-Agent as basic authenticity check
    const userAgent = req.headers.get("user-agent") || "";
    if (!userAgent.includes(DATAHUB_USER_AGENT)) {
      console.warn("[datahub-webhook] Rejected request from unknown User-Agent:", userAgent);
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    if (!rawBody) {
      return new Response(JSON.stringify({ error: "Empty body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const event = payload?.event;
    const data = payload?.data;

    console.log("[datahub-webhook] Received event:", event, JSON.stringify(data));

    if (event !== "order.status_updated" || !data) {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const datahubReference = data.reference;   // e.g. "ORDER_123456_..."
    const datahubOrderNumber = String(data.orderNumber || "");
    const datahubStatus = data.status || "";
    const systemStatus = mapDatahubStatus(datahubStatus);

    if (!systemStatus) {
      console.log("[datahub-webhook] Unknown status, ignoring:", datahubStatus);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up order — we pass our own order ID as `reference` in the purchase request,
    // so DataHub echoes it back. Try direct ID match first, then provider_order_id fallback.
    const filters = [
      datahubReference ? `id.eq.${datahubReference}` : null,
      datahubReference ? `provider_order_id.eq.${datahubReference}` : null,
      datahubOrderNumber ? `provider_order_id.eq.${datahubOrderNumber}` : null,
    ].filter(Boolean).join(",");

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, status, agent_id, profit, parent_profit")
      .or(filters)
      .maybeSingle();

    if (fetchError || !order) {
      console.warn("[datahub-webhook] Order not found for reference:", datahubReference, "orderNumber:", datahubOrderNumber);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: don't re-process if already in terminal state
    if (order.status === "fulfilled" && systemStatus === "fulfilled") {
      return new Response(JSON.stringify({ received: true, message: "Already fulfilled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (order.status === "fulfillment_failed" && systemStatus === "fulfillment_failed") {
      return new Response(JSON.stringify({ received: true, message: "Already failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patch: Record<string, any> = {
      status: systemStatus,
      updated_at: new Date().toISOString(),
    };

    if (systemStatus === "fulfillment_failed") {
      patch.failure_reason = `DataHub reported: ${datahubStatus}`;
    }

    await supabaseAdmin.from("orders").update(patch).eq("id", order.id);

    if (systemStatus === "fulfilled") {
      if (order.profit > 0 || order.parent_profit > 0) {
        await supabaseAdmin.rpc("credit_order_profits", { p_order_id: order.id });
      }
      await notifyApiClient(supabaseAdmin, order.id, "fulfilled");
    } else if (systemStatus === "fulfillment_failed") {
      await notifyApiClient(supabaseAdmin, order.id, "fulfillment_failed");
    }

    console.log("[datahub-webhook] Order", order.id, "updated to", systemStatus);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[datahub-webhook] Error:", err.message);
    return new Response(JSON.stringify({ error: "Internal Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
