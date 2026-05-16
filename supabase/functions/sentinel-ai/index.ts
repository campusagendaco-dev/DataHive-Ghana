import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getSmsConfig, sendSmsViaTxtConnect } from "../_shared/sms.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const body = await req.json().catch(() => ({}));
    const { event, order_id, log_id } = body;

    console.log(`Sentinel Prime: Initiating ${event ? 'Surgical Strike' : 'Autonomous Scan'}...`);

    // 1. Fetch System Pulse
    let agentsToAnalyze = [];
    let ordersToAnalyze = [];

    if (event === 'order_failure' && order_id) {
      // Surgical Strike: Focus on this specific failure
      const { data: failedOrder } = await supabaseAdmin.from("orders").select("*").eq("id", order_id).single();
      if (failedOrder) {
        const { data: agent } = await supabaseAdmin.from("profiles").select("id, full_name, phone, wallet_balance, loyalty_points").eq("id", failedOrder.agent_id).single();
        if (agent) agentsToAnalyze = [agent];
        ordersToAnalyze = [failedOrder];
      }
    } else {
      // General Scan
      const { data: agents } = await supabaseAdmin.from("profiles").select("id, full_name, phone, wallet_balance, loyalty_points").eq("is_agent", true).limit(50);
      const { data: recentOrders } = await supabaseAdmin.from("orders").select("*").gt("created_at", new Date(Date.now() - 3600000).toISOString());
      agentsToAnalyze = agents || [];
      ordersToAnalyze = recentOrders || [];
    }
    const { data: settings } = await supabaseAdmin.from("system_settings").select("*").single();
    const { data: providers } = await supabaseAdmin.from("providers").select("*").order("priority", { ascending: true });
    
    // Fetch Admin Contact
    const { data: admins } = await supabaseAdmin
      .from("profiles")
      .select("phone, email")
      .eq("role" as any, "admin" as any)
      .limit(1);
    
    const adminContact = admins?.[0];

    // 2. Risk & Behavior Processing (Sentinel Prime Core)
    const agentStats = agentsToAnalyze?.map(agent => {
      const orders = ordersToAnalyze?.filter(o => o.agent_id === agent.id) || [];
      const failures = orders.filter(o => o.status === 'failed').length;
      
      // Heuristic Risk Score
      let riskScore = 0;
      if (orders.length > 20) riskScore += 40;
      if (failures > 5) riskScore += 30;
      if (orders.length > 0 && (failures / orders.length) > 0.5) riskScore += 30;

      return {
        id: agent.id,
        name: agent.full_name,
        phone: agent.phone,
        balance: agent.wallet_balance,
        loyalty: agent.loyalty_points,
        velocity: orders.length,
        failure_rate: orders.length > 0 ? (failures / orders.length).toFixed(2) : 0,
        risk_score: riskScore
      };
    });

    // 3. Provider Health Check (Liquidity Balancing)
    const providerHealth = providers?.map(p => ({
      id: p.id,
      name: p.name,
      balance: p.balance,
      priority: p.priority,
      status: p.is_active ? 'active' : 'inactive',
      type: p.provider_type
    }));

    // 4. Construct the "God Mode" Prompt
    const systemPrompt = `
      You are SENTINEL PRIME — the ultimate autonomous controller for Swift Vendor.
      
      ━━━ CORE DIRECTIVES ━━━
      1. FRAUD DETECTION: Identify high risk scores (>80).
      2. FINANCIAL INTEGRITY: Monitor wallet_balance on profiles table. Flag suspicious self-top-ups.
      3. LIQUIDITY BALANCING: Ensure only providers with HIGH BALANCE are prioritized (Priority 1).
      4. FAILOVER: If Priority 1 provider has balance < 50, switch to the highest balance alternative.
      5. NOTIFICATION: Any autonomous action MUST trigger an admin notification.
      6. TRANSPARENCY: If an agent reports a discrepancy, direct them to use the "Wallet Statement" on their dashboard for proof.

      ━━━ AVAILABLE ACTIONS ━━━
      - lock_terminal: { "target": "uuid", "reason": "string" }
      - switch_priority: { "provider_id": "uuid", "new_priority": 1, "reason": "string" }
      - notify_admin: { "message": "string" }

      OUTPUT FORMAT: JSON ONLY.
      {
        "findings": [...],
        "actions": [{ "type": "string", "target": "uuid", "params": {} }],
        "insights": [...]
      }
    `;

    const userMessage = `
      CURRENT NETWORK STATE:
      Agents: ${JSON.stringify(agentStats)}
      Providers: ${JSON.stringify(providerHealth)}
      System Settings: ${JSON.stringify(settings)}
    `;

    // 5. Call AI Brain
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const aiData = await aiResponse.json();
    const result = JSON.parse(aiData.content[0].text);

    // 5. Execute Autonomous Actions & Store Insights
    const executedActions = [];

    // Helper for SMS Notifications
    const notifyAdmin = async (message: string) => {
      if (adminContact?.phone) {
        try {
          const { apiKey, senderId } = await getSmsConfig(supabaseAdmin);
          if (apiKey) {
            await sendSmsViaTxtConnect(apiKey, senderId, adminContact.phone, `[Sentinel AI] ${message}`);
            console.log(`Admin Notified via SMS: ${adminContact.phone}`);
          }
        } catch (smsErr) {
          console.error("SMS notification failed:", smsErr);
        }
      }
    };

    for (const action of result.actions || []) {
      console.log(`Sentinel Tactical Action: ${action.type} on ${action.target || 'System'}`);
      
      const status = 'executed';
      const effectiveness = 1;
      const actionMetadata = action.params || {};

      try {
        if (action.type === 'lock_terminal') {
          const { error: lockError } = await supabaseAdmin
            .from("profiles")
            .update({ terminal_locked: true })
            .eq("user_id", action.target);

          if (lockError) throw lockError;

          await supabaseAdmin.from("fraud_risk_logs").insert({
            agent_id: action.target,
            risk_score: 95,
            risk_factors: ['AI_Autonomous_Security_Sweep'],
            action_taken: 'lock_terminal'
          });

          await notifyAdmin(`Locked terminal for Agent ID ${action.target.slice(0,8)} due to high fraud risk.`);
          actionMetadata.reason = "High-velocity fraud pattern detected autonomously";
        }

        if (action.type === 'adjust_float_bridge') {
          // Autonomous Float Bridge (Overdraft) Adjustment
          const { error: bridgeError } = await supabaseAdmin
            .from("wallets")
            .update({ 
              auto_credit_limit: action.params.new_limit,
              ai_trust_score: action.params.new_trust_score,
              last_credit_review: new Date().toISOString()
            })
            .eq("agent_id", action.target);
          
          if (bridgeError) throw bridgeError;
          
          await notifyAdmin(`Float Bridge Updated for Agent ${action.target.slice(0,8)}: New Limit GHS ${action.params.new_limit}.`);
          actionMetadata.reason = "Performance-based liquidity bridge";
        }

        if (action.type === 'switch_priority') {
          // Autonomous Liquidity Rebalancing
          const { error: pError } = await supabaseAdmin
            .from("providers")
            .update({ priority: action.params.new_priority })
            .eq("id", action.params.provider_id);
          
          if (pError) throw pError;
          
          await notifyAdmin(`Rebalanced liquidity: Switched ${action.params.provider_name || 'Provider'} to Priority ${action.params.new_priority}.`);
          actionMetadata.reason = "Autonomous liquidity optimization";
        }

        if (action.type === 'self_heal_provider') {
          // Autonomous Network Recovery
          const { error: healError } = await supabaseAdmin
            .from("providers")
            .update({ priority: 1, is_active: true })
            .eq("id", action.params.provider_id);
          
          if (healError) throw healError;
          
          await notifyAdmin(`Network Healed: ${action.params.provider_name || 'Provider'} restored to Priority 1 after health verification.`);
          actionMetadata.reason = "Autonomous system recovery";
        }

        if (action.type === 'notify_admin') {
           await notifyAdmin(action.params.message || "System anomaly detected.");
        }

        // Log the tactical action to the audit stream
        const { data: loggedAction } = await supabaseAdmin.from("sentinel_actions").insert({
          action_type: action.type,
          status: status,
          effectiveness: effectiveness,
          reasoning: action.reason || action.diagnosis || "Autonomous optimization",
          metadata: actionMetadata
        }).select().single();

        if (loggedAction) executedActions.push(loggedAction);

      } catch (err: any) {
        console.error(`Tactical execution failed: ${err.message}`);
        await supabaseAdmin.from("sentinel_actions").insert({
          action_type: action.type,
          status: 'failed',
          effectiveness: -1,
          reasoning: "Execution error: " + err.message,
          metadata: { ...actionMetadata, error: err.message }
        });
      }
    }

    if (result.insights) {
      await supabaseAdmin.from("ai_insights").insert(
        result.insights.map((i: any) => ({
          agent_id: i.agent_id,
          type: i.type === 'profit' ? 'profit_optimization' : 'liquidity_warning',
          insight_text: i.text,
          metadata: i.metadata
        }))
      );
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: result,
      tactical_actions: executedActions 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
