import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

declare const Deno: any;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { action, signature } = await req.json();
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new Error("Unauthorized");
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    if (action === "list") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("paystack_saved_authorizations, paystack_customer_code")
        .eq("user_id", user.id)
        .maybeSingle();
        
      return new Response(JSON.stringify({
        success: true,
        authorizations: profile?.paystack_saved_authorizations || [],
        customer_code: profile?.paystack_customer_code || null
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!signature) throw new Error("Signature required for deletion");
      
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("paystack_saved_authorizations")
        .eq("user_id", user.id)
        .maybeSingle();
        
      const currentAuths = Array.isArray(profile?.paystack_saved_authorizations) 
        ? profile.paystack_saved_authorizations 
        : [];
        
      const updatedAuths = currentAuths.filter((a: any) => a.signature !== signature);
      
      await supabaseAdmin.from("profiles")
        .update({ paystack_saved_authorizations: updatedAuths })
        .eq("user_id", user.id);
        
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");

  } catch (error) {
    console.error("Paystack Manage Cards Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
