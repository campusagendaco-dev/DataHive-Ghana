import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizePhone, sendPaymentSms } from "../_shared/sms.ts";
import { getActiveProviders, logProviderError } from "../_shared/providers.ts";

declare const Deno: any;

function getFirstEnvValue(keys: string[]): string {
  for (const key of keys) {
    const value = (Deno as any).env.get(key)?.trim();
    if (value) return value;
  }
  return "";
}


function buildProviderUrls(baseUrl: string, aliases: string[]): string[] {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (!clean) return [];
  const urls = new Set<string>();

  let rootUrl = "";
  try { const parsed = new URL(clean); rootUrl = parsed.origin; } catch { rootUrl = ""; }

  // If baseUrl already ends with one of the alias paths, add it as-is first.
  for (const alias of aliases) {
    if (clean.endsWith(`/${alias}`) || clean.endsWith(`/api/${alias}`)) {
      urls.add(clean);
    }
  }

  const supabaseUrl = (Deno as any).env.get("SUPABASE_URL") || "";
  let projectUrl = "";
  try {
    if (supabaseUrl) projectUrl = new URL(supabaseUrl).origin;
  } catch { /* ignore */ }

  // Build candidate URLs from the base.
  for (const alias of aliases) {
    if (clean.endsWith("/api")) {
      urls.add(`${clean}/${alias}`);
    } else {
      urls.add(`${clean}/api/${alias}`);
      urls.add(`${clean}/${alias}`);
    }
    if (rootUrl) {
      urls.add(`${rootUrl}/api/${alias}`);
      urls.add(`${rootUrl}/${alias}`);
      urls.add(`${rootUrl}/functions/v1/developer-api/${alias}`);
    }
    if (projectUrl) {
      urls.add(`${projectUrl}/functions/v1/developer-api/${alias}`);
    }
  }
  return Array.from(urls);
}

function isHtmlResponse(contentType: string | null, body: string): boolean {
  const preview = body.trim().slice(0, 200).toLowerCase();
  return Boolean(preview.startsWith("<!doctype html") || preview.startsWith("<html") || preview.includes("<title>"));
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getProviderFailureReason(status: number, body: string, contentType: string | null): string {
  if (status === 404) return "Provider endpoint not found. Check API URL configuration.";
  if (isHtmlResponse(contentType, body)) return "Provider returned an HTML error page instead of a response.";
  try {
    const p = JSON.parse(body);
    return p.message || p.error || "Provider rejected the request.";
  } catch {
    const cleaned = stripHtml(body);
    return cleaned.length > 150 ? cleaned.slice(0, 147) + "..." : cleaned || "Unknown provider error";
  }
}

function mapNetworkKey(network: string): string {
  const n = network.trim().toUpperCase();
  if (n === "MTN" || n === "YELLO") return "MTN";
  if (n === "VOD" || n === "VODAFONE" || n === "TELECEL") return "VOD";
  if (n === "AT" || n === "AIRTELTIGO" || n === "AIRTEL TIGO") return "AT";
  if (n === "GLO") return "GLO";
  return n;
}

function normalizeRecipient(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  if (digits.startsWith("233") && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.length === 9) return `0${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return digits;
  return phone.trim();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      headers: corsHeaders,
      status: 200
    });
  }

  const SUPABASE_URL = (Deno as any).env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = (Deno as any).env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SUPABASE_ANON_KEY = (Deno as any).env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = await req.json().catch(() => null);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  try {
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Check if user is an API User
    const { data: profile } = await supabaseAdmin.from("profiles").select("api_access_enabled").eq("user_id", user.id).maybeSingle();
    const isApiUser = profile?.api_access_enabled || false;

    const { network, phone, amount } = payload || {};
    const clientReference = typeof payload?.reference === "string" ? payload.reference.trim() : "";

    if (!network || !phone || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "Missing required fields: network, phone, amount" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (clientReference) {
      const { data: existing } = await supabaseAdmin
        .from("orders")
        .select("id, status, failure_reason")
        .eq("id", clientReference)
        .eq("agent_id", user.id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ 
          success: true, 
          order_id: existing.id, 
          status: existing.status,
          failure_reason: existing.failure_reason,
          reused: true 
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // --- IDEMPOTENCY CHECK ---
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: duplicateOrder } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("agent_id", user.id)
      .eq("customer_phone", normalizePhone(phone))
      .eq("order_type", "airtime")
      .eq("amount", amount)
      .gte("created_at", oneMinuteAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (duplicateOrder && (duplicateOrder.status === "paid" || duplicateOrder.status === "processing" || duplicateOrder.status === "fulfilled")) {
       console.log(`[airtime] Reusing duplicate order: ${duplicateOrder.id}`);
       return new Response(JSON.stringify({ 
         success: true, 
         order_id: duplicateOrder.id, 
         status: duplicateOrder.status,
         reused: true 
       }), { headers: corsHeaders });
    }

    const { data: debitResult, error: debitError } = await supabaseAdmin.rpc("debit_wallet", {
      p_agent_id: user.id,
      p_amount: amount,
    });

    if (debitError || !debitResult?.success) {
      return new Response(JSON.stringify({ error: debitResult?.error || "Insufficient balance" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const orderId = clientReference || crypto.randomUUID();
    await supabaseAdmin.from("orders").insert({
      id: orderId,
      agent_id: user.id,
      order_type: "airtime",
      network,
      customer_phone: normalizePhone(phone),
      amount,
      status: "paid",
    });

    const activeProviders = await getActiveProviders(supabaseAdmin, "airtime");
    
    if (activeProviders.length === 0) {
      await supabaseAdmin.from("orders").update({ 
        status: "fulfillment_failed", 
        failure_reason: "No active airtime providers configured" 
      }).eq("id", orderId);
      return new Response(JSON.stringify({ error: "No active airtime providers configured" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const AIRTIME_ALIASES = ["purchase", "order", "airtime", "buy", "topup", "recharge"];
    const recipient = normalizeRecipient(phone);
    const networkKey = mapNetworkKey(network);
    
    const airtimePayload = {
      customerNumber: recipient,
      phoneNumber: recipient, // DataMart support
      amount: amount,
      networkCode: networkKey,
      orderReference: orderId, // CRITICAL: Deduplication key
      reference: orderId,
      description: `Airtime topup: GHS ${amount} for ${recipient}`
    };

    let result: any = { ok: false, reason: "No providers tried" };
    let successfulProviderId: string | null = null;
    let lastBody = "";

    try {
      for (const provider of activeProviders) {
        console.log(`[airtime] Trying provider: ${provider.name}`);
        const providerUrls = buildProviderUrls(provider.base_url, AIRTIME_ALIASES);
        
        for (const url of providerUrls) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);
            const res = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-API-Key": provider.api_key,
                "Authorization": `Bearer ${provider.api_key}`,
              },
              body: JSON.stringify(airtimePayload),
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const contentType = res.headers.get("content-type");
            const resText = await res.text();
            lastBody = resText;

            if (res.ok && !isHtmlResponse(contentType, resText)) {
              try {
                const parsed = JSON.parse(resText);
                const s = String(parsed?.status ?? "").toLowerCase();
                const success = parsed?.success === true || parsed?.status === "success" || parsed?.status === true;
                
                if (success) {
                  result = { ok: true, id: parsed?.transaction_id || parsed?.order_id || parsed?.reference };
                  break;
                } else if (s === "false" || s === "error" || s === "failed" || s === "failure") {
                  result = { ok: false, reason: parsed?.message || parsed?.reason || "Provider rejected the request" };
                }
              } catch {
                result = { ok: true };
                break;
              }
            } else {
              result = { ok: false, reason: getProviderFailureReason(res.status, resText, contentType) };
            }
          } catch (err: any) {
            result = { ok: false, reason: err.message };
          }
          if (result.ok) break;
        }

        if (result.ok) {
          successfulProviderId = provider.id;
          break;
        } else {
          console.error(`[airtime] Provider ${provider.name} failed: ${result.reason}`);
          await logProviderError(supabaseAdmin, provider.id, orderId, result.reason);
        }
      }

      if (result.ok) {
        await supabaseAdmin.from("orders").update({ 
          status: "fulfilled",
          provider_id: successfulProviderId,
          provider_order_id: result.id
        }).eq("id", orderId);
        
        await sendPaymentSms(supabaseAdmin, phone, "payment_success", {
          service: `${network} Airtime`,
          recipient: phone,
          order_id: orderId.slice(0, 8).toUpperCase()
        });
        
        return new Response(JSON.stringify({ success: true, order_id: orderId, status: "fulfilled" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        throw new Error(result.reason || "All providers failed");
      }
    } catch (err: any) {
      console.error(`[airtime] Fulfillment failed: ${err.message}`);
      
      await supabaseAdmin.from("orders").update({ 
        status: "fulfillment_failed", 
        failure_reason: err.message
      }).eq("id", orderId);
      
      if (!isApiUser) {
        await supabaseAdmin.rpc("credit_wallet", { p_agent_id: user.id, p_amount: amount });
        
        return new Response(JSON.stringify({ 
          error: `Fulfillment failed: ${err.message}. Refunded.`,
          diagnostics: {
            provider_error: err.message,
            provider_response: lastBody.length > 200 ? lastBody.slice(0, 197) + "..." : lastBody,
          }
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        console.log(`[airtime] API User order ${orderId} failed but NO refund issued (will retry).`);
        return new Response(JSON.stringify({ 
          success: true,
          status: "processing",
          message: `Fulfillment failed: ${err.message}. Order will be retried.`,
          order_id: orderId
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
  } catch (error: any) {
    console.error(`[airtime] Global Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
