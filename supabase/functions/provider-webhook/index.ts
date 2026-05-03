import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyApiClient } from "../_shared/webhooks.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (req.method === "GET") {
      return new Response(JSON.stringify({ status: "online" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.text();
    if (!body || body.trim() === "") {
      return new Response(JSON.stringify({ message: "Empty body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payload = JSON.parse(body);
    const reference = payload?.data?.reference || payload?.reference || payload?.order_id;
    const rawStatus = (payload?.data?.status || payload?.status || "").toLowerCase();
    
    let systemStatus = "processing";
    if (["completed", "success", "delivered", "fulfilled"].includes(rawStatus)) systemStatus = "fulfilled";
    else if (["failed", "rejected", "error"].includes(rawStatus)) systemStatus = "fulfillment_failed";

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, status, agent_id, order_type")
      .or(`id.eq.${reference},provider_order_id.eq.${reference}`)
      .maybeSingle();

    if (fetchError || !order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
    if (order.status === "fulfilled" && systemStatus === "fulfilled") return new Response(JSON.stringify({ message: "Already fulfilled" }));

    await supabaseAdmin.from("orders").update({ 
      status: systemStatus,
      updated_at: new Date().toISOString()
    }).eq("id", order.id);

    if (systemStatus === "fulfilled") {
      await supabaseAdmin.rpc("credit_order_profits", { p_order_id: order.id });
    }

    // ── Notify API Client ─────────────────────────────────────────────────────
    await notifyApiClient(supabaseAdmin, order.id, systemStatus);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[provider-webhook] Error:", error.message);
    return new Response(JSON.stringify({ error: "Internal Error" }), { status: 500 });
  }
});
