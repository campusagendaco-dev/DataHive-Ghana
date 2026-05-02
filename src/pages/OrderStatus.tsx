import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2, XCircle, Loader2, ShieldCheck, Zap,
  Activity, Copy, Check, RefreshCw, ArrowLeft,
  Search, Info, Database, SignalHigh
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokePublicFunction } from "@/lib/public-function-client";
import PhoneOrderTracker from "@/components/PhoneOrderTracker";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

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
    return { color: "#8B5CF6", glow: "rgba(139,92,246,0.12)", label: "Live Delivery", sub: message || "Order is being transmitted to network", badge: "Processing" };
  }
  if (status === "paid") {
    return { color: "#F59E0B", glow: "rgba(245,158,11,0.12)", label: "Payment Verified", sub: "Preparing your order for fulfillment", badge: "Queued" };
  }
  if (status === "not_paid") {
    return { color: "#FBBF24", glow: "rgba(251,191,36,0.10)", label: "Payment Not Found", sub: message || "We couldn't find a successful transaction for this reference.", badge: "Awaiting" };
  }
  if (status === "error") {
    return { color: "#EF4444", glow: "rgba(239,68,68,0.10)", label: "System Error", sub: message || "There was a problem connecting to the payment gateway.", badge: "Retry Needed" };
  }
  return { color: "#6366F1", glow: "rgba(99,102,241,0.10)", label: "Verifying Payment", sub: message || "Waiting for Paystack confirmation...", badge: "Pending" };
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
  const [providerId, setProviderId] = useState<string>("");
  const [orderType, setOrderType] = useState<string>("data");
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scannerStats, setScannerStats] = useState<any>(null);
  const [statusLog, setStatusLog] = useState<{ time: string; msg: string; icon: any }[]>([]);
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const redirectedRef = useRef(false);

  const addLog = (msg: string, icon: any = Activity) => {
    setStatusLog(prev => {
      if (prev.some(l => l.msg === msg)) return prev;
      return [{ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg, icon }, ...prev].slice(0, 5);
    });
  };

  const handleStatusUpdate = (status: OrderStatusType, message?: string, pId?: string, scanner?: any) => {
    setOrderStatus(status);
    if (message) setStatusMessage(message);
    if (pId) setProviderId(pId);
    if (scanner) setScannerStats(scanner);

    if (status === "paid") addLog("Payment confirmed & verified", ShieldCheck);
    if (status === "processing") addLog("Connected to delivery gateway", Zap);
    if (message?.toLowerCase().includes("waiting")) addLog("In provider queue", Database);
    if (message?.toLowerCase().includes("processing")) addLog("Transmitting to network", SignalHigh);
    if (status === "fulfilled") addLog("Bundle activated successfully", CheckCircle2);
    if (status === "fulfillment_failed") addLog("Delivery retry scheduled", RefreshCw);

    if (status === "fulfillment_failed") {
      setFailed(true);
      return;
    }

    if (status === "fulfilled" && !redirectedRef.current) {
      redirectedRef.current = true;
      toast.success("Purchase Successful!", {
        description: "Your bundle has been delivered instantly.",
        duration: 5000,
      });
      const params = new URLSearchParams({ reference, network, package: packageSize, phone, source: "checkout" });
      setTimeout(() => navigate(`/purchase-success?${params.toString()}`, { replace: true }), 500);
    }
  };

  const pollStatus = async (isManual = false) => {
    if (!reference) return;
    try {
      if (isManual) setIsRefreshing(true);
      const { data, error } = await invokePublicFunction("verify-payment", { body: { reference } });
      
      if (error) {
         setStatusMessage("Connection unstable. Retrying...");
         return;
      }

      if (data?.status) {
        if (data.order_type) setOrderType(data.order_type);
        handleStatusUpdate(data.status as OrderStatusType, data.message || data.error, data.provider_order_id, data.scanner_data);
      } else if (data?.error) {
        setStatusMessage(data.error);
      }
    } catch (err) {
      console.error("[OrderStatus] Poll error:", err);
    } finally {
      setInitialCheckDone(true);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!reference) return;

    // Realtime subscription
    const ch = supabase
      .channel(`order-status-${reference}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${reference}` },
        (payload: any) => {
          if (payload.new?.status) handleStatusUpdate(payload.new.status as OrderStatusType, payload.new.failure_reason, payload.new.provider_order_id);
        }
      )
      .subscribe();

    channelRef.current = ch;
    
    pollStatus();
    const timer = setInterval(() => pollStatus(), 4000);

    return () => {
      clearInterval(timer);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [reference]);

  const manualCheck = () => pollStatus(true);

  const copyRef = () => {
    navigator.clipboard.writeText(reference).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const meta = getStatusMeta(orderStatus, failed, statusMessage);
  const step = orderStatus === "fulfilled" ? 3 : (orderStatus === "processing" ? 2 : (orderStatus === "paid" ? 1 : 0));

  return (
    <div className="min-h-screen bg-[#020205] pt-24 pb-20 px-4 relative overflow-hidden font-sans">
      <div 
        className="fixed inset-0 pointer-events-none transition-all duration-[2000ms] opacity-40"
        style={{ 
          background: `radial-gradient(circle at 50% -20%, ${meta.color}50 0%, transparent 60%), 
                      radial-gradient(circle at 0% 100%, #6366F120 0%, transparent 40%)` 
        }}
      />
      
      <div className="relative container mx-auto max-w-lg z-10">
        <button
          onClick={() => navigate("/")}
          className="mb-8 flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-[10px] font-black uppercase tracking-[0.2em]"
        >
          <ArrowLeft className="w-3 h-3" />
          Return Home
        </button>

        <div 
          className="relative rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.8)]"
          style={{ 
            background: "rgba(10,10,18,0.8)",
            backdropFilter: "blur(24px) saturate(1.8)",
            WebkitBackdropFilter: "blur(24px) saturate(1.8)"
          }}
        >
          <div className="flex items-center justify-between px-8 pt-7 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <img src="/logo.png" alt="" className="w-5 h-5 opacity-70" />
              </div>
              <div>
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.15em] leading-none">SwiftData GH</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-1 h-1 rounded-full ${!failed && step < 3 ? "animate-pulse" : ""}`} style={{ backgroundColor: meta.color }} />
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Secure Link Active</p>
                </div>
              </div>
            </div>

            <div 
              className="px-4 py-1.5 rounded-full flex items-center gap-2 border"
              style={{ background: `${meta.color}15`, borderColor: `${meta.color}30` }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: meta.color }}>
                {meta.badge}
              </span>
            </div>
          </div>

          <div className="px-8 pt-6 pb-10 flex flex-col items-center text-center">
            <div className="relative mb-10">
              <div 
                className={`absolute inset-0 rounded-full blur-[60px] opacity-20 transition-all duration-1000 scale-[1.5]`}
                style={{ backgroundColor: meta.color }}
              />
              
              <div className="relative w-32 h-32 rounded-[2.5rem] flex items-center justify-center border-2 overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, ${meta.color}20 0%, transparent 100%)`,
                  borderColor: `${meta.color}40`
                }}
              >
                {!initialCheckDone ? (
                  <Loader2 className="w-14 h-14 animate-spin text-white/20" />
                ) : orderStatus === "fulfilled" ? (
                  <CheckCircle2 className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                ) : failed ? (
                  <XCircle className="w-16 h-16 text-red-400" />
                ) : (
                  <div className="relative flex items-center justify-center">
                     <Activity className="w-16 h-16 opacity-10 animate-pulse" style={{ color: meta.color }} />
                     <div className="absolute inset-0 flex items-center justify-center">
                        <SignalHigh className="w-10 h-10 animate-bounce" style={{ color: meta.color, animationDuration: "2s" }} />
                     </div>
                  </div>
                )}
              </div>
            </div>

            <h2 className="text-3xl font-black text-white tracking-tight leading-tight mb-2">
              {meta.label}
            </h2>
            <p className="text-sm text-white/40 font-medium max-w-[280px]">
              {meta.sub}
            </p>

            {(network || phone) && (
              <div className="mt-8 flex items-center gap-1 p-1 pr-3 rounded-full bg-white/[0.03] border border-white/5">
                <div className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-black text-white/80 uppercase tracking-widest border border-white/5">
                  {network}
                </div>
                <span className="text-xs text-white/40 font-bold ml-1">{packageSize}</span>
                <span className="text-white/10 text-xs mx-1">·</span>
                <span className="text-xs font-mono text-white/30">{phone}</span>
              </div>
            )}
          </div>

          <div className="px-8 pb-8 space-y-6">
             <div className="relative flex justify-between">
                <div className="absolute top-[18px] left-[15%] right-[15%] h-[2px] bg-white/5">
                  <div 
                    className="h-full transition-all duration-[2000ms] ease-out"
                    style={{ 
                      width: `${(step / 3) * 100}%`,
                      background: `linear-gradient(90deg, transparent 0%, ${meta.color} 50%, ${meta.color} 100%)`,
                      boxShadow: `0 0 10px ${meta.color}80`
                    }}
                  />
                </div>

                {STEPS.map((s, i) => {
                  const isActive = step >= i + 1;
                  return (
                    <div key={s.key} className="relative z-10 flex flex-col items-center gap-3">
                      <div 
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center border-2 transition-all duration-700 ${isActive ? "scale-110 shadow-lg" : "opacity-30"}`}
                        style={{ 
                          background: isActive ? `${s.color}20` : "transparent",
                          borderColor: isActive ? s.color : "rgba(255,255,255,0.1)"
                        }}
                      >
                        <s.icon className="w-4 h-4" style={{ color: isActive ? s.color : "white" }} />
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-700 ${isActive ? "text-white" : "text-white/20"}`}>
                        {s.key}
                      </span>
                    </div>
                  );
                })}
             </div>
          </div>


          <div className="mx-8 mb-8 space-y-3">
             <div className="flex items-center gap-2 mb-1">
                <Search className="w-3 h-3 text-white/20" />
                <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Live Activity</span>
             </div>
             
             <div className="space-y-2">
                {statusLog.length > 0 ? (
                  statusLog.map((log, i) => (
                    <div key={i} className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-500" style={{ opacity: 1 - (i * 0.15) }}>
                       <div className="w-6 h-6 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-center shrink-0">
                          <log.icon className="w-3 h-3 text-white/40" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-white/60 truncate">{log.msg}</p>
                       </div>
                       <span className="text-[9px] font-mono text-white/15 shrink-0">{log.time}</span>
                    </div>
                  ))
                ) : (
                  <div className="py-2 flex items-center gap-3 opacity-20">
                     <div className="w-6 h-6 rounded-lg border border-dashed border-white/20 flex items-center justify-center">
                        <Loader2 className="w-3 h-3 animate-spin" />
                     </div>
                     <p className="text-[11px] font-medium">Initializing secure connection...</p>
                  </div>
                )}
             </div>
          </div>

          <div className="bg-white/[0.02] px-8 py-5 flex items-center justify-between gap-4 border-t border-white/5">
            <div className="min-w-0">
               <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Order Reference</p>
               <code className="text-[11px] font-mono text-white/40 truncate block">{reference}</code>
            </div>
            <button 
              onClick={copyRef}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
           <button 
             onClick={manualCheck}
             disabled={isRefreshing || orderStatus === "fulfilled"}
             className="flex-1 h-14 rounded-[1.5rem] bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-30"
           >
             {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin text-white/40" /> : <RefreshCw className="w-4 h-4 text-white/40" />}
             <span className="text-xs font-black text-white/70 uppercase tracking-widest">Manual Refresh</span>
           </button>
           
           <button 
             onClick={() => window.open("https://wa.me/233540000000", "_blank")}
             className="w-14 h-14 rounded-[1.5rem] bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all active:scale-95"
           >
             <Info className="w-5 h-5 text-white/40" />
           </button>
        </div>

        <div className="mt-12 opacity-80">
          <PhoneOrderTracker 
            title="Search History"
            subtitle="Track any number's recent bundles"
            defaultPhone={phone || undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default OrderStatus;
