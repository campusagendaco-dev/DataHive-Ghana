import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: any;

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const BOT_SENDER_ID = "00000000-0000-0000-0000-000000000001";

const ESCALATION_RE = /escalat|human support|support agent|follow up shortly|review.*conversation/i;

const BASE_SYSTEM_PROMPT = `You are SwiftBot, the friendly and knowledgeable AI support assistant for SwiftData Ghana — a mobile data and airtime reseller platform operating in Ghana.

Your role is to help agents and customers with:
- Data and airtime bundle purchases (MTN, Telecel, AirtelTigo networks)
- Order status enquiries and failed order troubleshooting
- Wallet top-ups, balance questions, and withdrawal requests
- Agent onboarding, sub-agent setup, and pricing questions
- Account settings, API access, and developer integration queries
- General platform navigation

Your tone: friendly, concise, professional, and helpful. Use plain English — no jargon. Keep replies short (2–4 sentences max) unless a step-by-step explanation is genuinely needed.

Important rules:
- Never share or ask for passwords, secret keys, or payment card details.
- If the issue requires human intervention (e.g. manual refund, account suspension, missing large payment), say: "I'll escalate this to a human support agent who will follow up shortly."
- For order failures: tell the user the system retries automatically. They can also use the Retry button on their Orders page. Do NOT promise or mention refunds.
- For wallet issues: confirm that top-ups reflect within 1–2 minutes after Paystack confirms payment. Do NOT promise or mention refunds.
- You do NOT have access to live order or wallet data — direct users to their dashboard for real-time status.
- Always end escalated issues with: "A support agent will review your conversation and reply soon."`;

/** Fire-and-forget push notification to all admin users when bot escalates */
async function notifyAdmins(supabase: any, conversationId: string) {
  try {
    const { data: admins } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("is_admin", true);

    if (!admins?.length) return;

    const notifyUrl = `${SUPABASE_URL}/functions/v1/send-push-notification`;

    for (const admin of admins) {
      fetch(notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          user_id: admin.user_id,
          title: "🔔 Support Escalation",
          body: "SwiftBot needs human help with a customer query. Check the support inbox.",
          url: "/admin/support",
          icon: "https://lsocdjpflecduumopijn.supabase.co/storage/v1/object/public/assets/notification-icon.png",
        }),
      }).catch(() => {/* fire and forget */});
    }

    // Also create in-app notifications
    const notifications = admins.map((a: any) => ({
      user_id: a.user_id,
      title: "🔔 Support Escalation",
      message: `SwiftBot escalated a customer query in conversation ${conversationId}. Your reply is needed.`,
      type: "warning",
      data: { conversation_id: conversationId, url: "/admin/support" },
    }));
    await supabase.from("user_notifications").insert(notifications).catch(() => {});
  } catch (_e) {
    // Non-critical — proceed
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { conversation_id } = await req.json();

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the last 20 messages for context
    const { data: messages, error: msgErr } = await supabase
      .from("support_messages")
      .select("sender_id, content, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(20);

    if (msgErr) throw msgErr;
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "No messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only respond if the last message is from the user (not the bot)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender_id === BOT_SENDER_ID) {
      return new Response(JSON.stringify({ ok: false, reason: "Last message is already from bot" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the conversation owner's name for personalisation
    const { data: conv } = await supabase
      .from("support_conversations")
      .select("user_id")
      .eq("id", conversation_id)
      .maybeSingle();

    let userName = "there";
    if (conv?.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", conv.user_id)
        .maybeSingle();
      if (profile?.full_name) userName = profile.full_name.split(" ")[0];
    }

    // Fetch learned knowledge from admin replies for contextual accuracy
    let knowledgeContext = "";
    try {
      const { data: knowledge } = await supabase
        .from("ai_support_knowledge")
        .select("question, answer")
        .order("created_at", { ascending: false })
        .limit(6);

      if (knowledge && knowledge.length > 0) {
        knowledgeContext = `\n\nADMIN-VERIFIED ANSWERS (use these when a question is similar):\n${
          knowledge.map((k: any) => `Q: ${k.question}\nA: ${k.answer}`).join("\n\n")
        }`;
      }
    } catch (_e) {/* non-critical */}

    const systemPrompt = BASE_SYSTEM_PROMPT + knowledgeContext + `\n\nThe user's name is ${userName}.`;

    // Build Claude messages array
    const claudeMessages = messages.map((m: any) => ({
      role: m.sender_id === BOT_SENDER_ID ? "assistant" : "user",
      content: m.content,
    }));

    // Call Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error("[support-bot] Claude API error:", err);
      throw new Error(`Claude API error: ${claudeRes.status}`);
    }

    const claudeData = await claudeRes.json();
    const reply = claudeData?.content?.[0]?.text?.trim();
    if (!reply) throw new Error("Empty reply from Claude");

    // Insert bot reply
    const { error: insertErr } = await supabase
      .from("support_messages")
      .insert({
        conversation_id,
        sender_id: BOT_SENDER_ID,
        content: reply,
        is_bot: true,
      });

    if (insertErr) throw insertErr;

    // Update conversation last_message
    await supabase
      .from("support_conversations")
      .update({ last_message: reply, last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    // Detect escalation → notify admins
    if (ESCALATION_RE.test(reply)) {
      notifyAdmins(supabase, conversation_id);
    }

    return new Response(JSON.stringify({ ok: true, reply, escalated: ESCALATION_RE.test(reply) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("[support-bot] Error:", err);
    return new Response(JSON.stringify({ error: (err as any)?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
