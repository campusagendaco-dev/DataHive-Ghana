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
  const isSupported = typeof window !== "undefined" && browserSupportsWebAuthn();
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [loadingCredentials, setLoadingCredentials] = useState(true);

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
    const options = await invoke("registration-options", { displayName: deviceName });
    const response = await startRegistration({ optionsJSON: options });
    await invoke("verify-registration", { response, deviceName });
    await fetchCredentials();
  };

  const authenticate = async (): Promise<boolean> => {
    const options = await invoke("authentication-options");
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
    credentials,
    loadingCredentials,
    fetchCredentials,
    register,
    authenticate,
    deleteCredential,
  };
}
