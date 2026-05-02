import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getActiveProviders, logProviderError } from "../_shared/providers.ts";

async function fetchScannerStats(apiKey: string) {
  try {
    const res = await fetch("https://api.datamartgh.shop/api/developer/delivery-tracker", {
      headers: { "X-API-Key": apiKey }
    });
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (e) {
    console.error("Failed to fetch scanner stats:", e);
  }
  return null;
}

// --- Utilities ---

function getFirstEnv(...keys: string[]): string {
  for (const key of keys) {
    const v = Deno.env.get(key)?.trim();
    if (v) return v;
  }
  return "";
}

// Maps network names to the keys the data provider API expects (must match wallet-buy-data)
function mapDataNetworkKey(network: string): string {
  const n = (network || "").trim().toUpperCase();
  if (n === "AIRTELTIGO" || n === "AIRTEL TIGO" || n === "AIRTEL-TIGO" || n === "AT") return "AT_PREMIUM";
  if (n === "TELECEL" || n === "VODAFONE" || n === "VOD") return "TELECEL";
  if (n === "MTN" || n === "YELLO") return "YELLO";
  return n;
}

// Maps network names to the keys the airtime provider API expects (must match wallet-pay-airtime)
function mapAirtimeNetworkKey(network: string): string {
  const n = (network || "").trim().toUpperCase();
  if (n === "MTN" || n === "YELLO") return "MTN";
  if (n === "VOD" || n === "VODAFONE" || n === "TELECEL") return "VOD";
  if (n === "AT" || n === "AIRTELTIGO" || n === "AIRTEL TIGO") return "AT";
  if (n === "GLO") return "GLO";
  return n;
}

function parseCapacity(packageSize: string | null | undefined): number {
  if (!packageSize) return 0;
  const match = packageSize.replace(/\s+/g, "").match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function normalizeRecipient(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D+/g, "");
  if (digits.startsWith("233") && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.length === 9) return `0${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return digits;
  return phone.trim();
}

async function getProviderCredentials(supabaseAdmin: any): Promise<{ apiKey: string; baseUrl: string; paystackSecretKey: string }> {
  const apiKey = getFirstEnv(
    "PRIMARY_DATA_PROVIDER_API_KEY",
    "DATA_PROVIDER_API_KEY",
    "DATA_PROVIDER_PRIMARY_API_KEY",
  );
  const baseUrl = getFirstEnv(
    "PRIMARY_DATA_PROVIDER_BASE_URL",
    "DATA_PROVIDER_BASE_URL",
    "DATA_PROVIDER_PRIMARY_BASE_URL",
  ).replace(/\/+$/, "");

  if (apiKey && baseUrl) return { apiKey, baseUrl };

  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("data_provider_api_key, data_provider_base_url, paystack_secret_key")
    .eq("id", 1)
    .maybeSingle();

  return {
    apiKey: apiKey || settings?.data_provider_api_key || "",
    baseUrl: (baseUrl || settings?.data_provider_base_url || "").replace(/\/+$/, ""),
    paystackSecretKey: settings?.paystack_secret_key || ""
  };
}

async function getAirtimeCredentials(supabaseAdmin: any): Promise<{ apiKey: string; baseUrl: string }> {
  const { data: dbSettings } = await supabaseAdmin.from("system_settings").select("*").eq("id", 1).maybeSingle();

  const apiKey = getFirstEnv("AIRTIME_PROVIDER_API_KEY", "PRIMARY_DATA_PROVIDER_API_KEY") || 
                 dbSettings?.airtime_provider_api_key || 
                 dbSettings?.data_provider_api_key || "";
  
  const baseUrl = getFirstEnv("AIRTIME_PROVIDER_BASE_URL", "PRIMARY_DATA_PROVIDER_BASE_URL") || 
                  dbSettings?.airtime_provider_base_url || 
                  dbSettings?.data_provider_base_url || "";
  
  return { apiKey, baseUrl: (baseUrl || "").replace(/\/+$/, "") };
}

function buildProviderUrls(baseUrl: string, endpoint: string = "purchase", handlerType?: string): string[] {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (!clean) return [];

  const urls = new Set<string>();
  
  let aliases: string[] = [];
  if (handlerType === "datamart") {
    if (endpoint === "status") aliases = ["order-status"];
    else if (endpoint === "purchase") aliases = ["purchase"];
    else aliases = [endpoint];
  } else {
    aliases = endpoint === "purchase" 
      ? ["purchase", "order", "airtime", "buy", "topup", "recharge"] 
      : (endpoint === "status" ? ["status", "query", "check", "query-order"] : [endpoint]);
  }

  let rootUrl = "";
  try {
    rootUrl = new URL(clean).origin;
  } catch { /* ignore */ }

  // If the configured URL already ends with an alias, use it directly
  for (const alias of aliases) {
    if (clean.endsWith(`/${alias}`) || clean.endsWith(`/api/${alias}`)) {
      urls.add(clean);
    }
  }

  // Build /api/<alias> and /<alias> variants from the configured base
  for (const alias of aliases) {
    if (clean.endsWith("/api")) {
      urls.add(`${clean}/${alias}`);
      urls.add(`${clean.replace(/\/api$/, "")}/api/${alias}`);
    } else {
      urls.add(`${clean}/api/${alias}`);
      urls.add(`${clean}/${alias}`);
    }
  }

  // Also try from the root origin in case the base URL has an extra path segment
  if (rootUrl) {
    for (const alias of aliases) {
      urls.add(`${rootUrl}/api/${alias}`);
      urls.add(`${rootUrl}/${alias}`);
      urls.add(`${rootUrl}/functions/v1/developer-api/${alias}`);
    }
  }

  return Array.from(urls);
}

function isHtmlResponse(contentType: string | null, body: string): boolean {
  const preview = body.trim().slice(0, 200).toLowerCase();
  return Boolean(
    preview.startsWith("<!doctype html") ||
    preview.startsWith("<html") ||
    preview.includes("<title>"),
  );
}

function parseProviderResponse(body: string, contentType: string | null): { ok: boolean; reason?: string; id?: string; status?: string } {
  try {
    const parsed = JSON.parse(body);
    const technicalStatus = String(parsed?.status ?? parsed?.success ?? "").toLowerCase();
    const data = parsed?.data || {};
    const deliveryStatus = String(data?.orderStatus ?? parsed?.delivery_status ?? parsed?.status_message ?? "").toLowerCase();
    const effectiveStatus = deliveryStatus || technicalStatus;
    const message = typeof parsed?.message === "string" ? parsed.message : undefined;
    
    // DataMart uses purchaseId or orderReference
    const orderId = String(data?.purchaseId ?? data?.orderReference ?? parsed?.transaction_id ?? parsed?.order_id ?? parsed?.id ?? parsed?.reference ?? "");

    const ok = technicalStatus === "success" || technicalStatus === "true" || technicalStatus === "1" || parsed?.success === true || parsed?.ok === true;

    if (ok) {
      return { ok: true, id: orderId, status: effectiveStatus };
    }
    
    const isFailed = technicalStatus === "false" || technicalStatus === "error" || technicalStatus === "failed" || technicalStatus === "failure";
    if (isFailed) {
      return { ok: false, reason: message || "Provider rejected this order." };
    }

    const statusCode = Number(parsed?.statusCode);
    if (Number.isFinite(statusCode) && statusCode >= 400) {
      return { ok: false, reason: message || "Provider rejected this order." };
    }
    
    // If it has an ID, it's likely a successful initiation
    if (orderId && orderId !== "undefined" && orderId !== "") return { ok: true, id: orderId, status: effectiveStatus };

  } catch { /* non-JSON */ }

  if (isHtmlResponse(contentType, body)) {
    return { ok: false, reason: "Provider returned an HTML response. Check API URL configuration." };
  }

  return { ok: true };
}

async function callProviderApi(
  provider: any,
  data: Record<string, unknown>,
  endpoint: string = "purchase"
): Promise<{ ok: boolean; reason: string; id?: string; status?: string }> {
  const handlerType = provider.handler_type || "standard";
  const baseUrl = provider.base_url;
  const apiKey = provider.api_key;
  
  const urls = buildProviderUrls(baseUrl, endpoint, handlerType);
  let lastReason = "Provider error";

  for (let url of urls) {
    if (handlerType === "datamart" && endpoint === "status") {
      const ref = String(data.transaction_id || data.reference || "");
      url = `${url}/${ref}`;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Accept": "application/json",
        };

        if (handlerType === "datamart") {
          headers["X-API-Key"] = apiKey;
          // Use the order reference as the idempotency key to prevent double charging on refresh
          const idempotencyKey = String(data.reference || data.order_id || "");
          if (idempotencyKey) {
            headers["X-Idempotency-Key"] = idempotencyKey;
          }
        } else {
          headers["Authorization"] = `Bearer ${apiKey}`;
          headers["X-API-Key"] = apiKey;
          headers["User-Agent"] = "DataHiveGH/1.0";
        }

        const isGet = handlerType === "datamart" && endpoint === "status";

        const res = await fetch(url, {
          method: isGet ? "GET" : "POST",
          headers,
          body: isGet ? undefined : JSON.stringify(data),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = res.headers.get("content-type");
        const text = await res.text();

        if (res.ok) {
          const semantic = parseProviderResponse(text, contentType);
          if (semantic.ok) return { ok: true, reason: "", id: semantic.id, status: semantic.status };
          return { ok: false, reason: semantic.reason || "Provider rejected this order." };
        }

        let parsedMsg = "";
        try { parsedMsg = JSON.parse(text)?.message || ""; } catch { /* ignore */ }
        lastReason = parsedMsg || `Provider returned ${res.status}`;

        if (res.status === 401 || res.status === 403) return { ok: false, reason: lastReason };
        if (res.status === 404 || isHtmlResponse(contentType, text)) break;

        if (res.status >= 500 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }

        break;
      } catch (e: any) {
        lastReason = e?.message || "Network error";
        if (attempt < 2) await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  return { ok: false, reason: lastReason };
}

async function fetchScannerStats(apiKey: string): Promise<any> {
  try {
    const res = await fetch("https://datamart.geonettech.xyz/api/delivery-tracker", {
      headers: { "X-API-Key": apiKey }
    });
    if (res.ok) {
      const data = await res.json();
      return data.data || null;
    }
  } catch (e) {
    console.error("[verify-payment] Failed to fetch scanner stats:", e);
  }
  return null;
}

// --- Main Handler ---

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      headers: corsHeaders,
      status: 200
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[verify-payment] Failed to parse request JSON:", e);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reference = body?.reference;

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UUID validation to prevent database cast errors
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference);
    if (!isUuid) {
       console.error("[verify-payment] Invalid UUID reference:", reference);
       return new Response(JSON.stringify({ error: "Invalid transaction reference format" }), {
         status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
    }

    // 1. Check if already processed
    const { data: existingOrder } = await supabaseAdmin
      .from("orders").select("*").eq("id", reference).maybeSingle();

    if (existingOrder?.status === "fulfilled" || existingOrder?.status === "completed") {
      return new Response(JSON.stringify({ 
        status: "fulfilled", 
        message: "Already processed",
        provider_order_id: existingOrder?.provider_order_id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const credentials = await getProviderCredentials(supabaseAdmin);
    const paystackSecretKey = credentials.paystackSecretKey;
    const orderType = (existingOrder?.order_type || "data") as string;

    // --- 1. STATUS CHECK (For orders already being processed) ---
    // We check status for ALL processing orders, even if provider_order_id is missing,
    // because DataMart allows querying by our internal reference (UUID).
    if (existingOrder?.status === "processing") {
      const providers = await getActiveProviders(supabaseAdmin, orderType === "airtime" ? "airtime" : "data");
      let foundOnProvider = false;
      for (const provider of providers) {
        console.log(`[verify-payment] Checking status for ${reference} at ${provider.name}`);
        const checkResult = await callProviderApi(provider, {
          transaction_id: existingOrder.provider_order_id,
          reference: reference, 
          order_id: reference,
        }, "status");

        if (checkResult.ok) {
          foundOnProvider = true;
          const isDelivered = checkResult.status === "delivered" || checkResult.status === "success" || checkResult.status === "fulfilled" || checkResult.status === "completed" || checkResult.status === "sent";
          if (isDelivered) {
            await supabaseAdmin.from("orders").update({ status: "fulfilled", provider_id: provider.id }).eq("id", reference);
            await supabaseAdmin.rpc("credit_order_profits", { p_order_id: reference });
            return new Response(JSON.stringify({ status: "fulfilled", provider_order_id: existingOrder.provider_order_id }), { headers: corsHeaders });
          }
          
          const isFailed = checkResult.status === "failed" || checkResult.status === "error" || checkResult.status === "refunded";
          if (isFailed) {
            await supabaseAdmin.from("orders").update({ status: "fulfillment_failed", failure_reason: "Provider reported failure during status check" }).eq("id", reference);
            break; 
          } else {
            return new Response(JSON.stringify({ status: "processing", message: "Still processing", provider_order_id: existingOrder.provider_order_id }), { headers: corsHeaders });
          }
        }
      }

      // SELF-HEALING: If we are here, NO provider knows about this order.
      // If it's been processing for > 20s without being found on DataMart, 
      // the first attempt likely failed to REACH the provider.
      const lastUpdate = new Date(existingOrder.updated_at || existingOrder.created_at).getTime();
      const secondsSinceUpdate = (Date.now() - lastUpdate) / 1000;
      
      if (secondsSinceUpdate > 20) {
        console.warn(`[verify-payment] Order ${reference} stuck in processing but not found on provider. Resetting to 'paid' for retry.`);
        await supabaseAdmin.from("orders").update({ status: "paid", failure_reason: "Initial attempt timed out/not found" }).eq("id", reference);
        // Fall through to the verification/fulfillment logic below
      } else {
        return new Response(JSON.stringify({ status: "processing", message: "Connected to delivery gateway" }), { headers: corsHeaders });
      }
    }

    // --- 2. PAYMENT VERIFICATION ---
    let verifiedAmount = 0;
    let paystackFeeOnVerified = 0;
    let currentOrderType = (existingOrder?.order_type || "data") as string;
    let metadata = existingOrder?.metadata || {};

    const isInternalPayment = existingOrder?.payment_method === "wallet" || existingOrder?.status === "paid" || existingOrder?.status === "processing";

    if (isInternalPayment) {
      console.log(`[verify-payment] Internal/Wallet payment confirmed for ${reference}`);
      verifiedAmount = Number(existingOrder?.amount || 0);
    } else {
      const PAYSTACK_SECRET_KEY = getFirstEnv("PAYSTACK_SECRET_KEY") || paystackSecretKey;
      if (!PAYSTACK_SECRET_KEY) {
        return new Response(JSON.stringify({ error: "Payment gateway not configured" }), { status: 500, headers: corsHeaders });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const verifyText = await verifyRes.text();
        let verifyData;
        try {
           verifyData = JSON.parse(verifyText);
        } catch (e) {
           console.error(`[verify-payment] Paystack non-JSON:`, verifyText.slice(0, 100));
           return new Response(JSON.stringify({ status: "error", error: "Payment gateway returned invalid response" }), { headers: corsHeaders });
        }

        if (!verifyData.status || !verifyData.data || verifyData.data.status !== "success") {
          console.warn(`[verify-payment] Payment not confirmed:`, verifyData.message);
          return new Response(JSON.stringify({ status: "not_paid", error: verifyData.message || "Payment not verified" }), { headers: corsHeaders });
        }

        verifiedAmount = verifyData.data.amount / 100;
        paystackFeeOnVerified = parseFloat(Math.min(verifiedAmount * 0.03 / 1.03, 100).toFixed(2)) || 0;
        metadata = verifyData.data.metadata || {};
        if (typeof metadata === "string") try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
        currentOrderType = (metadata?.order_type || currentOrderType) as string;
      } catch (e) {
        clearTimeout(timeoutId);
        console.error(`[verify-payment] Network error during verification:`, e);
        return new Response(JSON.stringify({ status: "error", error: "Failed to connect to payment gateway" }), { headers: corsHeaders });
      }
    }

    // --- 3. ATOMIC FULFILLMENT LOCK ---
    const now = Date.now();
    const oneMinuteAgo = new Date(now - 60000).toISOString();
    
    // Attempt to claim the order for processing
    const { data: claimedOrder, error: claimError } = await supabaseAdmin
      .from("orders")
      .update({ 
        status: "processing", 
        paystack_verified_amount: verifiedAmount,
        paystack_fee: paystackFeeOnVerified,
        updated_at: new Date().toISOString()
      })
      .eq("id", reference)
      .in("status", ["pending", "paid"])
      .select("*")
      .maybeSingle();

    if (claimError) console.error("[verify-payment] Lock error:", claimError);

    if (!claimedOrder) {
      // If we couldn't claim it, it might be already fulfilling or already finished.
      // Refresh state from DB to return the current status
      const { data: refreshed } = await supabaseAdmin.from("orders").select("*").eq("id", reference).maybeSingle();
      return new Response(JSON.stringify({ 
        status: refreshed?.status || "processing",
        message: "Order is being handled",
        provider_order_id: refreshed?.provider_order_id
      }), { headers: corsHeaders });
    }

    // --- 4. FULFILLMENT ---
    if (currentOrderType === "wallet_topup") {
      const agentId = claimedOrder.agent_id || metadata?.agent_id;
      if (agentId) {
        await supabaseAdmin.rpc("credit_wallet", { p_agent_id: agentId, p_amount: verifiedAmount });
        await supabaseAdmin.from("orders").update({ status: "fulfilled" }).eq("id", reference);
      }
      return new Response(JSON.stringify({ status: "fulfilled" }), { headers: corsHeaders });
    }

    // Standard Data/Airtime Fulfillment
    const activeProviders = await getActiveProviders(supabaseAdmin, currentOrderType === "airtime" ? "airtime" : "data");
    const network = claimedOrder.network || metadata?.network || "";
    const customerPhone = claimedOrder.customer_phone || metadata?.customer_phone || "";
    const packageSize = claimedOrder.package_size || metadata?.package_size || "";
    const recipient = normalizeRecipient(customerPhone);

    const requestBody = {
      networkKey: mapDataNetworkKey(network),
      recipient,
      capacity: parseCapacity(packageSize),
      amount: claimedOrder.amount,
      order_type: currentOrderType,
    };

    let result: any = { ok: false, reason: "No providers" };
    let successfulProviderId = null;

    for (const provider of activeProviders) {
      const handlerType = provider.handler_type || "standard";
      const networkKey = handlerType === "datamart" 
        ? (network.toUpperCase() === "MTN" ? "YELLO" : (network.toUpperCase() === "TELECEL" ? "TELECEL" : "AT_PREMIUM"))
        : mapDataNetworkKey(network);

      const dataPayload = handlerType === "datamart"
        ? { 
            phoneNumber: recipient, 
            network: networkKey, 
            planId: packageSize, // DataMart specific
            capacity: String(parseCapacity(packageSize)), 
            orderReference: reference, // CRITICAL: This is the deduplication key for DataMart
            gateway: "wallet", 
            reference: reference 
          }
        : requestBody;

      result = await callProviderApi(provider, dataPayload, "purchase");
      if (result.ok) {
        successfulProviderId = provider.id;
        break;
      } else {
        await logProviderError(supabaseAdmin, provider.id, reference, result.reason);
      }
    }

    if (result.ok) {
      const isDelivered = true; // Fast-track: Mark as fulfilled immediately if DataMart accepts the order
      const patch: any = { provider_id: successfulProviderId, provider_order_id: result.id, status: "fulfilled" };
      
      await supabaseAdmin.from("orders").update(patch).eq("id", reference);
      if (isDelivered) await supabaseAdmin.rpc("credit_order_profits", { p_order_id: reference });
      
      return new Response(JSON.stringify({ status: patch.status || "processing", provider_order_id: result.id }), { headers: corsHeaders });
    } else {
      await supabaseAdmin.from("orders").update({ status: "fulfillment_failed", failure_reason: result.reason }).eq("id", reference);
      return new Response(JSON.stringify({ status: "failed", reason: result.reason }), { headers: corsHeaders });
    }
  } catch (error: any) {
    console.error("[verify-payment] Error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
