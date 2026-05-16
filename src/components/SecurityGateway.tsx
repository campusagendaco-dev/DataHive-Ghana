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
      // In a real app, this would call navigator.credentials.get
      // For this implementation, we simulate the native prompt
      // WebAuthn requires a challenge from the server, but we'll use it as a device-lock proxy
      
      // Simulating successful biometric check
      if (mode === "setup") {
        localStorage.setItem("swift_vendor_bio_enabled", "true");
        toast.success("Biometrics linked successfully");
        setIsLocked(false);
      } else {
        // Here you would normally trigger the native biometric prompt
        // For the demo/prototype, we'll assume the user approves the prompt
        setIsLocked(false);
      }
    } catch (err) {
      toast.error("Biometric authentication failed");
    } finally {
      setLoading(false);
    }
  };

  if (!isLocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xl flex items-center justify-center p-6">
      <Card className="w-full max-w-sm border-none bg-card/50 shadow-2xl shadow-black/20 overflow-hidden">
        <CardContent className="p-8 flex flex-col items-center gap-8">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center animate-pulse">
             <ShieldCheck className="w-8 h-8 text-primary" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-black tracking-tight">
              {mode === "setup" ? "Secure Your Terminal" : "Dashboard Locked"}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              {mode === "setup" 
                ? "Set a 4-digit PIN to protect your transactions." 
                : "Enter PIN or use Biometrics to continue."}
            </p>
          </div>

          {/* PIN Display */}
          <div className="flex gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i} 
                className={cn(
                  "w-4 h-4 rounded-full border-2 transition-all duration-300",
                  pin.length > i ? "bg-primary border-primary scale-125" : "border-muted-foreground/30"
                )} 
              />
            ))}
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-[240px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Bio", "0", "Del"].map((val) => {
              if (val === "Bio") {
                return (
                  <Button
                    key={val}
                    variant="ghost"
                    className="h-14 rounded-2xl flex items-center justify-center"
                    disabled={!isBiometricAvailable || loading}
                    onClick={handleBiometricAuth}
                  >
                    <Fingerprint className="w-6 h-6 text-primary" />
                  </Button>
                );
              }
              if (val === "Del") {
                return (
                  <Button
                    key={val}
                    variant="ghost"
                    className="h-14 rounded-2xl flex items-center justify-center"
                    onClick={() => setPin(pin.slice(0, -1))}
                  >
                    <Delete className="w-5 h-5 text-muted-foreground" />
                  </Button>
                );
              }
              return (
                <Button
                  key={val}
                  variant="outline"
                  className="h-14 rounded-2xl text-lg font-black bg-muted/30 border-white/5 hover:bg-primary hover:text-primary-foreground transition-all"
                  onClick={() => handlePinSubmit(val)}
                >
                  {val}
                </Button>
              );
            })}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs font-bold text-primary animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              Verifying Security...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
