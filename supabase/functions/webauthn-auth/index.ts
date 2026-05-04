import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Note: In a real production app, we would use @simplewebauthn/server
// But for this demonstration/MVP, we will implement the core challenge generation
// and basic credential storage.

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const body = await req.json();
  const { action, payload } = body;
  const origin = req.headers.get("origin") || req.headers.get("referer");
  const originHost = origin ? new URL(origin).hostname : null;
  const rpId = body.rpId || payload?.rpId || originHost || req.headers.get("host")?.split(":")[0] || "localhost";
  const authHeader = req.headers.get("Authorization")!;
  
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    switch (action) {
      case "registration-options": {
        const challenge = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

        // Store challenge
        await supabaseAdmin.from("webauthn_challenges").insert({
          user_id: user.id,
          challenge,
          action: "register"
        });

        return new Response(JSON.stringify({
          challenge,
          rp: { name: "SwiftData Ghana", id: rpId },
          user: {
            id: user.id,
            name: user.email,
            displayName: user.user_metadata?.full_name || user.email
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          timeout: 60000,
          attestation: "none",
          authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred"
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "verify-registration": {
        const { response, deviceName } = payload;
        
        // Find the challenge
        const { data: challengeData } = await supabaseAdmin
          .from("webauthn_challenges")
          .select("*")
          .eq("user_id", user.id)
          .eq("action", "register")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!challengeData) throw new Error("Challenge not found");

        // In a real app, verify 'response' here. 
        // For now, we store the credential metadata.
        const { error: storeError } = await supabaseAdmin.from("user_credentials").insert({
          user_id: user.id,
          credential_id: response.id,
          public_key: response.attestationObject, // Simplified storage
          device_name: deviceName || "My Device",
          device_type: response.type
        });

        if (storeError) throw storeError;

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "authentication-options": {
        const challenge = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

        const { data: credentials } = await supabaseAdmin
          .from("user_credentials")
          .select("credential_id")
          .eq("user_id", user.id);

        await supabaseAdmin.from("webauthn_challenges").insert({
          user_id: user.id,
          challenge,
          action: "authenticate"
        });

        return new Response(JSON.stringify({
          challenge,
          timeout: 60000,
          userVerification: "preferred",
          allowCredentials: credentials?.map(c => ({
            id: c.credential_id,
            type: "public-key"
          })) || []
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "verify-authentication": {
        const { response } = payload;
        // Verify response against challenge...
        // For MVP, we return true if we find the credential
        const { data: cred } = await supabaseAdmin
          .from("user_credentials")
          .select("id")
          .eq("user_id", user.id)
          .eq("credential_id", response.id)
          .maybeSingle();

        if (!cred) throw new Error("Invalid credential");

        await supabaseAdmin.from("user_credentials").update({
          last_used_at: new Date().toISOString()
        }).eq("id", cred.id);

        return new Response(JSON.stringify({ verified: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete-credential": {
        const { credentialId } = payload;
        await supabaseAdmin.from("user_credentials").delete().eq("user_id", user.id).eq("credential_id", credentialId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
