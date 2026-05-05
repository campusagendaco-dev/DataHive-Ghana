import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizePhone, sendSmsViaTxtConnect, getSmsConfig } from "../_shared/sms.ts";
import { getActiveProviders, logProviderError } from "../_shared/providers.ts";

declare const Deno: any;

function getEnv(...keys: string[]): string {
  for (const k of keys) { const v = (Deno as any).env.get(k)?.trim(); if (v) return v; }
  return "";
}

function mapNetworkKey(network: string): string {
  const n = network.trim().toUpperCase();
  if (n === "MTN" || n === "YELLO") return "YELLO";
  if (n === "VOD" || n === "VODAFONE" || n === "TELECEL") return "TELECEL";
  if (n === "AT" || n === "AIRTELTIGO" || n === "AIRTEL TIGO") return "AT_PREMIUM";
  if (n === "GLO") return "GLO";
  return n;
}

function parseCapacity(pkg: string): number {
  const m = pkg.replace(/\s+/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function normalizeRecipient(phone: string): string {
  const d = phone.replace(/\D+/g, "");
  if (d.startsWith("233") && d.length === 12) return `0${d.slice(3)}`;
  if (d.length === 9) return `0${d}`;
  if (d.length === 10 && d.startsWith("0")) return d;
  return phone.trim();
}

function isHtmlBody(ct: string | null, body: string): boolean {
  const p = body.trim().slice(0, 200).toLowerCase();
  return Boolean(ct?.includes("text/html") || p.startsWith("<!doctype") || p.startsWith("<html"));
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
    aliases = endpoint === "purchase" ? ["purchase", "order", "airtime", "buy", "topup", "recharge"] : (endpoint === "status" ? ["status", "query", "check"] : [endpoint]);
  }
  for (const alias of aliases) {
    urls.add(`${clean}/api/${alias}`);
    urls.add(`${clean}/${alias}`);
  }
  try {
    const root = new URL(clean).origin;
    for (const alias of aliases) {
      urls.add(`${root}/api/${alias}`);
      urls.add(`${root}/${alias}`);
    }
  } catch { /* ignore */ }
  return Array.from(urls);
}

async function callProviderApi(
  provider: any,
  data: Record<string, unknown>,
  endpoint: string = "purchase"
): Promise<{ ok: boolean; reason: string; id?: string; body?: string }> {
  const handlerType = provider.handler_type || "standard";
  const urls = buildProviderUrls(provider.base_url, endpoint, handlerType);
  let lastBody = "";
  let lastReason = "Provider error";

  for (const url of urls) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 25000);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", "Accept": "application/json" };
      headers["X-API-Key"] = provider.api_key;
      if (handlerType !== "datamart") headers["Authorization"] = `Bearer ${provider.api_key}`;
      headers["X-Idempotency-Key"] = String(data.orderReference || data.reference || "");
      headers["User-Agent"] = "SwiftDataGH/2.0";

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      const ct = res.headers.get("content-type");
      const text = await res.text();
      lastBody = text;

      if (res.ok && !isHtmlBody(ct, text)) {
        try {
          const p = JSON.parse(text);
          const s = String(p?.status ?? p?.success ?? "").toLowerCase();
          const ok = p?.success === true || s === "success" || s === "true" || p?.status === true;
          if (ok) return { ok: true, reason: "", id: String(p?.data?.purchaseId ?? p?.transaction_id ?? p?.id ?? "") };
          lastReason = p?.message || p?.error || "Provider rejected the order";
        } catch { return { ok: true, reason: "" }; }
      } else {
        lastReason = `HTTP ${res.status}`;
      }
      if (res.status === 404 || isHtmlBody(ct, text)) continue;
      break;
    } catch (e: any) {
      clearTimeout(tid);
      lastReason = e?.message || "Network error";
    }
  }
  return { ok: false, reason: lastReason, body: lastBody };
}

// Timing-safe string comparison
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// SHA-256 hex digest
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// HMAC-SHA256 hex digest
async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v: string): boolean { return UUID_RE.test(v); }

const API_KEY_RE = /^swft_live_[0-9a-f]{32}$/;

// Block private/loopback/link-local destinations to prevent webhook SSRF
const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fc|fd)/i;
function isSafeWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (PRIVATE_IP_RE.test(parsed.hostname)) return false;
    if (parsed.hostname === "localhost") return false;
    return true;
  } catch { return false; }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = (Deno as any).env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = (Deno as any).env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
    return json({ success: false, error: "Server misconfigured" }, 500);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  let currentUserId: string | null = null;
  const endpoint = new URL(req.url).pathname;

  try {
    // ── 1. Extract and Validate API key ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const rawApiKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    
    if (!rawApiKey) {
      return json({ success: false, error: "Missing or malformed Authorization header. Use 'Authorization: Bearer <your_key>'." }, 401);
    }

    // ── 2. Authenticate Client ──────────────────────────────────────────────────
    const isMasterKey = safeEqual(rawApiKey, SUPABASE_SERVICE_ROLE_KEY);
    let profile: any = null;

    if (isMasterKey) {
      const urlObj = new URL(req.url);
      const targetUserId = urlObj.searchParams.get("sudo_user_id");
      if (!targetUserId) return json({ success: false, error: "Master Key requires 'sudo_user_id' parameter." }, 400);
      
      const { data: sudoProfile } = await supabase.from("profiles").select("*").eq("user_id", targetUserId).maybeSingle();
      if (!sudoProfile) return json({ success: false, error: "Sudo profile not found." }, 404);
      profile = sudoProfile;
      currentUserId = sudoProfile.user_id;
    } else {
      if (!API_KEY_RE.test(rawApiKey)) return json({ success: false, error: "Invalid API key format." }, 401);
      
      const prefix = rawApiKey.slice(0, 12);
      const incomingHash = await sha256Hex(rawApiKey);
      console.log(`[AUTH] Key Prefix: ${prefix} | Hash: ${incomingHash}`);
      
      // Use secure RPC for authentication (bypasses RLS safely)
      const { data: profileData, error: authError } = await supabase.rpc("authenticate_client", {
        p_prefix: prefix,
        p_hash: incomingHash
      });
      
      if (authError || !profileData || profileData.length === 0) {
        if (authError) console.error(`[AUTH ERROR]`, authError);
        return json({ success: false, error: "Authentication failed: Profile not found or API key invalid." }, 401);
      }
      
      profile = profileData[0];
      currentUserId = profile.user_id;
      
      // Map secret key for HMAC
      profile.secret_key_hash = profile.api_secret_key_hash || profile.secret_key_hash;
      
      // ── 3. HMAC Signature Verification (Optional, SKIPPED IN TEST MODE) ───────
      const signature = req.headers.get("X-Swift-Signature");
      const isTestMode = profile.test_mode;
      
      if (req.method === "POST" && signature && profile.secret_key_hash && !isTestMode) {
        const bodyText = await req.clone().text();
        const computedSig = await hmacSha256Hex(profile.secret_key_hash, bodyText);
        
        if (!safeEqual(computedSig, signature)) {
          return json({ success: false, error: "Invalid signature. Request body may have been tampered with." }, 401);
        }
      }
    }

    // ── 4. Access and IP Checks ─────────────────────────────────────────────────
    if (!profile.access_enabled) return json({ success: false, error: "API access is disabled." }, 403);
    
    const whitelist: string[] = Array.isArray(profile.ip_whitelist) ? profile.ip_whitelist : [];
    if (whitelist.length > 0 && !isMasterKey) {
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "";
      if (!whitelist.some((ip) => ip.trim() === clientIp)) {
        return json({ success: false, error: `IP ${clientIp} not whitelisted.` }, 403);
      }
    }

    // ── 5. Idempotency Check (Optional for client, mandatory for DB) ────────────
    const idemKey = req.headers.get("X-Idempotency-Key") || crypto.randomUUID();

    // ── 6. Rate Limiting ────────────────────────────────────────────────────────
    const rateLimit = profile.rate_limit || 30;
    const { data: withinLimit } = await supabase.rpc("check_and_increment_rate_limit", {
      p_user_id: currentUserId,
      p_rate_limit: rateLimit,
    });
    if (!withinLimit) return json({ success: false, error: "Rate limit exceeded." }, 429);

    // ── 7. Action Mapping ───────────────────────────────────────────────────────
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    const action = url.searchParams.get("action") || "";
    let finalAction = action;
    const p = path.toLowerCase();
    
    if (p.endsWith("/balance")) finalAction = "balance";
    else if (p.endsWith("/account")) finalAction = "account";
    else if (p.endsWith("/plans")) finalAction = "plans";
    else if (p.endsWith("/buy")) finalAction = "buy";
    else if (p.endsWith("/sms")) finalAction = "sms";
    else if (p.endsWith("/orders")) finalAction = "orders";
    else if (p.endsWith("/status")) finalAction = "status";
    else if (p === "" || p === "/" || p.endsWith("/developer-api")) finalAction = action || "index";

    const allowedActions: string[] = profile.allowed_actions || ["balance", "plans", "account", "orders", "status"];
    if (!allowedActions.includes(finalAction) && !["index", "account", "balance", "plans", "orders", "status"].includes(finalAction)) {
      return json({ success: false, error: `Action '${finalAction}' not permitted.` }, 403);
    }

    // ── 8. Execute Logic via RPCs ──────────────────────────────────────────────
    
    if (finalAction === "balance") {
      const { data: wallet } = await supabase.from("api.v_wallets").select("balance").eq("agent_id", currentUserId).maybeSingle();
      return json({ success: true, balance: Number(wallet?.balance ?? 0), currency: "GHS" });
    }

    if (finalAction === "account") {
      return json({
        success: true,
        name: profile.full_name,
        active: profile.access_enabled
      });
    }

    if (finalAction === "plans") {
      const { data: plans } = await supabase.from("api.v_plans").select("*").eq("is_unavailable", false).order("network").order("package_size");
      return json({ success: true, plans: plans ?? [] });
    }

    if (finalAction === "buy" && req.method === "POST") {
      const payload = await req.json().catch(() => null);
      if (!payload) return json({ success: false, error: "Invalid JSON body" }, 400);

      const { network, phone, amount, package_size, request_id } = payload;
      if (!network || !phone || (!amount && !package_size))
        return json({ success: false, error: "Missing required fields." }, 400);

      // CALL SECURE RPC
      const { data: result, error: rpcError } = await supabase.rpc("api.create_order_rpc", {
        p_user_id: currentUserId,
        p_network: network,
        p_package_size: package_size || "AIRTIME",
        p_phone: normalizeRecipient(phone),
        p_amount: amount || 0,
        p_request_id: request_id || idemKey,
        p_idem_key: idemKey,
        p_test_mode: profile.test_mode
      });

      if (rpcError) throw rpcError;
      if (!result.success) return json(result, 400);

      const orderId = result.order_id;
      
      // ── 9. Fulfillment Logic (SKIP IF TEST MODE) ──────────────────────────
      if (profile.test_mode) {
        console.log(`[TEST MODE] Skipping real fulfillment for order ${orderId}`);
        return json(result);
      }

      // REAL FULFILLMENT START
      const providers = await getActiveProviders(supabase, package_size ? "data" : "airtime");
      let finalResult = { ok: false, reason: "No active providers", body: "" };
      let successfulProviderId = null;

      if (providers.length > 0) {
        for (const provider of providers) {
          const dataPayload = {
            networkRaw: network,
            recipient: normalizeRecipient(phone),
            capacity: amount || parseCapacity(package_size),
            plan: package_size,
            amount: amount,
            orderReference: orderId,
            webhook_url: profile.webhook_url
          };

          const res = await callProviderApi(provider, dataPayload, "purchase");
          if (res.ok) {
            finalResult = res;
            successfulProviderId = provider.id;
            break;
          } else {
            await logProviderError(supabase, provider.id, orderId, res.reason);
            finalResult = res;
          }
        }
      }

      if (finalResult.ok) {
        await supabase.from("orders").update({ 
          status: "fulfilled", 
          provider_id: successfulProviderId,
          provider_order_id: finalResult.id
        }).eq("id", orderId);
      } else {
        await supabase.from("orders").update({ 
          status: "failed",
          failure_reason: finalResult.reason
        }).eq("id", orderId);
      }
      // BACKGROUND FULFILLMENT END

      return json(result);
    }

    if (finalAction === "orders") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
      const { data: orders } = await supabase.from("api.v_orders").select("*").eq("agent_id", currentUserId).order("created_at", { ascending: false }).limit(limit);
      return json({ success: true, orders: orders ?? [] });
    }

    if (finalAction === "status") {
      const orderId = url.searchParams.get("order_id") || url.searchParams.get("id");
      if (!orderId) return json({ success: false, error: "Missing order_id" }, 400);
      
      const { data: order, error } = await supabase.from("api.v_orders").select("*").eq("agent_id", currentUserId).eq("id", orderId).maybeSingle();
      if (error || !order) return json({ success: false, error: "Order not found" }, 404);
      
      return json({ success: true, order });
    }

    if (finalAction === "index") {
      return json({ success: true, message: "SwiftData API v2.0", docs: "https://swiftdatagh.shop/api-docs" });

    }

    return json({ success: false, error: "Endpoint not found." }, 404);

  } catch (err: any) {
    // ── 9. Zero-Knowledge Error Handling ────────────────────────────────────────
    const logRef = await supabase.rpc("api.log_internal_error", {
      p_user_id: currentUserId,
      p_endpoint: endpoint,
      p_method: req.method,
      p_payload: req.method === "POST" ? await req.clone().json().catch(() => ({})) : {},
      p_error: err.message || String(err),
      p_stack: err.stack || ""
    });

    return json({ 
      success: false, 
      error: "Internal Server Error", 
      reference: logRef.data || "ERR-UNKNOWN" 
    }, 500);
  }
});
