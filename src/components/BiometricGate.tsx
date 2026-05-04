import { useState } from "react";
import { Fingerprint, ShieldAlert, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useWebAuthn } from "@/hooks/useWebAuthn";

interface BiometricGateProps {
  onSuccess: () => void;
  children: React.ReactNode;
  label?: string;
  className?: string;
}

type State = "idle" | "scanning" | "success" | "failed";

const BiometricGate = ({ onSuccess, children, label = "Authenticate to continue", className }: BiometricGateProps) => {
  const { isSupported, credentials, authenticate } = useWebAuthn();
  const [state, setState] = useState<State>("idle");

  const hasCredential = credentials.length > 0;

  const handleTrigger = async () => {
    if (!isSupported) {
      toast.error("Biometric authentication is not supported on this device.");
      return;
    }
    if (!hasCredential) {
      toast.error("No biometric registered. Enable it in Account Settings → Security.");
      return;
    }

    setState("scanning");
    try {
      const verified = await authenticate();
      if (verified) {
        setState("success");
        setTimeout(onSuccess, 300);
      } else {
        setState("failed");
        toast.error("Biometric check failed. Try again.");
        setTimeout(() => setState("idle"), 2000);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Authentication failed.";
      if (msg.includes("cancelled") || msg.includes("NotAllowedError")) {
        toast.error("Authentication cancelled.");
      } else {
        toast.error("Biometric error", { description: msg });
      }
      setState("failed");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  // If no biometric support or no credential registered, skip the gate and render children directly
  // (the calling page can choose to still show a warning separately)
  if (!isSupported || !hasCredential) {
    return <>{children}</>;
  }

  if (state === "success") {
    return (
      <div className={`flex flex-col items-center gap-3 py-6 ${className ?? ""}`}>
        <CheckCircle className="w-10 h-10 text-emerald-400 animate-in zoom-in duration-300" />
        <p className="text-sm font-black text-emerald-400">Identity confirmed</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-4 py-5 ${className ?? ""}`}>
      <button
        type="button"
        onClick={handleTrigger}
        disabled={state === "scanning"}
        className="group relative w-20 h-20 rounded-3xl flex items-center justify-center border-2 border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60 hover:bg-amber-500/10 transition-all active:scale-95 disabled:opacity-60"
      >
        {state === "scanning" ? (
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        ) : state === "failed" ? (
          <ShieldAlert className="w-8 h-8 text-red-400 animate-in zoom-in duration-200" />
        ) : (
          <Fingerprint className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
        )}
        {state === "scanning" && (
          <span className="absolute inset-0 rounded-3xl border-2 border-amber-400/40 animate-ping" />
        )}
      </button>
      <p className="text-sm font-medium text-white/60 text-center">{label}</p>
    </div>
  );
};

export default BiometricGate;
