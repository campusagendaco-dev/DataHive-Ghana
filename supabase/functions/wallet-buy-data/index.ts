import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function mapNetworkToApi(network: string): string {
  const normalized = network.trim().toUpperCase();
  if (normalized === "AIRTELTIGO" || normalized === "AIRTEL TIGO") return "AIRTELTIGO";
  if (normalized === "TELECEL" || normalized === "VODAFONE") return "TELECEL";
  if (normalized === "MTN") return "MTN";
  return normalized;
}

function formatDataPlan(packageSize: string): string {
  return packageSize.replace(/\s+/g, "").toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const DATA_PROVIDER_API_KEY = Deno.env.get("DATA_PROVIDER_API_KEY")?.trim();
  const DATA_PROVIDER_BASE_URL = Deno.env.get("DATA_PROVIDER_BASE_URL")?.trim().replace(/\/+$/, "");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DATA_PROVIDER_API_KEY || !DATA_PROVIDER_BASE_URL) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  try {
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { network, package_size, customer_phone, amount } = await req.json();

    if (!network || !package_size || !customer_phone || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create wallet
    let { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("id, balance")
      .eq("agent_id", user.id)
      .maybeSingle();

    if (!wallet) {
      const { data: newWallet } = await supabaseAdmin
        .from("wallets")
        .insert({ agent_id: user.id, balance: 0 })
        .select()
        .single();
      wallet = newWallet;
    }

    if (!wallet || wallet.balance < amount) {
      return new Response(JSON.stringify({ error: `Insufficient wallet balance. Available: GH₵${(wallet?.balance || 0).toFixed(2)}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct from wallet
    const newBalance = parseFloat((wallet.balance - amount).toFixed(2));
    await supabaseAdmin.from("wallets").update({ balance: newBalance }).eq("agent_id", user.id);

    // Create order
    const orderId = crypto.randomUUID();
    await supabaseAdmin.from("orders").insert({
      id: orderId,
      agent_id: user.id,
      order_type: "data",
      network,
      package_size,
      customer_phone,
      amount,
      profit: 0,
      status: "paid",
    });

    // Fulfill via API (DataBossHub format)
    const apiNetwork = mapNetworkToApi(network);
    const dataPlan = formatDataPlan(package_size);
    console.log("Wallet buy data:", { network, apiNetwork, package_size, dataPlan, customer_phone });

    const fulfillRes = await fetch(`${DATA_PROVIDER_BASE_URL}/api/v1/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "DataBossHub-API-Client/1.0",
        "X-API-KEY": DATA_PROVIDER_API_KEY,
      },
      body: JSON.stringify({
        network: apiNetwork,
        data_plan: dataPlan,
        beneficiary: customer_phone,
      }),
    });

    const fulfillText = await fulfillRes.text();
    console.log("Fulfillment response:", fulfillRes.status, fulfillText);

    if (fulfillRes.ok) {
      await supabaseAdmin.from("orders").update({ status: "fulfilled" }).eq("id", orderId);
      return new Response(JSON.stringify({ success: true, order_id: orderId, status: "fulfilled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      let reason = "Data delivery failed";
      try { reason = JSON.parse(fulfillText)?.message || reason; } catch { /* keep fallback reason */ }
      await supabaseAdmin.from("orders").update({ status: "fulfillment_failed", failure_reason: reason }).eq("id", orderId);
      return new Response(JSON.stringify({ success: true, order_id: orderId, status: "fulfillment_failed", failure_reason: reason }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Wallet buy data error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
