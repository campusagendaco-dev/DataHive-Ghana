import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Zap, ShieldCheck, Activity, Search, 
  Package, CheckCircle2, Loader2, SignalHigh,
  Clock, ArrowRight, Server, Database
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TrackerData {
  status: string;
  data: {
    message: string;
    scanner: { active: boolean; waiting: boolean; waitSeconds: number };
    stats: { checked: number; delivered: number; partial: number; pending: number; failed: number };
    lastDelivered: { trackingId: string; summary: string } | null;
    checkingNow: { summary: string };
    yourOrders: {
      inCurrentBatch: Array<{ phone: string; network: string; capacity: number; deliveryStatus: string }>;
      inLastDeliveredBatch: Array<{ phone: string; network: string; capacity: number; deliveryStatus: string }>;
    }
  }
}

const DeliveryTracker = () => {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      const { data: res, error } = await supabase.functions.invoke("delivery-tracker");
      if (error) throw error;
      setData(res);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Tracker fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Polling every 10s for live feel
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
          <p className="text-amber-500/40 text-[10px] font-black uppercase tracking-[0.3em]">Connecting to Scanner...</p>
        </div>
      </div>
    );
  }

  const stats = data?.data.stats;
  const scanner = data?.data.scanner;

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-amber-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-lg mx-auto px-6 pt-24 pb-20">
        
        {/* --- Header & Live Indicator --- */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight mb-1">Live Scanner</h1>
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest flex items-center gap-2">
              <Server className="w-3 h-3" /> System Node 01 • Ghana
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute inset-0" />
              <div className="w-2 h-2 rounded-full bg-emerald-500 relative" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Status</span>
          </div>
        </div>

        {/* --- Main Scanner Card --- */}
        <div className="relative group mb-8">
           <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 to-orange-500/10 rounded-[2.5rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
           <div className="relative rounded-[2.5rem] border border-white/10 bg-[#0A0A0C]/80 backdrop-blur-3xl overflow-hidden shadow-2xl">
              
              {/* Card Header */}
              <div className="p-8 pb-4">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                          <Activity className={cn("w-6 h-6 text-amber-500", scanner?.active && "animate-pulse")} />
                       </div>
                       <div>
                          <h3 className="font-bold text-base">Network Scanner</h3>
                          <p className="text-[10px] text-white/40 font-medium">Auto-verifying delivery states</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">Last Sync</p>
                       <p className="text-[10px] font-mono text-white/40">{lastUpdate.toLocaleTimeString([], { hour12: false })}</p>
                    </div>
                 </div>

                 {/* Pulse Indicator */}
                 <div className="relative h-24 flex items-center justify-center mb-8">
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                       <div className="w-full h-[1px] bg-white/20" />
                    </div>
                    <AnimatePresence mode="wait">
                       <motion.div 
                         key={data?.data.checkingNow.summary}
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         exit={{ opacity: 0, y: -10 }}
                         className="relative z-10 px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center"
                       >
                          <p className="text-xs font-bold text-amber-400/80 mb-1">{data?.data.checkingNow.summary}</p>
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">Encryption Protocol Active</p>
                       </motion.div>
                    </AnimatePresence>
                 </div>

                 {/* Mini Stats Row */}
                 <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Check", val: stats?.checked, color: "text-white/40" },
                      { label: "Sent", val: stats?.delivered, color: "text-emerald-400" },
                      { label: "Wait", val: stats?.pending, color: "text-amber-400" },
                      { label: "Fail", val: stats?.failed, color: "text-red-400" },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                         <p className="text-[8px] font-black uppercase tracking-widest text-white/20 mb-1">{s.label}</p>
                         <p className={cn("text-sm font-black tracking-tight", s.color)}>{s.val}</p>
                      </div>
                    ))}
                 </div>
              </div>

              {/* Progress Line Divider */}
              <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Last Action Bar */}
              <div className="px-8 py-4 bg-white/[0.02] flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-[9px] font-medium text-white/40 italic">
                      {data?.data.lastDelivered?.summary || "Scanner warming up..."}
                    </p>
                 </div>
                 <div className="flex gap-0.5">
                    {[1,2,3].map(i => <div key={i} className="w-0.5 h-2 bg-emerald-500/20 rounded-full" />)}
                 </div>
              </div>
           </div>
        </div>

        {/* --- Batch Feed Sections --- */}
        <div className="space-y-10">
           
           {/* Current Batch */}
           <div>
              <div className="flex items-center justify-between mb-4 px-2">
                 <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">In Current Queue</h4>
                 </div>
                 <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[8px] font-black text-amber-500 uppercase">Realtime</span>
              </div>
              <div className="space-y-2">
                 <AnimatePresence>
                    {data?.data.yourOrders.inCurrentBatch.length === 0 ? (
                      <div className="p-6 rounded-3xl border border-dashed border-white/5 text-center">
                         <p className="text-[10px] text-white/20 font-medium">Queue empty. All systems normal.</p>
                      </div>
                    ) : data?.data.yourOrders.inCurrentBatch.map((o, i) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={`${o.phone}-${i}`}
                        className="flex items-center justify-between p-4 rounded-3xl bg-white/[0.02] border border-white/5 group hover:border-amber-500/20 transition-all"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center font-mono text-[9px] text-white/40">
                               {o.network.slice(0, 3)}
                            </div>
                            <div>
                               <p className="text-[11px] font-mono font-bold text-white tracking-widest">{o.phone}</p>
                               <p className="text-[8px] font-medium text-white/20">{o.capacity}GB Bundle • Queued</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="text-[9px] font-bold text-amber-500/60 uppercase">{o.deliveryStatus}</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                         </div>
                      </motion.div>
                    ))}
                 </AnimatePresence>
              </div>
           </div>

           {/* Recently Delivered */}
           <div>
              <div className="flex items-center gap-2 mb-4 px-2">
                 <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Recently Dispatched</h4>
              </div>
              <div className="space-y-2">
                 {data?.data.yourOrders.inLastDeliveredBatch.map((o, i) => (
                   <div key={`${o.phone}-del-${i}`} className="flex items-center justify-between p-4 rounded-3xl bg-white/[0.01] border border-white/5">
                      <div className="flex items-center gap-4">
                         <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-mono text-[9px] text-emerald-500/60">
                            {o.network.slice(0, 3)}
                         </div>
                         <div>
                            <p className="text-[11px] font-mono font-bold text-white/40 tracking-widest">{o.phone}</p>
                            <p className="text-[8px] font-medium text-white/10">{o.capacity}GB Bundle • Verified</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                         <span className="text-[8px] font-black text-emerald-500/60 uppercase">Sent</span>
                         <ShieldCheck className="w-2.5 h-2.5 text-emerald-500/60" />
                      </div>
                   </div>
                 ))}
              </div>
           </div>

        </div>

        {/* --- Footer Note --- */}
        <div className="mt-16 text-center">
           <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/5">
              <SignalHigh className="w-3 h-3 text-white/20" />
              <p className="text-[9px] font-medium text-white/20 tracking-wider">Secure Realtime Delivery Network</p>
           </div>
        </div>

      </div>
    </div>
  );
};

export default DeliveryTracker;
