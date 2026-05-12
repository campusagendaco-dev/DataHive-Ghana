import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { RefreshCw, Activity, CheckCircle2, XCircle, Clock, Zap, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProviderHealth {
  provider_name: string;
  source: string;
  handler_type: string | null;
  provider_id: string | null;
  is_active: boolean | null;
  total_calls: number;
  successful_calls: number;
  rejected_calls: number;
  error_count: number;
  warn_count: number;
  avg_latency_ms: number | null;
  last_call_at: string | null;
  success_rate_pct: number | null;
}

function HealthBar({ pct }: { pct: number | null }) {
  if (pct === null) return <div className="h-1.5 bg-white/5 rounded-full w-full" />;
  const color = pct >= 95 ? "bg-green-500" : pct >= 80 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="h-1.5 bg-white/10 rounded-full w-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function StatusBadge({ pct, totalCalls }: { pct: number | null; totalCalls: number }) {
  if (totalCalls === 0) return <Badge className="text-[9px] h-4 bg-white/5 text-white/30 border-white/10">No Data</Badge>;
  if (pct === null) return <Badge className="text-[9px] h-4 bg-white/5 text-white/30 border-white/10">Unknown</Badge>;
  if (pct >= 95) return <Badge className="text-[9px] h-4 bg-green-500/15 text-green-400 border-green-500/20">Healthy</Badge>;
  if (pct >= 80) return <Badge className="text-[9px] h-4 bg-amber-500/15 text-amber-400 border-amber-500/20">Degraded</Badge>;
  return <Badge className="text-[9px] h-4 bg-red-500/15 text-red-400 border-red-500/20">Unhealthy</Badge>;
}

export default function ProviderHealthPanel() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("v_provider_health")
      .select("*")
      .order("total_calls", { ascending: false });

    if (!error) setProviders((data as ProviderHealth[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const totalCalls24h = providers.reduce((s, p) => s + (p.total_calls || 0), 0);
  const totalErrors24h = providers.reduce((s, p) => s + (p.error_count || 0), 0);
  const avgLatency = providers.filter((p) => p.avg_latency_ms).reduce((s, p, _, arr) => s + (p.avg_latency_ms || 0) / arr.length, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10 p-4">
          <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">24h API Calls</p>
          <p className="text-2xl font-black text-white mt-1">{totalCalls24h.toLocaleString()}</p>
        </Card>
        <Card className={cn("border p-4", totalErrors24h > 0 ? "bg-red-500/5 border-red-500/20" : "bg-green-500/5 border-green-500/20")}>
          <p className={cn("text-[10px] font-black uppercase tracking-widest", totalErrors24h > 0 ? "text-red-400/60" : "text-green-400/60")}>Errors</p>
          <p className={cn("text-2xl font-black mt-1", totalErrors24h > 0 ? "text-red-400" : "text-green-400")}>{totalErrors24h}</p>
        </Card>
        <Card className="bg-white/5 border-white/10 p-4">
          <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">Avg Latency</p>
          <p className="text-2xl font-black text-white mt-1">{avgLatency ? `${Math.round(avgLatency)}ms` : "—"}</p>
        </Card>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <button type="button" onClick={fetchHealth} className="flex items-center gap-1.5 text-white/30 hover:text-white text-xs transition-colors">
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Provider cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-white/20 animate-spin" />
        </div>
      ) : providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Activity className="w-10 h-10 text-white/10" />
          <p className="text-white/30 text-sm">No provider activity in the last 24 hours</p>
          <p className="text-white/20 text-xs">Health data appears after the first order is processed</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((p) => (
            <Card key={p.source + (p.provider_id || "")} className={cn(
              "border p-5 space-y-4 transition-all",
              p.success_rate_pct !== null && p.success_rate_pct < 80 && p.total_calls > 0
                ? "bg-red-500/5 border-red-500/20"
                : "bg-white/[0.03] border-white/10"
            )}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white font-black text-sm">{p.provider_name}</p>
                  <p className="text-white/30 text-[11px] font-mono mt-0.5">{p.handler_type || p.source}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.is_active === false && (
                    <Badge className="text-[9px] h-4 bg-white/5 text-white/20 border-white/10">Inactive</Badge>
                  )}
                  <StatusBadge pct={p.success_rate_pct} totalCalls={p.total_calls} />
                </div>
              </div>

              {/* Success rate bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/40">Success Rate</span>
                  <span className={cn(
                    "font-black",
                    p.success_rate_pct === null ? "text-white/20"
                    : p.success_rate_pct >= 95 ? "text-green-400"
                    : p.success_rate_pct >= 80 ? "text-amber-400"
                    : "text-red-400"
                  )}>
                    {p.success_rate_pct !== null ? `${p.success_rate_pct}%` : "—"}
                  </span>
                </div>
                <HealthBar pct={p.success_rate_pct} />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-400/60 mb-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <p className="text-white font-black text-base">{(p.successful_calls || 0).toLocaleString()}</p>
                  <p className="text-white/20 text-[10px]">Successful</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-red-400/60 mb-0.5">
                    <XCircle className="w-3 h-3" />
                  </div>
                  <p className="text-white font-black text-base">{(p.rejected_calls || 0).toLocaleString()}</p>
                  <p className="text-white/20 text-[10px]">Rejected</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-blue-400/60 mb-0.5">
                    <Zap className="w-3 h-3" />
                  </div>
                  <p className="text-white font-black text-base">{p.avg_latency_ms ? `${Math.round(p.avg_latency_ms)}` : "—"}</p>
                  <p className="text-white/20 text-[10px]">Avg ms</p>
                </div>
              </div>

              {/* Errors/Warns */}
              {(p.error_count > 0 || p.warn_count > 0) && (
                <div className="flex gap-3">
                  {p.error_count > 0 && (
                    <span className="flex items-center gap-1 text-red-400 text-[11px]">
                      <XCircle className="w-3 h-3" /> {p.error_count} errors
                    </span>
                  )}
                  {p.warn_count > 0 && (
                    <span className="flex items-center gap-1 text-amber-400 text-[11px]">
                      <AlertTriangle className="w-3 h-3" /> {p.warn_count} warnings
                    </span>
                  )}
                </div>
              )}

              {/* Last call */}
              {p.last_call_at && (
                <p className="text-white/20 text-[10px] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last call {formatDistanceToNow(new Date(p.last_call_at), { addSuffix: true })}
                  {" · "}{format(new Date(p.last_call_at), "HH:mm:ss")}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
