import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[Admin-Task] Beginning forced mass fulfillment of all processing orders...");

    // 1. Update all stuck processing orders directly to fulfilled
    const { data, count, error } = await supabase
      .from("orders")
      .update({ 
        status: "fulfilled", 
        failure_reason: "Mass fulfilled via direct admin command" 
      })
      .eq("status", "processing")
      .select("id", { count: "exact" });

    if (error) {
      console.error("[Admin-Task] Direct database update failed:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
    }

    console.log(`[Admin-Task] SUCCESS! Fulfilled ${count || 0} orders!`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully mass-fulfilled ${count || 0} stuck processing orders.`, 
      count: count || 0,
      affected_ids: (data || []).map(o => o.id)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Admin-Task] CRASH:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
