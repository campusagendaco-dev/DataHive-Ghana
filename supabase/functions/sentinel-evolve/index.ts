import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Fetch executed actions not yet evaluated (effectiveness = 0 means neutral/unevaluated)
    const { data: actionsToEvaluate, error: actionError } = await supabaseAdmin
      .from("sentinel_actions")
      .select("*")
      .eq("status", "executed")
      .eq("effectiveness", 0)
      .lt("ts", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(10);

    if (actionError) throw actionError;

    const evaluations = [];

    for (const action of (actionsToEvaluate || [])) {
      // 2. Check if any new errors appeared after this action was taken
      // If errors persist in the window after the action, it was not effective
      const { data: subsequentErrors } = await supabaseAdmin
        .from("system_logs")
        .select("id")
        .eq("level", "error")
        .gt("ts", action.ts)
        .lt("ts", new Date(new Date(action.ts).getTime() + 30 * 60 * 1000).toISOString())
        .limit(1);

      const effectiveness = (subsequentErrors && subsequentErrors.length > 0) ? -1 : 1;

      // 3. Update the action effectiveness
      await supabaseAdmin
        .from("sentinel_actions")
        .update({ effectiveness })
        .eq("id", action.id);

      // 4. Update knowledge base strategy confidence if action was linked to a strategy
      if (action.strategy_id) {
        const { data: strategy } = await supabaseAdmin
          .from("sentinel_strategies")
          .select("confidence_score")
          .eq("id", action.strategy_id)
          .single();

        const currentScore = strategy?.confidence_score ?? 0.5;
        const newScore = Math.max(0, Math.min(1, currentScore + effectiveness * 0.1));
        await supabaseAdmin
          .from("sentinel_strategies")
          .update({ confidence_score: newScore })
          .eq("id", action.strategy_id);
      }

      evaluations.push({ action_id: action.id, effectiveness });
    }

    return new Response(JSON.stringify({
      success: true,
      evaluations_count: evaluations.length,
      evaluations,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Evolution Error:", error);
    return new Response(JSON.stringify({ error: (error as any)?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
