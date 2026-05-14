import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Shield, Brain, Activity, History, Settings,
  ChevronRight, AlertCircle, CheckCircle2, Cpu,
  RefreshCw, TrendingUp, Search, MessageSquare, Bell,
  Sparkles, Bot, AlertTriangle, Play, Terminal,
  Database, Fingerprint, Lock, ShieldAlert, Skull,
  Rocket, Gift, LineChart, Target, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface SentinelAction {
  id: string;
  ts: string;
  action_type: string;
  status: string;
  reasoning: string;
  effectiveness: number;
  metadata: any;
}

interface SentinelStrategy {
  id: string;
  name: string;
  confidence_score: number;
  is_active: boolean;
  version: number;
}

const AdminSentinelAI = () => {
  const [actions, setActions] = useState<SentinelAction[]>([]);
  const [strategies, setStrategies] = useState<SentinelStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchSentinelData = async () => {
    try {
      const { data: actionData } = await supabase
        .from("sentinel_actions")
        .select("*")
        .order("ts", { ascending: false })
        .limit(10);
      
      const { data: strategyData } = await supabase
        .from("sentinel_strategies")
        .select("*")
        .order("confidence_score", { ascending: false });

      if (actionData) setActions(actionData);
      if (strategyData) setStrategies(strategyData);
    } catch (error) {
      console.error("Failed to fetch sentinel data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentinelData();

    // Real-time subscription for actions
    const channel = supabase
      .channel("sentinel_changes")
      .on("postgres_changes", { event: "INSERT", table: "sentinel_actions" }, (payload) => {
        setActions((prev) => [payload.new as SentinelAction, ...prev].slice(0, 10));
        toast.info(`Sentinel: ${payload.new.action_type} action executed`);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const triggerSentinel = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sentinel-ai");
      if (error) throw error;
      toast.success(data.message || "Sentinel analysis complete");
      fetchSentinelData();
    } catch (error: any) {
      toast.error("Failed to trigger Sentinel: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-800 pb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 rounded-full border-2 border-dashed border-cyan-500/30 flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full border-2 border-cyan-400/50 flex items-center justify-center bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                <Brain className="w-6 h-6 text-cyan-400" />
              </div>
            </motion.div>
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-[#020617]"
            />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic flex items-center gap-2">
              The Sentinel <span className="text-cyan-500 text-lg not-italic font-bold">v2.0 CORE</span>
            </h1>
            <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" /> 
              Autonomous Platform Guard • System Health: <span className="text-emerald-400">OPTIMAL</span>
            </p>
          </div>
        </div>

        <button 
          onClick={triggerSentinel}
          disabled={isProcessing}
          className="relative group px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-black text-sm transition-all overflow-hidden shadow-lg shadow-cyan-500/20"
        >
          <div className="flex items-center gap-2 relative z-10">
            {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
            RUN ANALYTIC CORE
          </div>
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        </button>
      </div>

      {/* Dual Core Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sentinel Core (Gemini) */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-6 rounded-3xl border border-slate-800 bg-slate-900/50 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 text-cyan-500/10 group-hover:text-cyan-500/20 transition-colors">
            <Brain className="w-16 h-16" />
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
              <Brain className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white uppercase italic">
                Sentinel Core
              </h3>
              <p className="text-xs text-cyan-500 font-bold uppercase tracking-widest">Model: Gemini 1.5 Flash</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className="text-slate-500">Processing Speed</span>
              <span className="text-cyan-400">98.4%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "98.4%" }}
                className="h-full bg-cyan-500 shadow-[0_0_12px_rgba(34,211,238,0.5)]"
              />
            </div>
            <p className="text-[10px] text-slate-500 italic font-medium leading-relaxed">
              "Patrolling system_logs... No critical anomalies detected in the current minute."
            </p>
          </div>
        </motion.div>

        {/* Oracle Core (Anthropic) */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-6 rounded-3xl border border-slate-800 bg-slate-900/50 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 text-purple-500/10 group-hover:text-purple-500/20 transition-colors">
            <Bot className="w-16 h-16" />
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
              <Bot className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white uppercase italic">
                Oracle Core
              </h3>
              <p className="text-xs text-purple-500 font-bold uppercase tracking-widest">Model: Claude Haiku 4.5</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
              <span className="text-slate-500">Reasoning Depth</span>
              <span className="text-purple-400">99.2%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "99.2%" }}
                className="h-full bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.5)]"
              />
            </div>
            <p className="text-[10px] text-slate-500 italic font-medium leading-relaxed">
              "Standing by for complex diagnostic verification and second opinions."
            </p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Thoughts & Knowledge */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white uppercase tracking-widest">Active Intelligence</h3>
          </div>
          
          <div className="space-y-4">
            {strategies.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-800 rounded-3xl text-center">
                <Bot className="w-8 h-8 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 text-xs">No active strategies evolving...</p>
              </div>
            ) : strategies.map((s) => (
              <motion.div 
                key={s.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/50 transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-[10px] font-black tracking-widest uppercase">
                    STRATEGY v{s.version}
                  </Badge>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    Confidence: {(s.confidence_score * 100).toFixed(0)}%
                  </div>
                </div>
                <p className="text-sm font-bold text-white mb-2 leading-tight">{s.name}</p>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${s.confidence_score * 100}%` }}
                    className={cn(
                      "h-full rounded-full transition-all",
                      s.confidence_score > 0.8 ? "bg-emerald-500" : s.confidence_score > 0.5 ? "bg-cyan-500" : "bg-amber-500"
                    )}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Budget Guardian */}
          <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/40 relative overflow-hidden">
             <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2">
                 <DollarSign className="w-5 h-5 text-emerald-400" />
                 <h4 className="text-sm font-black text-white uppercase tracking-widest">Budget Guardian</h4>
               </div>
               <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px]">SECURE</Badge>
             </div>
             
             <div className="space-y-4">
               <div className="flex justify-between items-end">
                 <div>
                   <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Monthly Spend</p>
                   <p className="text-2xl font-black text-white">$0.42 <span className="text-xs text-slate-500 font-medium">/ $10.00</span></p>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] text-emerald-500 font-black uppercase">4.2% Used</p>
                 </div>
               </div>

               <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: "4.2%" }}
                   className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                 />
               </div>

               <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                 <p className="text-[10px] text-emerald-400 font-medium">
                   AI operations are currently 95% below budget.
                 </p>
               </div>
             </div>
          </div>

          <Card className="bg-cyan-950/20 border-cyan-500/20 shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-cyan-100 uppercase tracking-widest mb-1">PRO NOTIFICATIONS</h4>
                  <p className="text-[10px] text-cyan-400/70 font-medium leading-relaxed">
                    Administrative alerts are currently active via SMS and Email. The Sentinel will automatically notify you of any critical provider failures or balance drops.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Growth Lab Preview */}
          <div className="p-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
            <div className="flex items-center gap-2 mb-4">
              <Rocket className="w-5 h-5 text-indigo-400" />
              <h4 className="text-sm font-black text-white uppercase tracking-widest">Growth Lab</h4>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Auto-Promos</span>
                </div>
                <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px]">ACTIVE</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">VIP Tiering</span>
                </div>
                <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px]">MONITORING</Badge>
              </div>
              <button className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-[9px] font-black text-indigo-400 uppercase tracking-widest transition-all">
                Open Strategy Lab
              </button>
            </div>
          </div>
        </div>

        {/* Center/Right Columns: Action Stream */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-bold text-white uppercase tracking-widest">Autonomous Action Stream</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase">Live Feed</span>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {actions.map((action, i) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden hover:bg-slate-900/60 transition-all border-l-4 border-l-cyan-500"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
                          action.effectiveness === 1 ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/10" : 
                          action.effectiveness === -1 ? "bg-rose-500/10 text-rose-500 shadow-rose-500/10" : 
                          "bg-cyan-500/10 text-cyan-500 shadow-cyan-500/10"
                        )}>
                          {action.action_type === 'switch_provider' ? <RefreshCw className="w-5 h-5" /> : 
                           action.action_type === 'notify_admin' ? <Bell className="w-5 h-5" /> :
                           <Settings className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="text-base font-black text-white uppercase italic tracking-tight leading-none mb-1">
                            {action.action_type.replace('_', ' ')}
                          </h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">
                            {new Date(action.ts).toLocaleString()} • STATUS: <span className={cn(
                              action.status === 'executed' ? "text-emerald-500" : "text-amber-500"
                            )}>{action.status}</span>
                          </p>
                        </div>
                      </div>
                      <Badge className={cn(
                        "text-[10px] font-black tracking-widest px-3 py-1",
                        action.effectiveness === 1 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : 
                        action.effectiveness === -1 ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : 
                        "bg-slate-800 text-slate-400 border-slate-700"
                      )}>
                        {action.effectiveness === 1 ? "ELITE RESOLUTION" : 
                         action.effectiveness === -1 ? "FLAWED ATTEMPT" : "PENDING EVAL"}
                      </Badge>
                    </div>

                    <div className="bg-black/20 rounded-xl p-4 border border-slate-800/50">
                       <p className="text-xs text-slate-300 font-medium leading-relaxed italic">
                         <span className="text-cyan-500 font-bold mr-2">LOGIC:</span>
                         {action.reasoning}
                       </p>
                    </div>

                    {action.metadata && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {Object.entries(action.metadata).map(([k, v]) => (
                          <div key={k} className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-500 uppercase">{k}:</span>
                            <span className="text-[10px] font-bold text-cyan-300 truncate max-w-[150px]">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <h3 className="text-lg font-bold text-white uppercase tracking-widest">Security Audit Feed</h3>
            </div>

            <div className="p-6 rounded-3xl border border-slate-800 bg-slate-900/50">
              <div className="flex flex-col items-center justify-center py-10 text-slate-600">
                <Skull className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">No Threats Detected in the last 24h</p>
                <p className="text-[8px] font-bold text-emerald-500 mt-2 uppercase">Firewall: ACTIVE</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSentinelAI;
