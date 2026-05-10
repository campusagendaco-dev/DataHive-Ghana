import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const body = await req.json();
  const { action, payload } = body;
  
  const origin = req.headers.get("origin") || req.headers.get("referer");
  let originHost = null;
  try {
    if (origin) originHost = new URL(origin).hostname;
  } catch (e) {
    console.error("Invalid origin:", origin);
  }
  
  let rpId = body.requested_rp_id || body.rpId || payload?.rpId || originHost || req.headers.get("x-forwarded-host") || req.headers.get("host")?.split(":")[0] || "swiftdatagh.shop";

  if (rpId.includes("supabase.co") || rpId.includes("supabase.com") || rpId === "localhost") {
    if (originHost && !originHost.includes("supabase")) {
      rpId = originHost;
    } else if (body.requested_rp_id) {
      rpId = body.requested_rp_id;
    } else if (body.rpId) {
      rpId = body.rpId;
    }
  }
  
  const authHeader = req.headers.get("Authorization");
  
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let user: any = null;
  if (authHeader) {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data } = await supabaseClient.auth.getUser();
    user = data.user;
  }

  // Helper to resolve user ID from either current user or supplied email
  const resolveUserId = async () => {
    if (user) return user.id;
    const email = body.email || payload?.email;
    if (!email) return null;
    
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .ilike("email", email)
      .maybeSingle();
      
    if (error || !profile) return null;
    return profile.user_id;
  };

  try {
    switch (action) {
      case "registration-options": {
        if (!user) throw new Error("Authentication required for registration");
        const challenge = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

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
        if (!user) throw new Error("Authentication required");
        const { response, deviceName } = payload;
        
        const { data: challengeData } = await supabaseAdmin
          .from("webauthn_challenges")
          .select("*")
          .eq("user_id", user.id)
          .eq("action", "register")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!challengeData) throw new Error("Challenge not found");

        const { error: storeError } = await supabaseAdmin.from("user_credentials").insert({
          user_id: user.id,
          credential_id: response.id,
          public_key: response.response?.attestationObject || "{}", 
          device_name: deviceName || "My Device",
          device_type: response.type
        });

        if (storeError) throw storeError;
        
        await supabaseAdmin.from("profiles").update({ biometric_enabled: true }).eq("user_id", user.id);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "authentication-options": {
        const targetUserId = await resolveUserId();
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: "User not found or email required." }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const challenge = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

        const { data: credentials } = await supabaseAdmin
          .from("user_credentials")
          .select("credential_id")
          .eq("user_id", targetUserId);

        await supabaseAdmin.from("webauthn_challenges").insert({
          user_id: targetUserId,
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
        const targetUserId = await resolveUserId();
        if (!targetUserId) throw new Error("User context invalid or missing email.");

        // MVP Verification: Lookup valid credential assigned to target user
        const { data: cred } = await supabaseAdmin
          .from("user_credentials")
          .select("id")
          .eq("user_id", targetUserId)
          .eq("credential_id", response.id)
          .maybeSingle();

        if (!cred) {
          return new Response(JSON.stringify({ error: "Biometric identity mismatch." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabaseAdmin.from("user_credentials").update({
          last_used_at: new Date().toISOString()
        }).eq("id", cred.id);

        // 🔥 CRITICAL: Generate explicit session bypass for external logins!
        let loginSession = null;
        if (!user) {
          const { data: sess, error: sessErr } = await supabaseAdmin.auth.admin.createSessionForUser({
            userId: targetUserId
          });
          if (sessErr) throw sessErr;
          loginSession = sess.session;
        }

        return new Response(JSON.stringify({ 
          verified: true,
          session: loginSession 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete-credential": {
        if (!user) throw new Error("Forbidden");
        const { credentialId } = payload;
        await supabaseAdmin.from("user_credentials").delete().eq("user_id", user.id).eq("credential_id", credentialId);
        
        // Check if any remain
        const { count } = await supabaseAdmin
          .from("user_credentials")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
          
        if (!count || count === 0) {
          await supabaseAdmin.from("profiles").update({ biometric_enabled: false }).eq("user_id", user.id);
        }
        
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
