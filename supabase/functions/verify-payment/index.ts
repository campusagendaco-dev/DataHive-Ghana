import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.trim().replace(/[^\d+]/g, "");
  if (!clean) return null;
  if (clean.startsWith("+")) {
    const normalized = `+${clean.slice(1).replace(/\D/g, "")}`;
    return normalized.length >= 11 ? normalized : null;
  }
  const digits = clean.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("233") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+233${digits.slice(1)}`;
  if (digits.startsWith("00") && digits.length > 2) return `+${digits.slice(2)}`;
  return digits.length >= 10 ? `+${digits}` : null;
}

async function sendSmsIfConfigured(to: string, body: string): Promise<void> {
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return;
  }

  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to,
      From: TWILIO_FROM_NUMBER,
      Body: body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twilio send failed (${response.status}): ${errorText}`);
  }
}

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

function normalizeProviderFailure(rawText: string | null | undefined, fallback: string): string {
  const text = (rawText || "").trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();
  if (
    lower.includes("<!doctype html") ||
    lower.includes("<html") ||
    lower.includes("cf_chl_opt") ||
    lower.includes("just a moment")
  ) {
    return "Provider blocked server request (Cloudflare challenge). Contact DataBossHub support to whitelist API traffic.";
  }
  return text;
}

async function fetchWithRetry(url: string, options: RequestInit, maxAttempts = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status >= 400 && res.status < 500) return res;
      if (res.ok) return res;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
      } else {
        return res;
      }
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error("fetchWithRetry: should not reach here");
}

type ProviderName = "primary" | "secondary";

type ProviderConfig = {
  name: ProviderName;
  baseUrl: string;
  apiKey: string;
};

async function callProviderWithFallback(
  path: string,
  body: Record<string, unknown>,
  providers: ProviderConfig[],
  autoSwitch: boolean,
): Promise<{ response: Response; responseText: string; providerName: ProviderName }> {
  const first = providers[0];
  const firstResponse = await fetchWithRetry(`${first.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "DataBossHub-API-Client/1.0",
      "X-API-Key": first.apiKey,
      "X-API-KEY": first.apiKey,
    },
    body: JSON.stringify(body),
  });
  const firstText = await firstResponse.text();

  if (firstResponse.ok || !autoSwitch || providers.length < 2) {
    return { response: firstResponse, responseText: firstText, providerName: first.name };
  }

  const second = providers[1];
  const secondResponse = await fetchWithRetry(`${second.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "DataBossHub-API-Client/1.0",
      "X-API-Key": second.apiKey,
      "X-API-KEY": second.apiKey,
    },
    body: JSON.stringify(body),
  });
  const secondText = await secondResponse.text();
  return { response: secondResponse, responseText: secondText, providerName: second.name };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
  const PRIMARY_DATA_PROVIDER_API_KEY = Deno.env.get("DATA_PROVIDER_API_KEY")?.trim();
  const PRIMARY_DATA_PROVIDER_BASE_URL = Deno.env.get("DATA_PROVIDER_BASE_URL")?.trim().replace(/\/+$/, "");
  const SECONDARY_DATA_PROVIDER_API_KEY = Deno.env.get("SECONDARY_DATA_PROVIDER_API_KEY")?.trim();
  const SECONDARY_DATA_PROVIDER_BASE_URL = Deno.env.get("SECONDARY_DATA_PROVIDER_BASE_URL")?.trim().replace(/\/+$/, "");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PRIMARY_DATA_PROVIDER_BASE_URL) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: systemSettings } = await supabase
      .from("system_settings")
      .select("auto_api_switch, preferred_provider, backup_provider")
      .eq("id", 1)
      .maybeSingle();

    const providerMap: Record<ProviderName, ProviderConfig | null> = {
      primary:
        PRIMARY_DATA_PROVIDER_BASE_URL && PRIMARY_DATA_PROVIDER_API_KEY
          ? { name: "primary", baseUrl: PRIMARY_DATA_PROVIDER_BASE_URL, apiKey: PRIMARY_DATA_PROVIDER_API_KEY }
          : null,
      secondary:
        SECONDARY_DATA_PROVIDER_BASE_URL && SECONDARY_DATA_PROVIDER_API_KEY
          ? { name: "secondary", baseUrl: SECONDARY_DATA_PROVIDER_BASE_URL, apiKey: SECONDARY_DATA_PROVIDER_API_KEY }
          : null,
    };

    const preferredProvider: ProviderName = systemSettings?.preferred_provider === "secondary" ? "secondary" : "primary";
    const backupProvider: ProviderName = systemSettings?.backup_provider === "primary" ? "primary" : "secondary";
    const autoSwitch = Boolean(systemSettings?.auto_api_switch);
    const orderedProviders = [providerMap[preferredProvider], providerMap[backupProvider]].filter(Boolean) as ProviderConfig[];

    if (orderedProviders.length === 0) {
      return new Response(JSON.stringify({ error: "No configured API provider available" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the order
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", reference)
      .maybeSingle();

    // If order exists and already fulfilled, return immediately
    if (order?.status === "fulfilled") {
      return new Response(JSON.stringify({ status: "fulfilled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always verify with Paystack to get ground truth
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, Accept: "application/json" },
    });

    const verifyContentType = verifyRes.headers.get("content-type");
    if (!verifyContentType?.includes("application/json")) {
      return new Response(JSON.stringify({ status: order?.status || "unknown", error: "Verification failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyData = await verifyRes.json();
    if (!verifyData.status || verifyData.data.status !== "success") {
      return new Response(JSON.stringify({ status: order?.status || "pending" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payment verified with Paystack
    const metadata = verifyData.data.metadata || {};
    const orderType = order?.order_type || metadata.order_type;
    const agentId = order?.agent_id || metadata.agent_id;
    const paidAmount = order?.amount || (verifyData.data.amount / 100); // Paystack returns amount in pesewas
    let paymentMarkedPaid = false;

    // If order doesn't exist, recreate it from Paystack metadata
    if (!order && agentId) {
      console.log("Order not found locally, recreating from Paystack metadata:", { reference, orderType, agentId });
      const walletCredit = metadata.wallet_credit || metadata.amount || paidAmount;
      await supabase.from("orders").insert({
        id: reference,
        agent_id: agentId,
        order_type: orderType || "wallet_topup",
        amount: orderType === "wallet_topup" ? walletCredit : paidAmount,
        profit: 0,
        status: "paid",
        network: metadata.network || null,
        package_size: metadata.package_size || null,
        customer_phone: metadata.customer_phone || null,
      });
      paymentMarkedPaid = true;
    } else if (order?.status === "pending") {
      await supabase.from("orders").update({ status: "paid" }).eq("id", reference);
      paymentMarkedPaid = true;
    }

    console.log("Payment verified for:", reference, "type:", orderType);

    if (paymentMarkedPaid) {
      if (orderType === "wallet_topup" && agentId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("user_id", agentId)
          .maybeSingle();
        const to = normalizePhone(profile?.phone);
        if (to) {
          const amountText = Number(metadata.wallet_credit || order?.amount || paidAmount || 0).toFixed(2);
          await sendSmsIfConfigured(
            to,
            `QuickData: Payment received for wallet top-up. Amount: GHS ${amountText}. Ref: ${reference}.`,
          ).catch((smsError) => console.error("Payment receipt SMS error:", smsError));
        }
      } else {
        const customerPhone = order?.customer_phone || metadata.customer_phone;
        const to = normalizePhone(customerPhone);
        if (to) {
          const amountText = Number(order?.amount || paidAmount || 0).toFixed(2);
          await sendSmsIfConfigured(
            to,
            `QuickData: Payment received. We are processing your ${orderType || "order"}. Amount: GHS ${amountText}. Ref: ${reference}.`,
          ).catch((smsError) => console.error("Payment receipt SMS error:", smsError));
        }
      }
    }

    // Handle wallet top-up
    if (orderType === "wallet_topup") {
      // Use the wallet_credit from metadata if available, otherwise fall back to order amount
      const creditAmount = metadata.wallet_credit || order?.amount || paidAmount;
      
      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (wallet) {
        const newBalance = parseFloat(((wallet.balance || 0) + creditAmount).toFixed(2));
        await supabase.from("wallets").update({ balance: newBalance }).eq("agent_id", agentId);
        console.log(`Credited wallet for agent ${agentId}: +${creditAmount}, new balance: ${newBalance}`);
      } else {
        await supabase.from("wallets").insert({ agent_id: agentId, balance: creditAmount });
        console.log(`Created wallet for agent ${agentId} with balance: ${creditAmount}`);
      }

      const { data: topupTransitioned } = await supabase
        .from("orders")
        .update({ status: "fulfilled" })
        .eq("id", reference)
        .neq("status", "fulfilled")
        .select("id, amount, agent_id")
        .maybeSingle();

      if (topupTransitioned?.agent_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("user_id", topupTransitioned.agent_id)
          .maybeSingle();

        const to = normalizePhone(profile?.phone);
        if (to) {
          const amountText = Number(topupTransitioned.amount || creditAmount || 0).toFixed(2);
          await sendSmsIfConfigured(
            to,
            `QuickData: Wallet top-up successful. GHS ${amountText} has been credited. Ref: ${reference}.`,
          ).catch((smsError) => console.error("Top-up SMS error:", smsError));
        }
      }

      return new Response(JSON.stringify({ status: "fulfilled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle data/AFA fulfillment
    const needsFulfillment = !order || order.status === "pending" || order.status === "paid" || order.status === "fulfillment_failed";
    if (!needsFulfillment) {
      return new Response(JSON.stringify({ status: order?.status || "unknown" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fulfilled = false;

    if (orderType === "afa") {
      const afaData = {
        full_name: order?.afa_full_name || metadata.afa_full_name,
        ghana_card: order?.afa_ghana_card || metadata.afa_ghana_card,
        occupation: order?.afa_occupation || metadata.afa_occupation,
        email: order?.afa_email || metadata.afa_email,
        residence: order?.afa_residence || metadata.afa_residence,
        date_of_birth: order?.afa_date_of_birth || metadata.afa_date_of_birth,
      };

      console.log("Fulfilling AFA order:", afaData);
      const { response: fulfillRes, responseText: fulfillText, providerName } = await callProviderWithFallback(
        "/api/afa-registration",
        afaData,
        orderedProviders,
        autoSwitch,
      );
      console.log("AFA fulfillment response:", providerName, fulfillRes.status, fulfillText);

      if (fulfillRes.ok) {
        await supabase.from("orders").update({ status: "fulfilled" }).eq("id", reference);
        fulfilled = true;
      } else {
        const reason = normalizeProviderFailure(fulfillText, "AFA registration failed");
        await supabase.from("orders").update({ status: "fulfillment_failed", failure_reason: reason }).eq("id", reference);
      }
    } else {
      const network = order?.network || metadata.network;
      const packageSize = order?.package_size || metadata.package_size;
      const customerPhone = order?.customer_phone || metadata.customer_phone;

      if (network && packageSize && customerPhone) {
        const apiNetwork = mapNetworkToApi(network);
        const dataPlan = formatDataPlan(packageSize);
        console.log("Fulfilling data order:", { network, apiNetwork, packageSize, dataPlan, customerPhone });

        const { response: fulfillRes, responseText: fulfillText, providerName } = await callProviderWithFallback(
          "/api/v1/order",
          {
            network: apiNetwork,
            data_plan: dataPlan,
            beneficiary: customerPhone,
          },
          orderedProviders,
          autoSwitch,
        );
        console.log("Data fulfillment response:", providerName, fulfillRes.status, fulfillText);

        if (fulfillRes.ok) {
          const { data: transitioned } = await supabase
            .from("orders")
            .update({ status: "fulfilled" })
            .eq("id", reference)
            .neq("status", "fulfilled")
            .select("id, amount, network, package_size, customer_phone")
            .maybeSingle();

          const to = normalizePhone(customerPhone);
          if (transitioned && to) {
            const amountText = Number(transitioned.amount || 0).toFixed(2);
            const sms = `QuickData: ${network} ${packageSize} to ${customerPhone} delivered. Amount: GHS ${amountText}. Ref: ${reference}.`;
            await sendSmsIfConfigured(to, sms).catch((smsError) => console.error("Data order SMS error:", smsError));
          }
          fulfilled = true;
        } else {
          let reason = fulfillText || "Data delivery failed";
          try {
            reason = JSON.parse(fulfillText)?.message || reason;
          } catch {
            // Keep plain-text provider response as failure reason.
          }
          reason = normalizeProviderFailure(reason, "Data delivery failed");
          console.error("Fulfillment failed. Status:", fulfillRes.status, "Body:", fulfillText);
          await supabase.from("orders").update({ status: "fulfillment_failed", failure_reason: reason }).eq("id", reference);
        }
      }
    }

    const { data: updatedOrder } = await supabase.from("orders").select("status, failure_reason").eq("id", reference).maybeSingle();
    const resolvedStatus = updatedOrder?.status || (fulfilled ? "fulfilled" : "pending");

    return new Response(JSON.stringify({
      status: resolvedStatus,
      _internal_status: updatedOrder?.status || null,
      failure_reason: updatedOrder?.failure_reason || null,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Verify payment error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
