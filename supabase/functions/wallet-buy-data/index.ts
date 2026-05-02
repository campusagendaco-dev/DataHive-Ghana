import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-user-access-token, x-supabase-auth-token, x-api-key, api-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

import { sendPaymentSms } from "../_shared/sms.ts";

// --- HELPERS ---
function normalizeNetworkForPricing(network: string): "MTN" | "Telecel" | "AirtelTigo" {
  const n = (network || "").trim().toUpperCase();
  if (n === "AT" || n === "AIRTEL TIGO" || n === "AIRTELTIGO") return "AirtelTigo";
  if (n === "VODAFONE" || n === "TELECEL") return "Telecel";
  return "MTN";
}

function normalizeRecipient(phone: string): string {
  const digits = (phone || "").replace(/\D+/g, "");
  if (digits.startsWith("233") && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.length === 9) return `0${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return digits;
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log(`[REQ] ${req.method} ${req.url}`);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const payload = await req.json().catch(() => ({}));
    console.log("[PAYLOAD]", JSON.stringify(payload));

    const { network: networkRaw, package_size, customer_phone, amount: requestedAmount, reference } = payload;
    
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[AUTH] No header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("[AUTH] Verifying user...");
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("[AUTH] Error:", userError);
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[USER] ${user.id} (${user.email})`);

    // 1. ATOMIC DEBIT (FOREGROUND)
    console.log(`[DEBIT] Starting debit for ${requestedAmount}...`);
    const { data: debitResult, error: debitError } = await supabaseAdmin.rpc("debit_wallet", {
      p_agent_id: user.id,
      p_amount: requestedAmount,
    });

    if (debitError || !debitResult?.success) {
      console.error(`[DEBIT_FAIL] ${user.id}:`, debitError || debitResult?.error);
      return new Response(JSON.stringify({ error: debitResult?.error || "Insufficient balance or wallet error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`[DEBIT_SUCCESS] New balance: ${debitResult.new_balance}`);

    const orderId = reference || crypto.randomUUID();

    // 2. INSERT ORDER (FOREGROUND)
    console.log(`[INSERT] Creating order ${orderId}...`);
    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      id: orderId,
      agent_id: user.id,
      customer_phone: normalizeRecipient(customer_phone),
      network: normalizeNetworkForPricing(networkRaw),
      package_size: package_size,
      amount: requestedAmount,
      status: "paid"
    });

    if (insertError) {
      console.error(`[INSERT_FAIL] ${orderId}:`, insertError);
      // Refund if insert fails
      await supabaseAdmin.rpc("credit_wallet", { p_agent_id: user.id, p_amount: requestedAmount });
      return new Response(JSON.stringify({ error: "Failed to create order record" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`[INSERT_SUCCESS] Order ${orderId} created as PAID.`);

    // 3. TRIGGER SMS (NON-BLOCKING)
    sendPaymentSms(supabaseAdmin, customer_phone, "payment_success", {
      phone: customer_phone,
      package: package_size || "Data Bundle",
      amount: requestedAmount
    }).catch(e => console.error("[SMS-ERROR]", e));

    // 4. RETURN SUCCESS IMMEDIATELY
    return new Response(JSON.stringify({ 
      success: true, 
      order_id: orderId, 
      status: "paid" 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[CRASH]", error);
    return new Response(JSON.stringify({ error: "Internal processing error: " + error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});