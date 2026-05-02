import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const DATAMART_WEBHOOK_SECRET = Deno.env.get("DATAMART_WEBHOOK_SECRET");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-datamart-signature");

    if (!signature) {
      console.error("[DataMart Webhook] Missing signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Resolve Secret (Env Var or DB)
    let secret = DATAMART_WEBHOOK_SECRET;
    if (!secret) {
      const { data: provider } = await supabaseAdmin
        .from("providers")
        .select("settings")
        .eq("handler_type", "datamart")
        .eq("is_active", true)
        .maybeSingle();
      
      secret = provider?.settings?.webhook_secret;
    }

    // Verify Signature if secret is found
    if (secret) {
      const hmac = createHmac("sha256", secret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest("hex");

      if (signature !== expectedSignature) {
        console.error("[DataMart Webhook] Invalid signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("[DataMart Webhook] No secret found in Env or DB, skipping verification (Insecure!)");
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;
    
    // Extract reference - adjust based on DataMart's actual payload structure
    const reference = data?.orderReference || data?.reference || data?.orderId;
    const status = (data?.status || "").toLowerCase();

    console.log(`[DataMart Webhook] Event: ${event}, Ref: ${reference}, Status: ${status}`);

    if (!reference) {
      return new Response(JSON.stringify({ error: "No reference found in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle Fulfillment
    const isSuccess = status === "completed" || status === "success" || status === "delivered" || status === "fulfilled";
    const isFailed = status === "failed" || status === "rejected" || status === "refunded";

    if (isSuccess) {
      const { data: order, error: fetchError } = await supabaseAdmin
        .from("orders")
        .select("status")
        .eq("id", reference)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (order && order.status !== "fulfilled") {
        console.log(`[DataMart Webhook] Marking order ${reference} as fulfilled`);
        await supabaseAdmin.from("orders").update({ 
          status: "fulfilled",
          updated_at: new Date().toISOString()
        }).eq("id", reference);

        // Credit profits
        await supabaseAdmin.rpc("credit_order_profits", { p_order_id: reference });
      }
    } else if (isFailed) {
      console.log(`[DataMart Webhook] Marking order ${reference} as failed`);
      await supabaseAdmin.from("orders").update({ 
        status: "fulfillment_failed",
        failure_reason: `Provider reported failure: ${status}`,
        updated_at: new Date().toISOString()
      }).eq("id", reference);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[DataMart Webhook] Internal Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
