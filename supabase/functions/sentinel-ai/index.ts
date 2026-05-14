import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { log } from "../_shared/logger.ts";

declare const Deno: any;

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 0. Budget Check (Budget Guardian)
    const { data: settings } = await supabaseAdmin.from("system_settings").select("*").eq("id", 1).maybeSingle();

    // 1. Fetch recent error logs (last 30 mins)
    const { data: recentErrors, error: logError } = await supabaseAdmin
      .from("system_logs")
      .select("*")
      .eq("level", "error")
      .gt("ts", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order("ts", { ascending: false })
      .limit(20);

    if (logError) throw logError;

    const errors = recentErrors || [];

    if (settings?.sentinel_low_power_mode && errors.length < 5) {
      return new Response(JSON.stringify({ message: "Budget Guardian: Low Power Mode active. Skipping routine scan." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (settings && settings.sentinel_current_month_cost_usd >= settings.sentinel_monthly_budget_usd) {
      return new Response(JSON.stringify({ message: "Budget Guardian: Monthly limit reached. Sentinel standing down." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1.5. Fetch stuck orders (processing for > 10 mins)
    const { data: stuckOrders } = await supabaseAdmin
      .from("orders")
      .select("*, profiles(full_name, phone)")
      .eq("status", "processing")
      .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(5);

    // 1.6. Fetch Potential Security Threats (Failed Logins / Rapid Actions)
    const { data: threats } = await supabaseAdmin
      .from("system_logs")
      .select("*")
      .in("event", ["login_failure", "suspicious_activity", "unauthorized_access"])
      .gt("ts", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(10);

    // 1.7. Fetch "Churning" Agents (No orders in 7 days)
    const { data: churningAgents } = await supabaseAdmin
      .from("agent_loyalty_metrics")
      .select("*, profiles(full_name, phone)")
      .gt("days_since_last_order", 7)
      .limit(5);

    // 2. Fetch current system state
    const { data: providers } = await supabaseAdmin.from("providers").select("*");

    const tokenCostPerScan = 0.0001; // Average cost for Gemini 1.5 Flash per scan
    const { data: strategies } = await supabaseAdmin.from("sentinel_strategies").select("*").eq("is_active", true);

    // 3. Construct AI Prompt
    const prompt = `
      You are THE SENTINEL, the autonomous self-healing core of the SwiftData Fintech Platform.
      Your goal is to monitor system logs, diagnose root causes of failures, and execute healing actions.

      SYSTEM STATUS:
      - Current Settings: ${JSON.stringify(settings)}
      - Providers: ${JSON.stringify(providers?.map((p: any) => ({ id: p.id, name: p.name, is_active: p.is_active, handler: p.handler_type })))}
      - Active Strategies: ${JSON.stringify(strategies?.map((s: any) => s.condition_prompt))}

      RECENT ERRORS:
      ${JSON.stringify(errors.map((e: any) => ({ ts: e.ts, source: e.source, event: e.event, message: e.message, data: e.data })))}

      STUCK ORDERS (ACTIVE WORKER TASKS):
      ${JSON.stringify(stuckOrders?.map((o: any) => ({ id: o.id, amount: o.amount, customer: o.profiles?.full_name, phone: o.profiles?.phone })))}

      SECURITY THREATS:
      ${JSON.stringify(threats?.map((t: any) => ({ ts: t.ts, event: t.event, message: t.message, ip: t.data?.ip })))}

      CHURNING AGENTS (GROWTH TASKS):
      ${JSON.stringify(churningAgents?.map((a: any) => ({ id: a.user_id, name: a.profiles?.full_name, days_inactive: a.days_since_last_order })))}

      DIAGNOSTIC GUIDELINES:
      - If multiple errors come from one provider (e.g. 403, 500), consider switching to a secondary provider or "masking" the service (set provider to inactive).
      - If multiple "login_failure" events come from the same IP, trigger "block_ip".
      - If a user has a "wallet_mismatch", trigger "notify_admin" with high severity.
      - If an order has failed 3+ times, trigger "auto_refund".
      - If orders are STUCK, trigger "customer_outreach".
      - If an agent is CHURNING (inactive > 7 days), trigger "marketing_outreach" (generate a 5% discount code and message them).
      - If there are no errors and no stuck orders, return action "none".

      OUTPUT FORMAT:
      You must return ONLY a JSON object in this format:
      {
        "diagnosis": "Brief explanation of root cause",
        "action": "switch_provider" | "notify_admin" | "adjust_settings" | "retry_order" | "customer_outreach" | "auto_refund" | "mask_service" | "block_ip" | "marketing_outreach" | "none",
        "parameters": {
          "provider_id": "UUID if switching/masking",
          "message": "Message for admin/customer",
          "order_id": "UUID if outreach/refund",
          "ip_address": "IP to block",
          "target_user_id": "UUID for marketing",
          "severity": "low" | "medium" | "high" | "critical"
        },
        "reasoning": "Detailed technical justification"
      }
    `;

    // 4. Call Gemini
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`Gemini API error: ${aiResponse.status} — ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Gemini");
    const decision = JSON.parse(rawText);

    // 5. Execute Action
    let executionResult = null;
    if (decision.action !== "none") {
      // Log the intent
      const { data: actionLog } = await supabaseAdmin
        .from("sentinel_actions")
        .insert({
          action_type: decision.action,
          reasoning: decision.reasoning,
          status: 'pending',
          metadata: decision.parameters
        })
        .select()
        .single();

      try {
        if (decision.action === "switch_provider" && decision.parameters?.provider_id) {
          await supabaseAdmin.from("providers").update({ is_active: false }).eq("id", errors[0]?.data?.provider_id).not("id", "is", null);
          await supabaseAdmin.from("providers").update({ is_active: true }).eq("id", decision.parameters.provider_id);
          executionResult = "Provider switched successfully";
        } else if (decision.action === "notify_admin") {
          executionResult = "Admin notification queued";
        } else if (decision.action === "auto_refund") {
          const { order_id } = decision.parameters;
          const { error: refundErr } = await supabaseAdmin.rpc("admin_refund_order", {
            target_order_id: order_id,
            refund_reason: "Sentinel Auto-Refund: Unrecoverable provider failure."
          });
          if (refundErr) throw refundErr;
          executionResult = "Refund executed";
        } else if (decision.action === "mask_service") {
          const { provider_id } = decision.parameters;
          const { error: maskErr } = await supabaseAdmin
            .from("providers")
            .update({ is_active: false })
            .eq("id", provider_id);
          if (maskErr) throw maskErr;
          executionResult = "Service masked";
        } else if (decision.action === "block_ip") {
          const { ip_address, message } = decision.parameters;
          const { error: blockErr } = await supabaseAdmin
            .from("blocked_ips")
            .insert({
              ip_address,
              reason: message || "Sentinel: Detected high-volume malicious activity.",
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
          if (blockErr) throw blockErr;

          await supabaseAdmin.from("sentinel_security_audits").insert({
            severity: "high",
            event_type: "ip_blocked",
            description: `Automatically blocked IP ${ip_address} due to ${decision.diagnosis}`,
            attacker_info: { ip: ip_address },
            action_taken: "block_ip"
          });
          executionResult = "IP Blocked and Audit Created";
        } else if (decision.action === "marketing_outreach") {
          const { target_user_id } = decision.parameters;
          const promoCode = "MISSYOU-" + Math.random().toString(36).substring(7).toUpperCase();

          await supabaseAdmin.from("sentinel_marketing_promos").insert({
            code: promoCode,
            discount_percent: 5,
            target_user_id,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
          executionResult = `Generated promo code ${promoCode} for user ${target_user_id} and queued marketing message.`;
        }

        if (actionLog?.id) {
          await supabaseAdmin
            .from("sentinel_actions")
            .update({ status: 'executed', result: { message: executionResult } })
            .eq("id", actionLog.id);
        }
      } catch (execError: unknown) {
        if (actionLog?.id) {
          await supabaseAdmin
            .from("sentinel_actions")
            .update({ status: 'failed', result: { error: (execError as any)?.message || String(execError) } })
            .eq("id", actionLog.id);
        }
      }
    }

    log(supabaseAdmin, {
      level: "info",
      source: "sentinel-ai",
      event: "sentinel.processed",
      message: `Sentinel processed ${errors.length} errors. Decision: ${decision.action}`,
      data: { decision, executionResult }
    });

    // 6. Update Budget Guardian Stats
    await supabaseAdmin.rpc("increment_sentinel_cost", { amount: tokenCostPerScan });

    return new Response(JSON.stringify({
      success: true,
      decision,
      executionResult,
      budget: {
        current: (settings?.sentinel_current_month_cost_usd || 0) + tokenCostPerScan,
        limit: settings?.sentinel_monthly_budget_usd || 10
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Sentinel Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
