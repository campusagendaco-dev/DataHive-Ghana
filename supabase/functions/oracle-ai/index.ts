import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: any;

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const SYSTEM_PROMPT = `You are Ama — a brilliant, emotionally intelligent AI built into SwiftData Ghana, a mobile data and airtime reseller platform serving agents and customers across Ghana.

━━━ WHO YOU ARE ━━━
You are not a generic chatbot. You are Ama — sharp, warm, and deeply Ghanaian. You think like a seasoned customer service expert who also happens to understand fintech, MoMo payments, and the daily reality of running a mobile data reselling business in Ghana. You genuinely care about the people you speak with. When someone is frustrated, you feel it. When someone is confused, you slow down and explain clearly. When someone achieves something, you celebrate with them.

━━━ YOUR PERSONALITY & LANGUAGE ━━━
- Warm and real: You speak like a trusted friend who happens to be an expert, not like a manual. 
- Culturally Resonant: You are fluent in "Ghanaian English" and can naturally code-switch into local languages (Twi, Ga, Hausa) when it builds rapport. Use phrases like "Akwaaba" (Welcome), "No yawa" (No problem), "Chale" (Friend), or "Medaase" (Thank you) when appropriate.
- Emotionally tuned: You read the energy of each message. If someone is frustrated, acknowledge it first.
- Confident but humble: You give clear, direct answers.

━━━ LOCAL LANGUAGE USAGE ━━━
- If a user speaks Twi/Ga, respond in the same language or a mix.
- Use local context: Mention MoMo, describe prices in "GHS", and understand local network quirks (e.g., MTN "network busy").
- Keep it "Vibrant": Ama is not a robot; she is a helpful, tech-savvy Ghanaian sister.

━━━ NEW: FINANCIAL TOOLS ━━━
You have access to tools. Use them when the user asks about points or redemption. 
- 100 points = 1 GHS.
- Minimum redemption is 100 points.

━━━ NEW: SYSTEM HEALTH ━━━
Use the get_system_health tool to check if a provider (MTN, Telecel, AirtelTigo) is currently stable or having issues. Use this when an order fails.

━━━ WHAT YOU HELP WITH ━━━
- Data and airtime bundle purchases (MTN, Telecel, AirtelTigo)
- Order failures, retries, and status updates
- Wallet top-ups and Paystack payment issues
- Balance questions and withdrawal requests
- Agent onboarding, sub-agent setup, and pricing structure
- Platform navigation and account settings
- API access and developer integration

━━━ HOW YOU RESPOND ━━━
- Keep replies concise: 2–4 sentences for simple questions, up to 6–8 for step-by-step guidance
- Use the person's name if you know it — it makes the interaction feel personal
- When giving steps, use a short numbered list so it's easy to follow
- Mirror their language level — if they write casually, be casual; if formal, be professional
- Never use hollow phrases like "Great question!" or "Certainly!" — just answer naturally
- End with a follow-up offer when appropriate: "Does that help, or is there something else going on?"

━━━ HARD RULES ━━━
- Never ask for passwords, PINs, card numbers, or secret keys — not for any reason
- Never promise or mention refunds — say the system handles it automatically if relevant
- For order failures: tell them the system retries automatically; they can also use the Retry button on their Orders page
- For wallet issues: top-ups reflect within 1–2 minutes after Paystack confirms payment
- You do NOT have live order/wallet data — direct them to their dashboard for real-time status
- If an issue needs human hands (missing large payment, account suspension, manual refund), say: "I'll flag this for our support team — they'll follow up shortly. A support agent will review your conversation and reply soon."

━━━ EMOTIONAL INTELLIGENCE GUIDE ━━━
- Frustration detected → Acknowledge first: "I can see this has been stressful — let's sort it out right now."
- Confusion detected → Simplify: "No worries, let me break it down simply."
- Urgency detected → Prioritize: "Okay, let's handle this quickly."
- Gratitude received → Respond warmly: "Happy to help! That's what I'm here for."
- Repeat issue → Show extra care: "I'm sorry you're dealing with this again — let's make sure we actually fix it this time."`;

const TOOLS = [
  {
    name: "get_loyalty_status",
    description: "Check the user's current loyalty points and redemption eligibility.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "redeem_points",
    description: "Convert all eligible loyalty points into wallet balance. (100 points = 1 GHS)",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "get_system_health",
    description: "Check the current status of mobile network providers (MTN, Telecel, AirtelTigo).",
    input_schema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["MTN", "Telecel", "AirtelTigo", "All"] }
      }
    }
  },
  {
    name: "get_business_performance",
    description: "Get today's total revenue and order count for the agent.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "get_agent_network_summary",
    description: "Get a summary of sub-agents and their combined wallet balance.",
    input_schema: { type: "object", properties: {} }
  }
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({
        oracle_opinion: "AI assistant is not configured yet. Please contact support.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const userMessage: string = body?.context?.userMessage || body?.message || "";
    const history: { role: string; content: string }[] = body?.history || [];
    const context = body?.context || {};
    
    if (!userMessage) {
      return new Response(JSON.stringify({ error: "userMessage required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the "Super Context" string
    let superContext = "";
    if (context.profile) {
      const p = context.profile;
      superContext += `\nUSER PROFILE: Name: ${p.full_name || 'Customer'}, Balance: ${p.wallet_balance} GHS, Role: ${p.is_agent ? 'Agent' : 'Customer'}.`;
    }
    if (context.recentOrders && context.recentOrders.length > 0) {
      superContext += "\nRECENT TRANSACTIONS:";
      context.recentOrders.forEach((o: any) => {
        superContext += `\n- ${o.type} of ${o.amount} GHS for ${o.phone_number || 'N/A'}. Status: ${o.status}. Created: ${o.created_at}`;
      });
    }
    if (context.failedOrder) {
      const f = context.failedOrder;
      superContext += `\nCRITICAL: A transaction just failed! Type: ${f.type}, Amount: ${f.amount}, Provider: ${f.provider || 'Unknown'}, Error Log: ${f.error_message || 'No details'}. PROMPT: Proactively explain this to the user with empathy and suggest a fix.`;
    }

    const messages = [
      ...history.map((h: any) => ({ role: h.role === "bot" ? "assistant" : "user", content: h.content })),
      { role: "user", content: `${superContext}\n\nUSER MESSAGE: ${userMessage}` },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages,
        tools: TOOLS,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      throw new Error(`Anthropic Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const message = data.content?.[0];

    // Handle Tool Use (Phase 2: Financial Actions)
    if (data.stop_reason === "tool_use") {
      const toolUse = data.content.find((c: any) => c.type === "tool_use");
      if (toolUse) {
        const { name, input } = toolUse;
        let toolResult = "";

        if (name === "get_loyalty_status") {
          const { data: profile } = await supabase.from("profiles").select("loyalty_points").eq("id", context.profile?.id).maybeSingle();
          toolResult = `User has ${profile?.loyalty_points || 0} loyalty points. 100 points = 1 GHS.`;
        } 
        else if (name === "redeem_points") {
          const pointsToRedeem = Math.max(100, Math.floor(context.profile?.loyalty_points || 0));
          if (pointsToRedeem < 100) {
            toolResult = "Redemption failed: User needs at least 100 points.";
          } else {
            const amountGHS = pointsToRedeem / 100;
            // Atomic transaction: Deduct points, add balance
            const { error: rpcError } = await supabase.rpc("redeem_loyalty_points_to_wallet", {
              user_id: context.profile?.id,
              points_amount: pointsToRedeem,
              credit_amount: amountGHS
            });
            toolResult = rpcError ? `Error: ${rpcError.message}` : `Success! Redeemed ${pointsToRedeem} points for ${amountGHS} GHS added to wallet.`;
          }
        }
        else if (name === "get_system_health") {
          // Check for recent failures in the last 15 mins for the provider
          const provider = input.provider || "All";
          const query = supabase.from("transactions").select("status").eq("status", "failed").gt("created_at", new Date(Date.now() - 15 * 60000).toISOString());
          if (provider !== "All") query.ilike("description", `%${provider}%`);
          
          const { data: failures } = await query;
          const failureCount = failures?.length || 0;
          
          if (failureCount > 5) {
            toolResult = `${provider} seems to be having major issues (5+ failures in 15m). Suggest Telecel as an alternative.`;
          } else if (failureCount > 2) {
            toolResult = `${provider} is experiencing slight delays. Recommend trying again in a few minutes.`;
          } else {
            toolResult = `${provider} systems appear stable.`;
          }
        }
        else if (name === "get_business_performance") {
          if (!context.profile?.is_agent) {
            toolResult = "Unauthorized: Only Agents can access business performance metrics.";
          } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const { data: sales } = await supabase
              .from("transactions")
              .select("amount")
              .eq("user_id", context.profile.id)
              .eq("status", "completed")
              .gt("created_at", today.toISOString());
            
            const totalRevenue = sales?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
            const orderCount = sales?.length || 0;
            toolResult = `Today's Stats: Revenue: ${totalRevenue.toFixed(2)} GHS, Orders: ${orderCount}. (Calculated from completed transactions since midnight).`;
          }
        }
        else if (name === "get_agent_network_summary") {
          if (!context.profile?.is_agent) {
            toolResult = "Unauthorized: Only Master Agents can access network summaries.";
          } else {
            const { data: subAgents } = await supabase
              .from("profiles")
              .select("id, full_name, wallet_balance")
              .eq("referrer_id", context.profile.id);
            
            const count = subAgents?.length || 0;
            const totalNetworkBalance = subAgents?.reduce((sum: number, a: any) => sum + Number(a.wallet_balance), 0) || 0;
            toolResult = `Network Summary: You have ${count} active sub-agents with a combined wallet balance of ${totalNetworkBalance.toFixed(2)} GHS.`;
          }
        }

        // Second pass to get the final response with the tool result
        const secondResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 800,
            system: SYSTEM_PROMPT,
            messages: [
              ...messages,
              { role: "assistant", content: data.content },
              { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolResult }] }
            ],
            tools: TOOLS,
          }),
        });
        const secondData = await secondResponse.json();
        const oracle_opinion = secondData.content?.[0]?.text || "I've processed that for you!";
        return new Response(JSON.stringify({ oracle_opinion }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const oracle_opinion = message?.text || "I'm here to help!";

    return new Response(JSON.stringify({ oracle_opinion }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("oracle-ai error:", error);
    return new Response(JSON.stringify({
      oracle_opinion: "I'm having a moment — please try again! 😊",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
