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
        setSupportReason("Hardware Error: Your browser does not support biometric APIs. Try Chrome, Safari, or Edge.");
        setIsSupported(false);
        return;
      }

      try {
        // Deep check for actual hardware (TouchID/FaceID)
        const hasHardware = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!hasHardware) {
          setSupportReason("Device Error: No biometric hardware (Fingerprint/Face ID) detected on this device.");
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

  const getToken = async (): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Not authenticated");
    return token;
  };

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const token = await getToken();
    const { data, error } = await supabase.functions.invoke("webauthn-auth", {
      body: { action, ...extra },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchCredentials = async () => {
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
    console.log("Registering biometric for RP ID:", window.location.hostname);
    const options = await invoke("registration-options", { 
      displayName: deviceName,
      requested_rp_id: window.location.hostname,
      payload: { rpId: window.location.hostname } 
    });
    const response = await startRegistration({ optionsJSON: options });
    await invoke("verify-registration", { response, deviceName });
    await fetchCredentials();
  };

  const authenticate = async (): Promise<boolean> => {
    const options = await invoke("authentication-options", {
      rpId: window.location.hostname
    });
    const response = await startAuthentication({ optionsJSON: options });
    const result = await invoke("verify-authentication", { response });
    return result?.verified === true;
  };

  const deleteCredential = async (credentialId: string): Promise<void> => {
    await invoke("delete-credential", { credentialId });
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
