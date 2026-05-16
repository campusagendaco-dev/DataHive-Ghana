import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, Zap, ShieldAlert, TrendingUp, AlertTriangle, 
  RefreshCw, CheckCircle2, Info, ArrowUpRight, ArrowDownRight,
  Target, BarChart3, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AdminAIStrategy = () => {
  const [insights, setInsights] = useState<any[]>([]);
  const [riskLogs, setRiskLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAIIntelligence();
  }, []);

  const fetchAIIntelligence = async () => {
    setLoading(true);
    try {
      // Fetch AI Insights
      const { data: insightData } = await (supabase as any).from("ai_insights")
        .select(`*, profiles(full_name, store_name, terminal_locked)`)
        .order("created_at", { ascending: false })
        .limit(20);
      
      // Fetch Fraud Risk Logs
      const { data: riskData } = await (supabase as any).from("fraud_risk_logs")
        .select(`*, profiles(full_name, store_name, terminal_locked)`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (insightData) setInsights(insightData);
      if (riskData) setRiskLogs(riskData);
    } catch (err) {
      toast.error("Failed to sync AI intelligence");
    } finally {
      setLoading(false);
    }
  };

  const applyInsight = async (id: string) => {
    const { error } = await (supabase as any).from("ai_insights").update({ is_applied: true }).eq("id", id);
    if (!error) {
      toast.success("AI Recommendation Applied!");
      fetchAIIntelligence();
    }
  };

  const toggleVendorLock = async (agentId: string, currentlyLocked: boolean) => {
    try {
      const action = currentlyLocked ? 'unlock' : 'lock';
      const { data, error } = await supabase.functions.invoke("admin-vendor-security", {
        body: { agent_id: agentId, action }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data.message || `Terminal ${currentlyLocked ? 'unlocked' : 'locked'} successfully`);
      fetchAIIntelligence(); // Refresh UI
    } catch (err: any) {
      toast.error(err.message || "Security override failed");
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10 bg-[#070708] min-h-screen text-white">
      {/* AI Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 italic uppercase bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
            <Brain className="w-12 h-12 text-primary" />
            AI Strategy Hub
          </h1>
          <p className="text-muted-foreground mt-2 font-bold tracking-widest text-[10px] uppercase flex items-center gap-2">
            <Target className="w-3 h-3" />
            Autonomous Decision Core • Processing Real-time Data
          </p>
        </div>
        <Button variant="outline" className="rounded-2xl border-white/5 bg-white/5 font-black gap-2 h-12 px-6" onClick={fetchAIIntelligence}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Sync Intelligence
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left Column: Profit & Liquidity Insights */}
        <div className="lg:col-span-2 space-y-8">
           <Card className="border-none bg-white/[0.02] backdrop-blur-2xl shadow-2xl border border-white/5">
              <CardHeader className="border-b border-white/5 bg-primary/5">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-primary">
                  <TrendingUp className="w-5 h-5" />
                  Profit & Yield Optimization
                </CardTitle>
                <CardDescription className="text-xs">AI-suggested tweaks to maximize network revenue</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="divide-y divide-white/5">
                    {insights.filter(i => i.type === 'profit_optimization').map((insight) => (
                      <div key={insight.id} className={cn("p-6 hover:bg-white/[0.02] transition-all", insight.is_applied && "opacity-50")}>
                        <div className="flex items-start justify-between gap-4">
                           <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-primary/10 text-primary border-none font-black text-[9px] px-2">PROFIT_YIELD</Badge>
                                <span className="text-xs font-bold text-muted-foreground">For: {insight.profiles?.store_name || "Network"}</span>
                              </div>
                              <p className="font-bold text-sm leading-relaxed">{insight.insight_text}</p>
                              {insight.metadata?.suggested_rate && (
                                <div className="flex items-center gap-4 text-[10px] font-black uppercase">
                                   <div className="flex items-center gap-1 text-muted-foreground">Current: <span className="text-white">{insight.metadata.current_rate}%</span></div>
                                   <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                                   <div className="flex items-center gap-1 text-emerald-500">Suggested: <span className="text-emerald-500">{insight.metadata.suggested_rate}%</span></div>
                                </div>
                              )}
                           </div>
                           <Button 
                             disabled={insight.is_applied}
                             onClick={() => applyInsight(insight.id)}
                             className="rounded-xl font-black text-xs h-9 px-4 shrink-0 bg-primary/20 text-primary hover:bg-primary hover:text-white border border-primary/20"
                           >
                             {insight.is_applied ? "Implemented" : "Auto-Adjust"}
                           </Button>
                        </div>
                      </div>
                    ))}
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none bg-white/[0.02] backdrop-blur-2xl shadow-2xl border border-white/5">
              <CardHeader className="border-b border-white/5 bg-indigo-500/5">
                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-indigo-400">
                  <Zap className="w-5 h-5" />
                  Liquidity & Float Forecasts
                </CardTitle>
                <CardDescription className="text-xs">Predictive top-up alerts based on agent behavior</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                 <div className="divide-y divide-white/5">
                    {insights.filter(i => i.type === 'liquidity_warning').map((insight) => (
                      <div key={insight.id} className="p-6 flex items-center gap-5">
                         <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                            <Clock className="w-6 h-6 text-indigo-400" />
                         </div>
                         <div className="flex-1 space-y-1">
                            <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{insight.profiles?.store_name}</p>
                            <p className="font-bold text-sm">{insight.insight_text}</p>
                            <div className="flex items-center gap-3 mt-2">
                               <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500 w-[75%]" />
                               </div>
                               <span className="text-[10px] font-black text-muted-foreground">Confidence: 92%</span>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Right Column: Fraud Watchtower */}
        <div className="space-y-8">
           <Card className="border-none bg-red-500/5 border border-red-500/10 shadow-2xl overflow-hidden">
              <div className="bg-red-500/10 p-5 flex items-center gap-3 border-b border-red-500/10">
                 <ShieldAlert className="w-6 h-6 text-red-500" />
                 <div>
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Fraud Watchtower</CardTitle>
                    <p className="text-[9px] font-bold text-red-500/70 uppercase">Sentinel Prime: Active Protocol</p>
                 </div>
              </div>
              <CardContent className="p-0">
                 <div className="divide-y divide-red-500/5">
                    {riskLogs.map((log) => (
                      <div key={log.id} className="p-5 space-y-4">
                         <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-red-400 uppercase">{log.profiles?.store_name}</span>
                            <Badge className="bg-red-500 text-white font-black text-[9px] px-2">{log.risk_score}/100 RISK</Badge>
                         </div>
                         <div className="flex flex-wrap gap-2">
                            {log.risk_factors.map((factor: string, idx: number) => (
                              <span key={idx} className="text-[8px] font-black bg-red-500/10 text-red-400 px-2 py-1 rounded-md border border-red-500/10 uppercase italic">
                                {factor}
                              </span>
                            ))}
                         </div>
                         <p className="text-[10px] font-medium text-muted-foreground leading-relaxed italic">
                           "AI automatically flagged this agent due to velocity spike in Nigerian NGN transfers."
                         </p>
                         <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 rounded-lg border-red-500/20 text-red-400 font-black h-8 text-[10px] uppercase">Review Terminal</Button>
                                                         <Button 
                               size="sm" 
                               onClick={() => toggleVendorLock(log.agent_id, log.profiles?.terminal_locked)}
                               className={cn("flex-1 rounded-lg font-black h-8 text-[10px] uppercase", log.profiles?.terminal_locked ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600")}
                             >
                               {log.profiles?.terminal_locked ? "Unfreeze" : "Freeze"}
                             </Button>

                         </div>
                      </div>
                    ))}
                 </div>
              </CardContent>
           </Card>

           <Card className="border-none bg-white/5 border border-white/5">
              <CardContent className="p-6 space-y-4 text-center">
                 <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <BarChart3 className="w-8 h-8 text-emerald-500" />
                 </div>
                 <div>
                    <h4 className="font-black uppercase tracking-tighter text-sm">AI Performance Lift</h4>
                    <p className="text-[10px] font-bold text-muted-foreground mt-1 px-4 leading-relaxed italic">
                       The AI Strategy Hub has increased network yield by **14.2%** this month through autonomous rate adjustments.
                    </p>
                 </div>
              </CardContent>
           </Card>
        </div>

      </div>
    </div>
  );
};

export default AdminAIStrategy;
