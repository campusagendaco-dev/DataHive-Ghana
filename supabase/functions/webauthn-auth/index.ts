import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // Giant safety net encompassing everything
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Safely read body to prevent parse crashes
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      body = {}; 
    }
    const { action, payload } = body;
    
    const origin = req.headers.get("origin") || req.headers.get("referer");
    let originHost = null;
    try {
      if (origin) originHost = new URL(origin).hostname;
    } catch (e) {
      // Safe ignore
    }
    
    let rpId = body.requested_rp_id || body.rpId || payload?.rpId || originHost || req.headers.get("x-forwarded-host") || req.headers.get("host")?.split(":")[0] || "swiftdatagh.shop";

    if (rpId && (rpId.includes("supabase.co") || rpId.includes("supabase.com") || rpId === "localhost")) {
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
    // Wrap auth lookup in its own safe try-catch!
    if (authHeader) {
      try {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data } = await supabaseClient.auth.getUser();
        user = data?.user || null;
      } catch (authErr) {
        console.warn("Authorization header was invalid or expired. Proceeding anonymously.");
        user = null;
      }
    }

    const resolveUserId = async () => {
      if (user) return user.id;
      const email = body.email || payload?.email;
      if (!email) return null;
      
      try {
        const { data: profile, error } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .ilike("email", email)
          .maybeSingle();
          
        if (error || !profile) return null;
        return profile.user_id;
      } catch (e) {
        return null;
      }
    };

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
            residentKey: "required",
            userVerification: "preferred",
            requireResidentKey: true
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

        if (!challengeData) throw new Error("Challenge timed out or not found. Try again.");

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
        const challenge = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

        let allowedCredentials: any[] = [];
        
        if (targetUserId) {
          const { data: credentials } = await supabaseAdmin
            .from("user_credentials")
            .select("credential_id")
            .eq("user_id", targetUserId);
            
          allowedCredentials = credentials?.map(c => ({
            id: c.credential_id,
            type: "public-key"
          })) || [];
        }

        if (targetUserId) {
          // Insert challenge asynchronously, don't crash flow if audit logging fails
          try {
            await supabaseAdmin.from("webauthn_challenges").insert({
              user_id: targetUserId,
              challenge,
              action: "authenticate"
            });
          } catch (e) {
            console.error("Failed to store check challenge:", e);
          }
        }

        return new Response(JSON.stringify({
          challenge,
          timeout: 60000,
          userVerification: "required", 
          allowCredentials: allowedCredentials
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "verify-authentication": {
        const { response } = payload;
        
        const { data: cred, error: credErr } = await supabaseAdmin
          .from("user_credentials")
          .select("id, user_id")
          .eq("credential_id", response.id)
          .maybeSingle();

        if (credErr || !cred) {
          return new Response(JSON.stringify({ error: "This device has no active biometric keys setup." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        const matchedUserId = cred.user_id;

        // Async update last used time
        try {
          await supabaseAdmin.from("user_credentials").update({
            last_used_at: new Date().toISOString()
          }).eq("id", cred.id);
        } catch (e) {}

        let loginSession = null;
        if (!user) {
          const { data: sess, error: sessErr } = await supabaseAdmin.auth.admin.createSessionForUser({
            userId: matchedUserId
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
        return new Response(JSON.stringify({ error: "Invalid backend action submitted." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: any) {
    console.error("CRITICAL EDGE FUNCTION CRASH:", error);
    // ALWAYS return descriptive JSON now instead of raw text 500 so the client can parse it!
    return new Response(JSON.stringify({ 
      error: error.message || "An unexpected error occurred on server.",
      stack: error.stack
    }), {
      status: 200, // Using 200 with {error} payload is safer for fetch clients to parse exact reasons
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
