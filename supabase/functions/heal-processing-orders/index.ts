import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getActiveProviders, callProviderApi } from "../_shared/providers.ts";

declare const Deno: any;

// Heals orders stuck in 'processing' where the webhook was never received.
// For each stuck order:
//   1. Polls the provider's status API using our order reference.
//   2. If provider says delivered → mark fulfilled + credit profits.
//   3. If provider says failed    → mark fulfillment_failed.
//   4. If provider has no record  → re-submit the order (provider never received it).
// Called manually from the admin dashboard.

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    // Optional: pass specific order IDs, otherwise heal all stuck processing orders
    const targetIds: string[] | undefined = body.order_ids;

    // Fetch stuck processing orders (no webhook received = still processing after 5+ min)
    let query = supabaseAdmin
      .from("orders")
      .select("id, network, package_size, customer_phone, amount, agent_id, profit, parent_profit, provider_order_id, order_type, created_at")
      .eq("status", "processing")
      .in("order_type", ["data", "airtime"])
      .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // older than 5 min
      .order("created_at", { ascending: true })
      .limit(50);

    if (targetIds && targetIds.length > 0) {
      query = query.in("id", targetIds);
    }

    const { data: stuckOrders, error } = await query;
    if (error) throw error;

    const providers = await getActiveProviders(supabaseAdmin, "data");
    const results: any[] = [];

    for (const order of stuckOrders || []) {
      const result: any = { id: order.id, network: order.network, package_size: order.package_size, action: "none" };

      // Step 1: Poll provider status using our reference
      let statusResult: any = { ok: false };
      for (const provider of providers) {
        statusResult = await callProviderApi(provider, {
          reference: order.id,
          order_id: order.provider_order_id || order.id,
          transaction_id: order.provider_order_id || order.id,
        }, "status");
        if (statusResult.ok) break;
      }

      if (statusResult.ok) {
        const s = String(statusResult.status || "").toLowerCase();
        const isDelivered = ["delivered", "success", "successful", "fulfilled", "completed", "sent"].includes(s);
        const isFailed = ["failed", "error", "refunded", "cancelled", "rejected"].includes(s);

        if (isDelivered) {
          await supabaseAdmin.from("orders").update({ status: "fulfilled", failure_reason: null }).eq("id", order.id);
          await supabaseAdmin.rpc("credit_order_profits", { p_order_id: order.id });
          result.action = "fulfilled";
          result.reason = `Provider confirmed: ${statusResult.status}`;
        } else if (isFailed) {
          await supabaseAdmin.from("orders").update({
            status: "fulfillment_failed",
            failure_reason: `Provider confirmed failed: ${statusResult.status}`,
          }).eq("id", order.id);
          result.action = "failed";
          result.reason = `Provider confirmed: ${statusResult.status}`;
        } else {
          // Still processing on provider side — leave it
          result.action = "still_processing";
          result.reason = `Provider status: ${statusResult.status}`;
        }
      } else {
        // Provider has no record of this order — it was never submitted. Re-submit it.
        // Reset to 'paid' so the trigger + process-retries picks it up for a fresh attempt.
        await supabaseAdmin.from("orders").update({
          status: "paid",
          retry_count: 0,
          failure_reason: "Re-queued: provider had no record, likely never received",
        }).eq("id", order.id);
        result.action = "requeued";
        result.reason = "Provider had no record — reset to paid for fresh fulfillment attempt";
      }

      results.push(result);
      console.log(`[heal-processing] Order ${order.id}: ${result.action} — ${result.reason}`);
    }

    const summary = {
      total: results.length,
      fulfilled: results.filter(r => r.action === "fulfilled").length,
      failed: results.filter(r => r.action === "failed").length,
      requeued: results.filter(r => r.action === "requeued").length,
      still_processing: results.filter(r => r.action === "still_processing").length,
    };

    console.log("[heal-processing] Summary:", summary);

    return new Response(JSON.stringify({ success: true, summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[heal-processing] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
