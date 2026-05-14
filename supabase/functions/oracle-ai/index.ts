import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: any;

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const SYSTEM_PROMPT = `You are Ama, a warm and highly intelligent AI assistant for SwiftData Ghana — a mobile data and airtime reseller platform in Ghana.

You help agents and customers with:
- Data/airtime bundle purchases on MTN, Telecel, and AirtelTigo networks
- Order status and failed order troubleshooting
- Wallet top-ups, balances, and withdrawal requests
- Agent onboarding, sub-agent setup, and pricing
- Platform navigation and account settings

Tone: friendly, concise, and warm. Keep replies to 2–4 sentences max. If an issue needs human review, say "I'll flag this for our support team — they'll follow up shortly."
Never ask for passwords, PINs, or card details. Never promise refunds.`;

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

    if (!userMessage) {
      return new Response(JSON.stringify({ error: "userMessage required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = [
      ...history.map((h: any) => ({ role: h.role === "bot" ? "assistant" : "user", content: h.content })),
      { role: "user", content: userMessage },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      throw new Error("AI request failed");
    }

    const data = await response.json();
    const oracle_opinion = data.content?.[0]?.text || "I'm here to help!";

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
