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

const LOCAL_KEY_CACHE = "swiftdata_biometric_keys";

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

  // 🗄️ LOCAL CACHE SYNC HELPERS
  const getCachedKeyIds = (): string[] => {
    try {
      const stored = localStorage.getItem(LOCAL_KEY_CACHE);
      return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
  };

  const updateCacheWithKeys = (keys: string[]) => {
    try {
      const current = getCachedKeyIds();
      const merged = Array.from(new Set([...current, ...keys]));
      localStorage.setItem(LOCAL_KEY_CACHE, JSON.stringify(merged));
    } catch (e) {}
  };

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("webauthn-auth", {
      body: { action, ...extra },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchCredentials = async () => {
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
    
    const creds = (data as unknown as WebAuthnCredential[]) ?? [];
    setCredentials(creds);
    setLoadingCredentials(false);

    // 🔄 ALWAYS HYDRATE LOCAL CACHE with existing known server keys for this user
    if (creds.length > 0) {
      updateCacheWithKeys(creds.map(c => c.credential_id));
    }
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
    
    // 💾 SECURELY CACHE THE NEWLY CREATED KEY ID IMMEDIATELY
    if (response.id) {
      updateCacheWithKeys([response.id]);
    }
    
    await fetchCredentials();
  };

  const authenticate = async (email?: string): Promise<boolean> => {
    // 🧩 GATHER HYBRID HINTS for maximum hardware bypass coverage!
    const localKeyIds = getCachedKeyIds();

    const options = await invoke("authentication-options", {
      rpId: window.location.hostname,
      email: email,
      localKeyIds: localKeyIds // Pass browser index directly to bypass OS discovery constraints!
    });
    
    if (!options) throw new Error("Could not initialize biometric handshake.");

    // 🔥 AUTO-LOAD CREDENTIALS IN BROWSER OVERRIDE
    // If the server populated them via email OR our hybrid index fallback, they're inside options.allowCredentials!
    const response = await startAuthentication({ optionsJSON: options });

    const result = await invoke("verify-authentication", { 
      email: email,
      payload: { response } 
    });
    
    // 4. Atomic Token Ingestion via Multi-Hop Bridge
    if (result?.bridge) {
      const { error } = await supabase.auth.verifyOtp({
        email: result.bridge.email,
        token: result.bridge.otp,
        type: 'magiclink'
      });
      if (error) throw new Error("Biometric session verification failed: " + error.message);
      
      // 🔄 UPDATE CACHE FOR FUTURE USES UPON SUCCESSFUL VALIDATION
      if (response.id) {
        updateCacheWithKeys([response.id]);
      }
    }

    return result?.verified === true;
  };

  const deleteCredential = async (credentialId: string): Promise<void> => {
    await invoke("delete-credential", { payload: { credentialId } });
    
    // Clean cache
    try {
      const current = getCachedKeyIds();
      const filtered = current.filter(id => id !== credentialId);
      localStorage.setItem(LOCAL_KEY_CACHE, JSON.stringify(filtered));
    } catch (e) {}
    
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
