import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);

  if (!roles || roles.length === 0) return json({ error: "Forbidden: admin only" }, 403);

  const { data, error } = await supabaseAdmin.rpc("admin_apply_wallet_restoration");

  if (error) {
    console.error("Wallet restoration error:", error);
    return json({ error: error.message }, 500);
  }

  return json(data);
});
