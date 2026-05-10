import { useState, useEffect } from "react";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { supabase } from "@/integrations/supabase/client";

export interface WebAuthnCredential {
  id: string;
  credential_id: string;
  device_name: string;
  device_type: string | null;
  backed_up: boolean;
  created_at: string;
  last_used_at: string | null;
}

export function useWebAuthn() {
  const [supportReason, setSupportReason] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === "undefined") return;

      if (!window.isSecureContext) {
        setSupportReason("Security Error: Biometrics require a secure (HTTPS) connection.");
        setIsSupported(false);
        return;
      }

      if (!browserSupportsWebAuthn()) {
        setSupportReason("Hardware Error: Your browser does not support biometric APIs.");
        setIsSupported(false);
        return;
      }

      try {
        const hasHardware = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!hasHardware) {
          setSupportReason("Device Error: No biometric hardware detected.");
          setIsSupported(false);
          return;
        }
      } catch (e) {
        console.error("WebAuthn Hardware Check Error:", e);
      }

      setIsSupported(true);
      setSupportReason(null);
    };

    checkSupport();
  }, []);

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    // Supabase Client AUTOMATICALLY attaches the correct Auth Headers (Anon or Active Session)
    const { data, error } = await supabase.functions.invoke("webauthn-auth", {
      body: { action, ...extra },
    });
    
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchCredentials = async () => {
    // Need to check if we're logged in before loading credentials view
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      setLoadingCredentials(false);
      return;
    }
    
    setLoadingCredentials(true);
    const { data } = await supabase
      .from("user_credentials" as any)
      .select("id, credential_id, device_name, device_type, backed_up, created_at, last_used_at")
      .order("created_at", { ascending: false });
    setCredentials((data as unknown as WebAuthnCredential[]) ?? []);
    setLoadingCredentials(false);
  };

  useEffect(() => { fetchCredentials(); }, []);

  const register = async (deviceName = "My Device"): Promise<void> => {
    const options = await invoke("registration-options", { 
      displayName: deviceName,
      requested_rp_id: window.location.hostname,
      payload: { rpId: window.location.hostname } 
    });
    const response = await startRegistration({ optionsJSON: options });
    await invoke("verify-registration", { payload: { response, deviceName } });
    await fetchCredentials();
  };

  const authenticate = async (email?: string): Promise<boolean> => {
    // 1. Request Options. If not logged in, MUST supply email.
    const options = await invoke("authentication-options", {
      rpId: window.location.hostname,
      email: email // Pass root level to resolveUserId helper in function
    });
    
    if (!options || options.error) {
      throw new Error(options?.error || "Could not initialize biometric session.");
    }

    // 2. Trigger Browser Biometric Modal
    const response = await startAuthentication({ optionsJSON: options });

    // 3. Verify backend and ingest implicit session if returned
    const result = await invoke("verify-authentication", { 
      email: email,
      payload: { response } 
    });
    
    // 4. Perform Automatic Native Session Ingestion
    if (result?.session) {
      const { error } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token
      });
      if (error) throw new Error("Session synchronization failed: " + error.message);
    }

    return result?.verified === true;
  };

  const deleteCredential = async (credentialId: string): Promise<void> => {
    await invoke("delete-credential", { payload: { credentialId } });
    await fetchCredentials();
  };

  return {
    isSupported,
    supportReason,
    credentials,
    loadingCredentials,
    fetchCredentials,
    register,
    authenticate,
    deleteCredential,
  };
}
