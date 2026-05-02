import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Handle GET requests (often used for pings/verification)
    if (req.method === "GET") {
      return new Response(JSON.stringify({ status: "online" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.text();
    if (!body || body.trim() === "") {
      return new Response(JSON.stringify({ message: "Empty body, ping successful" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payload = JSON.parse(body);
    console.log("[provider-webhook] Received payload:", JSON.stringify(payload));

    // Standard / Event format
    const event = payload?.event || "";
    const data = payload?.data || {};
    
    // DataMart / Direct format support
    const reference = data?.reference || data?.orderReference || payload?.reference || payload?.order_id;
    const rawStatus = (data?.status || data?.orderStatus || payload?.status || "").toLowerCase();
    
    // Map status
    let systemStatus = "processing";
    if (rawStatus === "completed" || rawStatus === "success" || rawStatus === "delivered") {
      systemStatus = "fulfilled";
    } else if (rawStatus === "failed" || rawStatus === "rejected" || rawStatus === "error") {
      systemStatus = "fulfillment_failed";
    }

    console.log(`[provider-webhook] Updating order ${reference} to ${systemStatus}`);

    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .or(`id.eq.${reference},provider_order_id.eq.${reference}`)
      .maybeSingle();

    if (fetchError || !order) {
      console.error("[provider-webhook] Order not found for reference:", reference);
      return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
    }

    if (order.status === "fulfilled") {
      return new Response(JSON.stringify({ message: "Already fulfilled" }), { status: 200 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ 
        status: systemStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id);

    if (updateError) throw updateError;

    // If fulfilled, trigger profit credit
    if (systemStatus === "fulfilled") {
      await supabaseAdmin.rpc("credit_order_profits", { p_order_id: order.id });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[provider-webhook] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
