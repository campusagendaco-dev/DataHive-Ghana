import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2, XCircle, Loader2, ShieldCheck, Zap,
  Activity, Copy, Check, RefreshCw, ArrowLeft,
  Search, Info, Database, SignalHigh
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type OrderStatusType = "pending" | "paid" | "processing" | "fulfilled" | "fulfillment_failed" | "error" | "not_paid";

const STEPS = [
  { key: "confirmed", icon: ShieldCheck, color: "#10B981" },
  { key: "delivering", icon: Zap, color: "#F59E0B" },
  { key: "done", icon: CheckCircle2, color: "#6366F1" },
];

function getStatusMeta(status: OrderStatusType, failed: boolean, message?: string) {
  if (failed || status === "fulfillment_failed") {
    return { color: "#EF4444", glow: "rgba(239,68,68,0.15)", label: "Delivery Failed", sub: message || "Something went wrong with your order", badge: "Failed" };
  }
  if (status === "fulfilled") {
    return { color: "#10B981", glow: "rgba(16,185,129,0.12)", label: "Order Delivered!", sub: "Your bundle has been successfully activated", badge: "Complete" };
  }
  if (status === "processing") {
    return { color: "#8B5CF6", glow: "rgba(139,92,246,0.12)", label: "Tracking Order", sub: message || "Order is being transmitted to network", badge: "Live" };
  }
  if (status === "paid") {
    return { color: "#F59E0B", glow: "rgba(245,158,11,0.12)", label: "Tracking Order", sub: "Preparing your order for fulfillment", badge: "Queued" };
  }
  if (status === "not_paid") {
    return { color: "#FBBF24", glow: "rgba(251,191,36,0.10)", label: "Payment Not Found", sub: message || "We couldn't find a successful transaction for this reference.", badge: "Awaiting" };
  }
  if (status === "error") {
    return { color: "#EF4444", glow: "rgba(239,68,68,0.10)", label: "System Error", sub: message || "There was a problem connecting to the gateway.", badge: "Error" };
  }
  return { color: "#6366F1", glow: "rgba(99,102,241,0.10)", label: "Verifying Payment", sub: message || "Waiting for secure payment confirmation...", badge: "Pending" };
}

const OrderStatus = () => {
  const navigate = useNavigate();
  const { isDark } = useAppTheme();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref") || "";
  const network = searchParams.get("network") || "";
  const packageSize = searchParams.get("package") || "";
  const phone = searchParams.get("phone") || "";

  const [orderStatus, setOrderStatus] = useState<OrderStatusType>("pending");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const redirectedRef = useRef(false);

  const meta = getStatusMeta(orderStatus, failed, statusMessage);

  const pollStatus = async () => {
    if (!reference) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { reference },
      });

      if (error || !data) throw error || new Error("Failed to fetch status");

      handleStatusUpdate(data.status, data.message || data.error);
    } catch (err: any) {
      console.error("Polling error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStatusUpdate = (status: OrderStatusType, message?: string) => {
    setOrderStatus(status);
    if (message) setStatusMessage(message);

    if (status === "fulfillment_failed") {
      setFailed(true);
      return;
    }

    if (status === "fulfilled" && !redirectedRef.current) {
      redirectedRef.current = true;
      setTimeout(() => {
        navigate(`/purchase-success?reference=${reference}`);
      }, 3000);
    }
  };

  useEffect(() => {
    if (!reference) return;

    pollStatus();

    const channel = supabase
      .channel(`order_status_${reference}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${reference}` },
        (payload) => {
          if (payload.new.status) {
            handleStatusUpdate(payload.new.status as OrderStatusType, payload.new.message || payload.new.failure_reason);
          }
        }
      )
      .subscribe();

    const interval = setInterval(pollStatus, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [reference]);

  const copyRef = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    toast.success("Reference Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const step = orderStatus === "fulfilled" ? 3 : (orderStatus === "processing" || orderStatus === "paid" ? 2 : 1);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-sans antialiased">
      <div className="w-full max-w-[340px]">
        {/* Cute Minimalist Card */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white/[0.03] border border-white/10 backdrop-blur-3xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
          
          {/* Top Badge */}
          <div className="px-8 pt-8 flex justify-center">
            <div className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: meta.color }} />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                {meta.badge}
              </span>
            </div>
          </div>

          <div className="px-8 pt-8 pb-10 flex flex-col items-center text-center">
            <div className="relative mb-6">
               <div className="absolute inset-0 blur-xl opacity-20 animate-pulse" style={{ backgroundColor: meta.color }} />
               <div className="relative w-10 h-10 rounded-2xl border border-white/5 flex items-center justify-center bg-white/[0.03]">
                  {orderStatus === "fulfilled" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : failed ? (
                    <XCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" />
                  )}
               </div>
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight mb-1">
               {meta.label}
            </h2>
            <p className="text-[10px] text-white/30 font-medium max-w-[200px]">
              {meta.sub}
            </p>

            {(network || phone) && (
              <div className="mt-6 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-tighter">{network}</span>
                <span className="text-[9px] font-bold text-white/20">{packageSize}</span>
                <span className="text-[9px] font-mono text-white/20">{phone}</span>
              </div>
            )}
          </div>

          {/* Minimalist Progress Line */}
          <div className="px-10 pb-8">
             <div className="relative h-[1.5px] bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out"
                  style={{ 
                    width: `${Math.max(15, (step / 3) * 100)}%`,
                    backgroundColor: meta.color
                  }}
                />
             </div>
             <div className="flex justify-between mt-3">
                {STEPS.map((s, i) => {
                  const isActive = step >= i + 1;
                  return (
                    <div key={s.key} className="flex flex-col items-center gap-1.5">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-700",
                        isActive ? "scale-110 shadow-[0_0_8px_rgba(255,255,255,0.2)]" : "bg-white/5"
                      )} style={{ backgroundColor: isActive ? s.color : undefined }} />
                      <span className={cn(
                        "text-[7px] font-bold uppercase tracking-tighter",
                        isActive ? "text-white/40" : "text-white/10"
                      )}>
                        {s.key}
                      </span>
                    </div>
                  );
                })}
             </div>
          </div>

          {/* Reference & Copy */}
          <div className="bg-white/[0.01] px-6 py-4 flex items-center justify-between gap-3 border-t border-white/5">
            <div className="min-w-0">
               <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest mb-0.5">Reference</p>
               <code className="text-[10px] font-mono text-white/20 truncate block">{reference || 'No reference'}</code>
            </div>
            <button 
              onClick={copyRef}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
            >
              <Copy className="w-3 h-3 text-white/30" />
              <span className="text-[9px] font-bold text-white/30 uppercase">Copy</span>
            </button>
          </div>

          {/* Secure Guest Search */}
          <div className="mt-8 pt-6 border-t border-white/5 space-y-4 px-6 pb-6">
             <div className="relative group">
                <input 
                  type="tel"
                  placeholder="Find another order (phone)..."
                  className="w-full py-3 px-4 rounded-2xl bg-black/20 border border-white/5 text-[10px] text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 transition-all"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const rawInput = (e.currentTarget as HTMLInputElement).value.trim();
                      if (!rawInput) return;
                      const sanitized = rawInput.replace(/\D+/g, "");
                      if (sanitized.length < 9) {
                        toast.error("Please enter a valid phone number");
                        return;
                      }
                      
                      navigate(`/my-orders?phone=${sanitized}`);
                    }
                  }}
                />
               <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-50 transition-all pointer-events-none">
                 {loading ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Search className="w-3 h-3 text-white" />}
               </div>
             </div>
             
             <button 
               onClick={() => window.location.href = '/'}
               className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5"
             >
               Back to Shop
             </button>
          </div>
        </div>

        {/* Action Row */}
        <div className="mt-6 flex gap-2">
           <button 
             onClick={pollStatus}
             disabled={isRefreshing || orderStatus === "fulfilled"}
             className="flex-1 h-12 rounded-[1.2rem] bg-white/5 border border-white/5 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-20"
           >
             <RefreshCw className={cn("w-3.5 h-3.5 text-white/20", isRefreshing && "animate-spin")} />
             <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Refresh</span>
           </button>
           
           <button 
             onClick={() => window.open("https://wa.me/233540000000", "_blank")}
             className="w-12 h-12 rounded-[1.2rem] bg-white/5 border border-white/5 flex items-center justify-center"
           >
             <Info className="w-4 h-4 text-white/20" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default OrderStatus;
