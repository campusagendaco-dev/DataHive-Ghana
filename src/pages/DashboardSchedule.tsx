import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { basePackages, networks } from "@/lib/data";
import {
  CalendarClock, Plus, Trash2, ToggleLeft, ToggleRight,
  Loader2, RefreshCw, Star, Zap, TrendingUp, Award,
  AlertCircle, CheckCircle2, Clock
} from "lucide-react";

interface Schedule {
  id: string;
  network: string;
  package_size: string;
  recipient_phone: string;
  frequency: "daily" | "weekly" | "monthly";
  next_run_at: string;
  active: boolean;
  created_at: string;
  last_run_at: string | null;
}

const FREQ_LABELS: Record<string, string> = {
  daily: "Every Day",
  weekly: "Every Week",
  monthly: "Every Month",
};

// ── Loyalty tier config ────────────────────────────────────────────────────────
const LOYALTY_TIERS = [
  {
    name: "Bronze",
    min: 0,
    max: 19,
    icon: Star,
    color: "text-orange-600",
    bg: "bg-orange-700/10 border-orange-700/25",
    bar: "bg-orange-600",
    perks: ["Standard rates", "Basic support"],
    discount: 0,
  },
  {
    name: "Silver",
    min: 20,
    max: 99,
    icon: Zap,
    color: "text-slate-300",
    bg: "bg-slate-500/10 border-slate-500/25",
    bar: "bg-slate-400",
    perks: ["1% loyalty discount", "Priority support"],
    discount: 1,
  },
  {
    name: "Gold",
    min: 100,
    max: 499,
    icon: TrendingUp,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/25",
    bar: "bg-amber-400",
    perks: ["2% loyalty discount", "Dedicated support", "Early feature access"],
    discount: 2,
  },
  {
    name: "Platinum",
    min: 500,
    max: Infinity,
    icon: Award,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/25",
    bar: "bg-violet-500",
    perks: ["3% loyalty discount", "VIP support line", "Custom pricing on request"],
    discount: 3,
  },
];

const getLoyaltyTier = (orders: number) =>
  [...LOYALTY_TIERS].reverse().find(t => orders >= t.min) ?? LOYALTY_TIERS[0];

const formatPhone = (v: string) => v.replace(/\D+/g, "").slice(0, 10);

const nextRunLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GH", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
};

const DashboardSchedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [network, setNetwork] = useState<"MTN" | "Telecel" | "AirtelTigo">("MTN");
  const [packageSize, setPackageSize] = useState("");
  const [phone, setPhone] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("monthly");

  const packages = basePackages[network] ?? [];

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: scheds }, { count }] = await Promise.all([
      supabase
        .from("scheduled_orders" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", user.id)
        .eq("status", "fulfilled"),
    ]);
    setSchedules((scheds as Schedule[]) ?? []);
    setTotalOrders(count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!user || !packageSize || phone.length < 9) {
      toast({ title: "Fill all fields", description: "Network, package, and a valid phone are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const now = new Date();
    const nextRun = new Date(now);
    if (frequency === "daily") nextRun.setDate(now.getDate() + 1);
    else if (frequency === "weekly") nextRun.setDate(now.getDate() + 7);
    else nextRun.setMonth(now.getMonth() + 1);

    const { error } = await supabase.from("scheduled_orders" as any).insert({
      user_id: user.id,
      network,
      package_size: packageSize,
      recipient_phone: phone,
      frequency,
      next_run_at: nextRun.toISOString(),
      active: true,
    });

    if (error) {
      toast({ title: "Could not save schedule", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Schedule created!", description: `${network} ${packageSize} will renew ${FREQ_LABELS[frequency].toLowerCase()}.` });
      setShowForm(false);
      setPackageSize("");
      setPhone("");
      await load();
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("scheduled_orders" as any).update({ active: !current }).eq("id", id);
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, active: !current } : s));
  };

  const deleteSchedule = async (id: string) => {
    await supabase.from("scheduled_orders" as any).delete().eq("id", id);
    setSchedules(prev => prev.filter(s => s.id !== id));
    toast({ title: "Schedule removed" });
  };

  const loyaltyTier = getLoyaltyTier(totalOrders);
  const nextTier = LOYALTY_TIERS[LOYALTY_TIERS.indexOf(loyaltyTier) + 1] ?? null;
  const loyaltyProgress = nextTier
    ? Math.min(((totalOrders - loyaltyTier.min) / (nextTier.min - loyaltyTier.min)) * 100, 100)
    : 100;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/25 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-sky-400" />
            </div>
            Scheduled Bundles
          </h1>
          <p className="text-white/40 text-sm mt-1.5 ml-[52px]">
            Auto-renew data for yourself or your regular customers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        </div>
      </div>

      {/* ── Wallet Loyalty Tier ─────────────────────────────────────────── */}
      <div className={`relative overflow-hidden rounded-3xl border p-6 space-y-4 ${loyaltyTier.bg}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${loyaltyTier.bg}`}>
              <loyaltyTier.icon className={`w-7 h-7 ${loyaltyTier.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Loyalty Status</p>
              <p className={`text-3xl font-black leading-none mt-0.5 ${loyaltyTier.color}`}>{loyaltyTier.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-widest">Total orders</p>
            <p className={`text-4xl font-black leading-none mt-0.5 ${loyaltyTier.color}`}>{totalOrders}</p>
          </div>
        </div>

        {/* Perks */}
        <div className="flex flex-wrap gap-2">
          {loyaltyTier.perks.map(p => (
            <span key={p} className="flex items-center gap-1.5 text-[10px] font-bold text-white/50 bg-white/5 border border-white/8 rounded-full px-3 py-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />{p}
            </span>
          ))}
        </div>

        {/* Progress */}
        {nextTier ? (
          <div>
            <div className="flex justify-between text-xs text-white/30 mb-1.5">
              <span>{totalOrders} orders</span>
              <span>{nextTier.min - totalOrders} more to <span className={`font-black ${nextTier.color}`}>{nextTier.name}</span> ({nextTier.discount}% discount)</span>
            </div>
            <div className="h-2 rounded-full bg-black/20 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${loyaltyTier.bar}`} style={{ width: `${loyaltyProgress}%` }} />
            </div>
          </div>
        ) : (
          <p className={`text-xs font-bold ${loyaltyTier.color} flex items-center gap-1.5`}>
            <Award className="w-3.5 h-3.5" /> Maximum tier — {loyaltyTier.discount}% discount applied to your wallet purchases.
          </p>
        )}

        {loyaltyTier.discount > 0 && (
          <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {loyaltyTier.discount}% loyalty discount is automatically applied on wallet-funded purchases.
          </div>
        )}
      </div>

      {/* ── New Schedule Form ───────────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-3xl border border-sky-500/20 bg-sky-500/5 p-6 space-y-5">
          <h3 className="font-black text-base text-white">New Auto-Renewal</h3>

          {/* Network */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Network</p>
            <div className="flex gap-2 p-1 bg-black/30 rounded-2xl border border-white/6">
              {(["MTN", "Telecel", "AirtelTigo"] as const).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setNetwork(n); setPackageSize(""); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${network === n ? "bg-sky-500 text-white" : "text-white/30 hover:text-white/60"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Package */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Bundle</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {packages.map(p => (
                <button
                  key={p.size}
                  type="button"
                  onClick={() => setPackageSize(p.size)}
                  className={`p-3 rounded-2xl border text-center transition-all ${packageSize === p.size ? "border-sky-500 bg-sky-500/15" : "border-white/8 bg-white/[0.02] hover:border-white/20"}`}
                >
                  <p className="text-xs font-black text-white">{p.size}</p>
                  <p className="text-[10px] text-sky-400 font-bold mt-0.5">₵{p.price.toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Phone + Frequency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Recipient Phone</p>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                placeholder="0240000000"
                className="w-full h-11 bg-black/40 border border-white/10 rounded-xl px-4 text-sm text-white font-mono focus:border-sky-500/50 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Renewal Frequency</p>
              <div className="flex gap-2 h-11">
                {(["daily", "weekly", "monthly"] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`flex-1 rounded-xl text-[10px] font-black transition-all capitalize ${frequency === f ? "bg-sky-500 text-white" : "border border-white/8 bg-white/[0.02] text-white/40 hover:text-white/70"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              {saving ? "Saving…" : "Create Schedule"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-3 rounded-2xl border border-white/10 bg-white/5 text-white/50 font-bold text-sm hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Schedule List ───────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/6 flex items-center justify-between">
          <h3 className="font-black text-base text-white">Active Schedules</h3>
          <span className="text-xs font-bold text-white/30 bg-white/5 border border-white/8 px-2.5 py-1 rounded-full">
            {schedules.length} schedule{schedules.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto">
              <CalendarClock className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-sm text-white/30">No schedules yet</p>
            <p className="text-xs text-white/20">Click "New Schedule" to set up an auto-renewal</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {schedules.map(s => (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-all ${s.active ? "border-white/8 bg-white/[0.025]" : "border-white/4 bg-white/[0.01] opacity-50"}`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                    <CalendarClock className="w-4.5 h-4.5 text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-sm text-white truncate">
                      {s.network} {s.package_size} → {s.recipient_phone}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-bold text-sky-400 uppercase">{FREQ_LABELS[s.frequency]}</span>
                      <span className="text-[10px] text-white/30 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Next: {nextRunLabel(s.next_run_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleActive(s.id, s.active)}
                    className={`transition-colors ${s.active ? "text-emerald-400 hover:text-emerald-300" : "text-white/20 hover:text-white/50"}`}
                    aria-label={s.active ? "Pause schedule" : "Resume schedule"}
                  >
                    {s.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSchedule(s.id)}
                    className="text-red-400/50 hover:text-red-400 transition-colors"
                    aria-label="Delete schedule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/6">
        <AlertCircle className="w-4 h-4 text-white/20 shrink-0 mt-0.5" />
        <p className="text-[11px] text-white/30 leading-relaxed">
          Scheduled bundles are funded from your wallet balance. Ensure sufficient balance before each renewal date.
          Schedules with insufficient balance are skipped and retried the next day.
        </p>
      </div>

    </div>
  );
};

export default DashboardSchedule;
