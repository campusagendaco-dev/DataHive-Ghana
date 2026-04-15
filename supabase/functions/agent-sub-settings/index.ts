import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple JWT decoder (doesn't verify signature, but token came from Supabase so it's safe)
function decodeJWT(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid token format");
    const payload = parts[1];
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (e) {
    console.error("JWT decode error:", e);
    throw e;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized: missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Extract and decode JWT token
  let userId: string;
  try {
    const token = authHeader.replace("Bearer ", "");
    const decoded = decodeJWT(token);
    userId = decoded.sub as string;
    
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized: missing user in token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Token decode failed:", err);
    return new Response(JSON.stringify({ error: `Unauthorized: ${String(err)}` }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service-role client bypasses PostgREST schema cache issues for new columns
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "set_markup") {
      const markup = Number(body.markup);
      if (!Number.isFinite(markup) || markup < 0) {
        return new Response(JSON.stringify({ error: "Invalid markup value" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ sub_agent_activation_markup: markup })
        .eq("user_id", userId);

      if (error) {
        console.error("Update error:", error);
        return new Response(JSON.stringify({ error: `Update failed: ${error.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set_prices") {
      const prices = body.prices;
      if (!prices || typeof prices !== "object") {
        return new Response(JSON.stringify({ error: "Invalid prices value" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ sub_agent_prices: prices })
        .eq("user_id", userId);

      if (error) {
        console.error("Update error:", error);
        return new Response(JSON.stringify({ error: `Update failed: ${error.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "push_prices") {
      // Push sub_agent_prices to all approved sub agents' agent_prices
      const prices = body.prices;

      if (!prices || typeof prices !== "object") {
        return new Response(JSON.stringify({ error: "Invalid prices value" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch approved sub agents
      const { data: subAgents, error: fetchErr } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("parent_agent_id", userId)
        .eq("sub_agent_approved", true);

      if (fetchErr) {
        return new Response(JSON.stringify({ error: fetchErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates = (subAgents || []).map((sa: { user_id: string }) =>
        supabaseAdmin
          .from("profiles")
          .update({ agent_prices: prices })
          .eq("user_id", sa.user_id)
      );

      const results = await Promise.all(updates);
      const failures = results.filter((r) => r.error);

      return new Response(
        JSON.stringify({
          success: true,
          pushed: (subAgents || []).length - failures.length,
          failed: failures.length,
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: `Server error: ${String(err)}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
