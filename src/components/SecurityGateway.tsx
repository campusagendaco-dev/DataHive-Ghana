import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Fingerprint, Lock, ShieldCheck, Loader2, Delete } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SecurityGatewayProps {
  children: React.ReactNode;
}

export function SecurityGateway({ children }: SecurityGatewayProps) {
  const [isLocked, setIsLocked] = useState(true);
  const [pin, setPin] = useState("");
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [hasSetupSecurity, setHasSetupSecurity] = useState(false);
  const [mode, setMode] = useState<"setup" | "unlock">("unlock");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if security is already set up
    const storedPin = localStorage.getItem("swift_vendor_pin");
    const storedBio = localStorage.getItem("swift_vendor_bio_enabled");
    
    if (!storedPin && !storedBio) {
      setMode("setup");
    } else {
      setHasSetupSecurity(true);
      // Auto-trigger biometrics if enabled
      if (storedBio === "true") {
        handleBiometricAuth();
      }
    }

    // Check biometric availability
    if (window.PublicKeyCredential) {
      setIsBiometricAvailable(true);
    }
  }, []);

  const handlePinSubmit = async (digit?: string) => {
    let currentPin = pin;
    if (digit) {
      if (pin.length >= 4) return;
      currentPin = pin + digit;
      setPin(currentPin);
    }

    if (currentPin.length === 4) {
      setLoading(true);
      if (mode === "setup") {
        localStorage.setItem("swift_vendor_pin", currentPin);
        toast.success("PIN Security set up successfully");
        setIsLocked(false);
      } else {
        const storedPin = localStorage.getItem("swift_vendor_pin");
        if (currentPin === storedPin) {
          setIsLocked(false);
          toast.success("Dashboard Unlocked");
        } else {
          setPin("");
          toast.error("Invalid PIN");
        }
      }
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    if (!isBiometricAvailable) return;
    
    try {
      setLoading(true);
      
      // Use WebAuthn as a proxy for device biometric check
      // This will trigger the native Fingerprint/FaceID/PIN prompt from the browser/OS
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      if (mode === "setup") {
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "SwiftData" },
            user: {
              id: crypto.getRandomValues(new Uint8Array(16)),
              name: "agent@swiftdata.gh",
              displayName: "Swift Agent",
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            authenticatorSelection: { authenticatorAttachment: "platform" },
          }
        });

        if (credential) {
          localStorage.setItem("swift_vendor_bio_enabled", "true");
          toast.success("Biometrics linked successfully");
          setIsLocked(false);
        }
      } else {
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [], // Allow any platform credential
          }
        });

        if (credential) {
          setIsLocked(false);
          toast.success("Dashboard Unlocked via Biometrics");
        }
      }
    } catch (err: any) {
      console.error("Biometric error:", err);
      if (err.name !== "NotAllowedError") {
        toast.error("Biometric authentication failed");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isLocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 overflow-hidden">
      {/* ── Dynamic Security Background ── */}
      <div className="absolute inset-0 bg-[#0d140d]">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/5 animate-pulse" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-blob animation-delay-2000" />
      </div>

      <Card className="w-full max-w-sm border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative group">
        {/* Guard Scanner Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 animate-scan pointer-events-none" />
        
        <CardContent className="p-8 flex flex-col items-center gap-8 relative z-10">
          {/* Enhanced Shield Icon */}
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-primary/20 blur-xl animate-pulse" />
            <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center relative z-10 shadow-inner group-hover:scale-105 transition-transform duration-500">
               <ShieldCheck className="w-10 h-10 text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            </div>
            {/* Orbital Rings */}
            <div className="absolute inset-[-10px] border border-primary/10 rounded-full animate-spin-slow pointer-events-none" />
            <div className="absolute inset-[-20px] border border-primary/5 rounded-full animate-spin-reverse-slow pointer-events-none" />
          </div>

          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-2">
              <Lock className="w-3 h-3 text-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Military Grade Guard</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              {mode === "setup" ? "Secure Terminal" : "Guard Active"}
            </h2>
            <p className="text-sm text-white/50 font-medium max-w-[220px] mx-auto leading-relaxed">
              {mode === "setup" 
                ? "Establish your master access key to protect your agency float." 
                : "Biometric or PIN verification required to access POS terminal."}
            </p>
          </div>

          {/* Enhanced PIN Display */}
          <div className="flex gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={cn(
                  "w-3.5 h-3.5 rounded-full border-2 transition-all duration-500 relative",
                  pin.length > i 
                    ? "bg-primary border-primary scale-125 shadow-[0_0_15px_rgba(var(--primary),0.6)]" 
                    : "border-white/10 bg-white/5"
                )} 
              >
                {pin.length > i && (
                  <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-20" />
                )}
              </div>
            ))}
          </div>

          {/* Premium Number Pad */}
          <div className="grid grid-cols-3 gap-3.5 w-full">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Bio", "0", "Del"].map((val) => {
              if (val === "Bio") {
                return (
                  <Button
                    key={val}
                    variant="ghost"
                    className="h-14 rounded-2xl flex items-center justify-center relative group overflow-hidden border border-white/5 hover:border-primary/30 transition-all"
                    disabled={!isBiometricAvailable || loading}
                    onClick={handleBiometricAuth}
                  >
                    <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/20 transition-colors" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-radial from-primary/20 to-transparent transition-opacity" />
                    <Fingerprint className={cn(
                      "w-7 h-7 text-primary relative z-10 transition-transform duration-300",
                      isBiometricAvailable && "animate-pulse"
                    )} />
                  </Button>
                );
              }
              if (val === "Del") {
                return (
                  <Button
                    key={val}
                    variant="ghost"
                    className="h-14 rounded-2xl flex items-center justify-center border border-white/5 hover:bg-red-500/10 hover:text-red-500 transition-all"
                    onClick={() => setPin(pin.slice(0, -1))}
                  >
                    <Delete className="w-5 h-5" />
                  </Button>
                );
              }
              return (
                <Button
                  key={val}
                  variant="outline"
                  className="h-14 rounded-2xl text-xl font-black bg-white/5 border-white/5 text-white hover:bg-primary hover:text-black hover:scale-105 active:scale-95 transition-all duration-200"
                  onClick={() => handlePinSubmit(val)}
                >
                  {val}
                </Button>
              );
            })}
          </div>

          {/* Footer Security Badge */}
          <div className="flex flex-col items-center gap-3 w-full pt-4 border-t border-white/5">
             {loading ? (
                <div className="flex items-center gap-2 text-[10px] font-black text-primary animate-pulse uppercase tracking-widest">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Decrypting Vault...
                </div>
             ) : (
                <div className="flex items-center gap-2 opacity-30 grayscale group-hover:grayscale-0 group-hover:opacity-60 transition-all">
                   <ShieldCheck className="w-3 h-3 text-primary" />
                   <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">End-to-End Guarded</span>
                </div>
             )}
          </div>
        </CardContent>
      </Card>

      {/* CSS for animations */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(400px); opacity: 0; }
        }
        .animate-scan {
          animation: scan 3s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        .animate-spin-reverse-slow {
          animation: spin 12s linear reverse infinite;
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
