import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw, Flag, ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { format } from "date-fns";

interface FeatureFlag {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  updated_at: string;
}

const FLAG_ICONS: Record<string, string> = {
  free_data: "🎁",
  referral_program: "🔗",
  whatsapp_bot: "💬",
  airtime_purchase: "📱",
  result_checker: "🎓",
  api_access: "🔑",
  agent_credit: "💳",
  bulk_disbursement: "📦",
};

const FLAG_RISKS: Record<string, { level: "low" | "medium" | "high"; note: string }> = {
  free_data:         { level: "medium", note: "Enabling may drain promo budget quickly." },
  referral_program:  { level: "low",    note: "Safe to toggle — no financial risk." },
  whatsapp_bot:      { level: "low",    note: "Affects agent WhatsApp ordering only." },
  airtime_purchase:  { level: "medium", note: "Requires airtime provider to be configured." },
  result_checker:    { level: "low",    note: "External API dependency — verify it's active." },
  api_access:        { level: "high",   note: "Disabling breaks all developer API integrations." },
  agent_credit:      { level: "high",   note: "Allows agents to buy on credit — monitor closely." },
  bulk_disbursement: { level: "medium", note: "Large disbursements can drain balance rapidly." },
};

export default function AdminFeatureFlags() {
  const { toast } = useToast();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const fetchFlags = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("feature_flags").select("*").order("label");
    if (!error) setFlags((data as FeatureFlag[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFlags(); }, []);

  const handleToggle = async (flag: FeatureFlag) => {
    const risk = FLAG_RISKS[flag.key];
    // High-risk flags require confirmation
    if (risk?.level === "high" && confirmKey !== flag.key) {
      setConfirmKey(flag.key);
      return;
    }
    setConfirmKey(null);
    setToggling(flag.id);

    const { error } = await (supabase as any)
      .from("feature_flags")
      .update({ enabled: !flag.enabled, updated_at: new Date().toISOString() })
      .eq("id", flag.id);

    if (error) {
      toast({ title: "Failed to toggle", description: error.message, variant: "destructive" });
    } else {
      setFlags((prev) => prev.map((f) => f.id === flag.id ? { ...f, enabled: !f.enabled } : f));
      toast({ title: `${flag.label} ${!flag.enabled ? "enabled" : "disabled"}` });

      // Log to system_logs
      await (supabase as any).from("system_logs").insert({
        level: "info", source: "admin", event: "feature_flag.toggled",
        message: `Feature "${flag.label}" ${!flag.enabled ? "enabled" : "disabled"} by admin`,
        data: { key: flag.key, new_value: !flag.enabled },
      });
    }
    setToggling(null);
  };

  const enabledCount = flags.filter((f) => f.enabled).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Feature Flags</h1>
          <p className="text-white/40 text-sm mt-1">Enable or disable platform features without deploying</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={fetchFlags}
          className="gap-2 border-white/10 text-white/60 hover:bg-white/5">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-500/5 border-green-500/20 p-4">
          <p className="text-green-400/60 text-[10px] font-black uppercase tracking-widest">Enabled</p>
          <p className="text-3xl font-black text-green-400 mt-1">{enabledCount}</p>
        </Card>
        <Card className="bg-white/5 border-white/10 p-4">
          <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Disabled</p>
          <p className="text-3xl font-black text-white mt-1">{flags.length - enabledCount}</p>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20 p-4">
          <p className="text-red-400/60 text-[10px] font-black uppercase tracking-widest">High Risk</p>
          <p className="text-3xl font-black text-red-400 mt-1">
            {Object.values(FLAG_RISKS).filter((r) => r.level === "high").length}
          </p>
        </Card>
      </div>

      {/* Flags */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-white/20 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {flags.map((flag) => {
            const risk = FLAG_RISKS[flag.key] || { level: "low", note: "" };
            const icon = FLAG_ICONS[flag.key] || "⚙️";
            const isConfirming = confirmKey === flag.key;

            return (
              <Card key={flag.id} className={cn(
                "border p-5 transition-all",
                flag.enabled ? "bg-white/[0.03] border-white/10" : "bg-white/[0.01] border-white/5 opacity-60"
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-black text-sm">{flag.label}</p>
                        <Badge className={cn("text-[9px] h-4 px-1.5 border font-black uppercase shrink-0",
                          risk.level === "high"   ? "bg-red-500/15 text-red-400 border-red-500/20" :
                          risk.level === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                                                    "bg-white/10 text-white/40 border-white/10")}>
                          {risk.level} risk
                        </Badge>
                      </div>
                      {flag.description && (
                        <p className="text-white/40 text-xs mt-1">{flag.description}</p>
                      )}
                      {risk.note && (
                        <p className="text-white/25 text-[11px] mt-1 flex items-start gap-1">
                          <Info className="w-3 h-3 mt-0.5 shrink-0" />{risk.note}
                        </p>
                      )}
                      <p className="text-white/15 text-[10px] mt-2">
                        Last changed: {format(new Date(flag.updated_at), "MMM dd, yyyy HH:mm")}
                      </p>
                    </div>
                  </div>

                  {/* Toggle */}
                  <div className="shrink-0">
                    {isConfirming ? (
                      <div className="flex flex-col gap-1.5 items-end">
                        <p className="text-red-400 text-[10px] font-bold">Confirm?</p>
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => setConfirmKey(null)}
                            className="px-2 py-1 text-[11px] font-bold text-white/40 hover:text-white border border-white/10 rounded-lg transition-colors">
                            Cancel
                          </button>
                          <button type="button" onClick={() => handleToggle(flag)}
                            className="px-2 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-colors">
                            Yes, toggle
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => handleToggle(flag)} disabled={toggling === flag.id}
                        className="transition-colors disabled:opacity-50">
                        {flag.enabled
                          ? <ToggleRight className="w-9 h-9 text-green-400 hover:text-green-300" />
                          : <ToggleLeft className="w-9 h-9 text-white/20 hover:text-white/40" />
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Status bar */}
                <div className={cn(
                  "mt-3 flex items-center gap-1.5 text-[11px] font-bold",
                  flag.enabled ? "text-green-400" : "text-white/20"
                )}>
                  {flag.enabled
                    ? <><CheckCircle2 className="w-3 h-3" /> Enabled — feature is live</>
                    : <><Flag className="w-3 h-3" /> Disabled — feature is hidden</>
                  }
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
