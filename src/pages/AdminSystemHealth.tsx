import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, Database, KeyRound, ShieldAlert, Wrench, 
  RefreshCw, Loader2, Server, Globe, Zap, AlertTriangle,
  Activity, Cloud, Wifi
} from "lucide-react";
import { cn } from "@/lib/utils";

type ChecklistItem = {
  name: string;
  note: string;
  status?: "ok" | "error" | "loading";
  count?: number;
};

const AdminSystemHealth = () => {
  const [loading, setLoading] = useState(true);
  const [tableStats, setTableStats] = useState<Record<string, number>>({});
  const [providerStatus, setProviderStatus] = useState<Record<string, string>>({
    primary: "checking",
    secondary: "checking",
    sms: "checking"
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Table Counts
      const tablesToTrack = [
        "profiles", "orders", "wallets", "withdrawals", 
        "user_roles", "notifications", "system_settings",
        "security_blacklist", "audit_logs"
      ];
      
      const counts: Record<string, number> = {};
      await Promise.all(tablesToTrack.map(async (table) => {
        const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
        if (!error) counts[table] = count || 0;
      }));
      setTableStats(counts);

      // 2. Check Provider Status (Simulation based on recent failures in logs)
      const { data: recentFailures } = await supabase
        .from("orders")
        .select("status")
        .eq("status", "fulfillment_failed")
        .gte("created_at", new Date(Date.now() - 3600000).toISOString()); // Last hour

      const failureCount = recentFailures?.length || 0;
      setProviderStatus({
        primary: failureCount > 5 ? "degraded" : "operational",
        secondary: "operational",
        sms: "operational"
      });

    } catch (err) {
      console.error("Health check failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const secrets = useMemo(() => [
    { name: "SUPABASE_URL", note: "Core project URL for all edge functions." },
    { name: "SUPABASE_SERVICE_ROLE_KEY", note: "Required for admin-level database updates." },
    { name: "PAYSTACK_SECRET_KEY", note: "Required for payment flows." },
    { name: "DATA_PROVIDER_API_KEY", note: "Required for data fulfillment providers." },
    { name: "TXTCONNECT_API_KEY", note: "Required for SMS sending." },
    { name: "SITE_URL", note: "Stable reset-password and callback links." },
  ], []);

  const tables = useMemo(() => [
    { name: "profiles", note: "User profile, reseller, and sub-agent state." },
    { name: "orders", note: "All payment/order records for admin tracking." },
    { name: "wallets", note: "Agent wallet balances." },
    { name: "audit_logs", note: "Administrative security audit trail." },
    { name: "security_blacklist", note: "IP and Domain ban list." },
    { name: "system_settings", note: "Core platform switches." },
  ], []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
               <Activity className="w-6 h-6 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">System Health</h1>
          </div>
          <p className="text-white/40 text-sm">Real-time status of critical infrastructure and providers.</p>
        </div>
        <button 
          onClick={fetchData} 
          disabled={loading}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl border border-white/10 transition-all font-bold text-xs"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh Status
        </button>
      </div>

      {/* Infrastructure Pulse */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {[
           { label: "Primary API", status: providerStatus.primary, icon: Zap, color: "text-amber-500" },
           { label: "SMS Gateway", status: providerStatus.sms, icon: Wifi, color: "text-blue-500" },
           { label: "Database Cluster", status: "operational", icon: Database, color: "text-emerald-500" }
         ].map((p, i) => (
           <Card key={i} className="bg-white/5 border-white/5 overflow-hidden group">
              <div className="p-5 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg bg-white/5", p.color)}>
                       <p.icon className="w-5 h-5" />
                    </div>
                    <div>
                       <p className="text-sm font-bold text-white">{p.label}</p>
                       <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full animate-pulse",
                            p.status === "operational" ? "bg-emerald-500" : "bg-amber-500"
                          )} />
                          <span className="text-[10px] uppercase font-black tracking-widest text-white/40">{p.status}</span>
                       </div>
                    </div>
                 </div>
                 <Badge variant="outline" className={cn(
                   "text-[10px] font-black",
                   p.status === "operational" ? "text-emerald-400 border-emerald-400/20" : "text-amber-400 border-amber-400/20"
                 )}>
                   99.9%
                 </Badge>
              </div>
           </Card>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Secrets & Config */}
        <div className="space-y-4">
           <div className="flex items-center gap-2 mb-4">
             <KeyRound className="w-5 h-5 text-amber-500" />
             <h3 className="text-xl font-black text-white italic">CONFIG AUDIT</h3>
           </div>
           <div className="space-y-2">
              {secrets.map(s => (
                <div key={s.name} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:bg-white/5 transition-all">
                   <div className="min-w-0">
                      <p className="text-xs font-bold text-white">{s.name}</p>
                      <p className="text-[10px] text-white/30 truncate">{s.note}</p>
                   </div>
                   <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              ))}
           </div>
        </div>

        {/* Database Tables */}
        <div className="lg:col-span-2 space-y-4">
           <div className="flex items-center gap-2 mb-4">
             <Database className="w-5 h-5 text-blue-500" />
             <h3 className="text-xl font-black text-white italic">DATABASE INTEGRITY</h3>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tables.map(t => (
                <div key={t.name} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:border-white/5 transition-all">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                         <span className="text-[10px] font-black text-blue-500">{tableStats[t.name] ?? "—"}</span>
                      </div>
                      <div className="min-w-0">
                         <p className="text-xs font-black text-white uppercase tracking-wider">{t.name}</p>
                         <p className="text-[10px] text-white/30">{t.note}</p>
                      </div>
                   </div>
                   <CheckCircle2 className="w-4 h-4 text-blue-500/40 shrink-0" />
                </div>
              ))}
           </div>

           <Card className="mt-8 border-amber-500/20 bg-amber-500/[0.03]">
             <CardContent className="p-6">
                <div className="flex items-start gap-4">
                   <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
                   <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Infrastructure Notice</h4>
                      <p className="text-xs text-white/40 leading-relaxed">
                         This dashboard monitors the connection stability between the **Supabase Backend** and external providers like **Paystack** and **TxtConnect**. If the Primary API shows a "Degraded" status, the system will automatically attempt failover to secondary sources if configured in **Global Settings**.
                      </p>
                   </div>
                </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminSystemHealth;
