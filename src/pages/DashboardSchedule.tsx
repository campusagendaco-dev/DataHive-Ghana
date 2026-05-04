import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { basePackages } from "@/lib/data";
import {
  CalendarClock, Plus, Trash2, ToggleLeft, ToggleRight,
  Loader2, RefreshCw, Star, Zap, TrendingUp, Award,
  CheckCircle2, Clock, Phone, ShieldCheck, AlertTriangle,
  XCircle, Info, ChevronRight, Repeat, Activity, User,
} from "lucide-react";

// ── Ghana phone validation ─────────────────────────────────────────────────────
const GH_PREFIXES: Record<string, string[]> = {
  MTN: ["024", "054", "055", "059", "025", "053"],
  Telecel: ["020", "050"],
  AirtelTigo: ["026", "056", "027", "057"],
};

function detectNetwork(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const prefix = digits.slice(0, 3);
  for (const [net, prefixes] of Object.entries(GH_PREFIXES)) {
    if (prefixes.includes(prefix)) return net;
  }
  return null;
}

function isValidGhanaPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 && digits.startsWith("0");
}

// ── Network config ─────────────────────────────────────────────────────────────
const NETWORK_CONFIG = {
  MTN: { color: "bg-amber-500", border: "border-amber-500/40", text: "text-amber-400", glow: "shadow-amber-500/20", ring: "ring-amber-500/50" },
  Telecel: { color: "bg-rose-500", border: "border-rose-500/40", text: "text-rose-400", glow: "shadow-rose-500/20", ring: "ring-rose-500/50" },
  AirtelTigo: { color: "bg-sky-500", border: "border-sky-500/40", text: "text-sky-400", glow: "shadow-sky-500/20", ring: "ring-sky-500/50" },
} as const;

// ── Loyalty tiers ──────────────────────────────────────────────────────────────
const LOYALTY_TIERS = [
  { name: "Bronze", min: 0, max: 19, icon: Star, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", bar: "bg-orange-500", badge: "bg-orange-500/15 text-orange-400 border-orange-500/25", discount: 0, perks: ["Standard rates", "Basic support"] },
  { name: "Silver", min: 20, max: 99, icon: Zap, color: "text-slate-300", bg: "bg-slate-500/10 border-slate-500/20", bar: "bg-slate-400", badge: "bg-slate-500/15 text-slate-300 border-slate-500/25", discount: 1, perks: ["1% loyalty discount", "Priority support"] },
  { name: "Gold", min: 100, max: 499, icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", bar: "bg-amber-400", badge: "bg-amber-400/15 text-amber-400 border-amber-400/25", discount: 2, perks: ["2% wallet discount", "Dedicated support", "Early access"] },
  { name: "Platinum", min: 500, max: Infinity, icon: Award, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", bar: "bg-violet-500", badge: "bg-violet-500/15 text-violet-400 border-violet-500/25", discount: 3, perks: ["3% wallet discount", "VIP support", "Custom pricing"] },
];

const getLoyaltyTier = (orders: number) =>
  [...LOYALTY_TIERS].reverse().find(t => orders >= t.min) ?? LOYALTY_TIERS[0];

const formatPhone = (v: string) => v.replace(/\D+/g, "").slice(0, 10);

const nextRunLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `In ${diffDays} days`;
  return d.toLocaleDateString("en-GH", { day: "2-digit", month: "short" });
};

const FREQ_CONFIG = {
  daily: { label: "Daily", sub: "Every 24 hrs", icon: Repeat },
  weekly: { label: "Weekly", sub: "Every 7 days", icon: Repeat },
  monthly: { label: "Monthly", sub: "Every 30 days", icon: Repeat },
} as const;

interface Schedule {
  id: string;
  network: string;
  package_size: string;
  recipient_phone: string;
  recipient_name: string | null;
  frequency: "daily" | "weekly" | "monthly";
  next_run_at: string;
  active: boolean;
  created_at: string;
  last_run_at: string | null;
}

// ── Phone validator widget ─────────────────────────────────────────────────────
const PhoneValidator = ({
  phone,
  selectedNetwork,
}: {
  phone: string;
  selectedNetwork: string;
}) => {
  if (!phone) return null;

  const valid = isValidGhanaPhone(phone);
  const detected = detectNetwork(phone);

  if (!valid) {
    return (
      <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <p className="text-[11px] text-red-400 font-semibold">
          Invalid — must be 10 digits starting with 0 (e.g. 0241234567)
        </p>
      </div>
    );
  }

  if (!detected) {
    return (
      <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <p className="text-[11px] text-amber-400 font-semibold">
          Valid number — network could not be detected from this prefix
        </p>
      </div>
    );
  }

  if (detected !== selectedNetwork) {
    return (
      <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <p className="text-[11px] text-amber-400 font-semibold">
          This looks like a <span className="font-black">{detected}</span> number — you selected <span className="font-black">{selectedNetwork}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <p className="text-[11px] text-emerald-400 font-semibold">
        Verified — valid <span className="font-black">{detected}</span> number
      </p>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const DashboardSchedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [showForm, setShowForm] = useState(false);

  const [network, setNetwork] = useState<"MTN" | "Telecel" | "AirtelTigo">("MTN");
  const [packageSize, setPackageSize] = useState("");
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("monthly");
  const userChoseNetwork = useRef(false);

  const packages = basePackages[network] ?? [];
  const netCfg = NETWORK_CONFIG[network];

  // Auto-switch network tab when phone prefix is recognisable
  useEffect(() => {
    if (userChoseNetwork.current) return;
    const detected = detectNetwork(phone) as "MTN" | "Telecel" | "AirtelTigo" | null;
    if (!detected) return;
    setNetwork(prev => {
      if (prev !== detected) setPackageSize("");
      return detected;
    });
  }, [phone]); // intentionally excludes `network` — only fires on phone change

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
    setSchedules((scheds as unknown as Schedule[]) ?? []);
    setTotalOrders(count ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const phoneValid = isValidGhanaPhone(phone);

  const handleCreate = async () => {
    if (!user || !packageSize) {
      toast({ title: "Choose a bundle", description: "Select a data bundle to continue.", variant: "destructive" });
      return;
    }
    if (!phoneValid) {
      toast({ title: "Invalid phone number", description: "Enter a valid 10-digit Ghana mobile number.", variant: "destructive" });
      return;
    }

    const detected = detectNetwork(phone);
    if (detected && detected !== network) {
      toast({
        title: "Network mismatch",
        description: `This looks like a ${detected} number. Are you sure you want to use ${network}?`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const now = new Date();
    const nextRun = new Date(now);
    if (frequency === "daily") nextRun.setDate(now.getDate() + 1);
    else if (frequency === "weekly") nextRun.setDate(now.getDate() + 7);
    else nextRun.setMonth(now.getMonth() + 1);

    let { error } = await supabase.from("scheduled_orders" as any).insert({
      user_id: user.id,
      network,
      package_size: packageSize,
      recipient_phone: phone,
      recipient_name: recipientName.trim() || null,
      frequency,
      next_run_at: nextRun.toISOString(),
      active: true,
      order_type: "data",
    });

    // Column not yet in schema cache — retry without recipient_name
    if (error?.message?.includes("recipient_name")) {
      ({ error } = await supabase.from("scheduled_orders" as any).insert({
        user_id: user.id,
        network,
        package_size: packageSize,
        recipient_phone: phone,
        frequency,
        next_run_at: nextRun.toISOString(),
        active: true,
        order_type: "data",
      }));
    }

    if (error) {
      toast({ title: "Could not save schedule", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Schedule created!", description: `${network} ${packageSize} will auto-renew ${frequency}.` });
      setShowForm(false);
      setPackageSize("");
      setPhone("");
      setRecipientName("");
      userChoseNetwork.current = false;
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

  const activeCount = schedules.filter(s => s.active).length;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-sky-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Auto-Renewal</h1>
          </div>
          <p className="text-white/40 text-sm ml-[52px]">Set up recurring data bundles that top-up automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            aria-label="Refresh schedules"
            className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(v => !v); setPackageSize(""); setPhone(""); setRecipientName(""); userChoseNetwork.current = false; }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm transition-all ${
              showForm
                ? "bg-white/10 text-white/50 border border-white/10"
                : "bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20"
            }`}
          >
            <Plus className={`w-4 h-4 transition-transform ${showForm ? "rotate-45" : ""}`} />
            {showForm ? "Cancel" : "New Schedule"}
          </button>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active", value: activeCount, icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Total", value: schedules.length, icon: CalendarClock, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
          { label: "Orders", value: totalOrders, icon: CheckCircle2, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-2xl border p-4 text-center ${bg}`}>
            <Icon className={`w-4 h-4 ${color} mx-auto mb-1.5`} />
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Loyalty tier ───────────────────────────────────────────────────── */}
      <div className={`relative overflow-hidden rounded-3xl border p-5 ${loyaltyTier.bg}`}>
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${loyaltyTier.bg}`}>
            <loyaltyTier.icon className={`w-6 h-6 ${loyaltyTier.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-xl font-black ${loyaltyTier.color}`}>{loyaltyTier.name} Member</p>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${loyaltyTier.badge}`}>
                {loyaltyTier.discount > 0 ? `${loyaltyTier.discount}% off` : "Standard"}
              </span>
            </div>
            <p className="text-white/30 text-xs mt-0.5">{totalOrders} fulfilled orders</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {loyaltyTier.perks.map(p => (
            <span key={p} className="flex items-center gap-1 text-[10px] font-bold text-white/50 bg-white/5 border border-white/8 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />{p}
            </span>
          ))}
        </div>

        {nextTier ? (
          <>
            <div className="flex justify-between text-[10px] text-white/30 mb-1.5 font-bold">
              <span>{totalOrders}</span>
              <span>{nextTier.min - totalOrders} more → <span className={nextTier.color}>{nextTier.name} ({nextTier.discount}% off)</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-black/25 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${loyaltyTier.bar}`}
                role="progressbar"
                aria-label={`Loyalty progress: ${Math.round(loyaltyProgress)}%`}
                style={{ width: `${loyaltyProgress}%` }}
              />
            </div>
          </>
        ) : (
          <div className={`flex items-center gap-2 text-[11px] font-bold ${loyaltyTier.color}`}>
            <Award className="w-3.5 h-3.5" /> Max tier — {loyaltyTier.discount}% applied to all wallet purchases.
          </div>
        )}
      </div>

      {/* ── New Schedule Form ───────────────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.025] overflow-hidden">
          {/* Form header */}
          <div className="px-6 py-4 border-b border-white/6 flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-black text-white">New Auto-Renewal</p>
              <p className="text-[10px] text-white/30">Configure your recurring bundle</p>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* ── Step 1: Network ── */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-white/10 text-white/50 text-[8px] font-black flex items-center justify-center">1</span>
                Choose Network
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(["MTN", "Telecel", "AirtelTigo"] as const).map(n => {
                  const cfg = NETWORK_CONFIG[n];
                  const active = network === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { userChoseNetwork.current = true; setNetwork(n); setPackageSize(""); }}
                      className={`py-3 rounded-2xl border font-black text-sm transition-all ${
                        active
                          ? `${cfg.color} text-white border-transparent shadow-lg ${cfg.glow}`
                          : `border-white/8 bg-white/[0.02] ${cfg.text} hover:border-white/20 hover:bg-white/[0.04]`
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Step 2: Bundle ── */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-white/10 text-white/50 text-[8px] font-black flex items-center justify-center">2</span>
                Choose Bundle
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {packages.map(p => {
                  const selected = packageSize === p.size;
                  return (
                    <button
                      key={p.size}
                      type="button"
                      onClick={() => setPackageSize(p.size)}
                      className={`relative p-3 rounded-2xl border text-center transition-all ${
                        selected
                          ? `${netCfg.border} bg-white/[0.06] ring-1 ${netCfg.ring}`
                          : "border-white/8 bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      {p.popular && !selected && (
                        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black uppercase bg-amber-500 text-black px-1.5 rounded-full">
                          Popular
                        </span>
                      )}
                      <p className={`text-xs font-black ${selected ? "text-white" : "text-white/70"}`}>{p.size}</p>
                      <p className={`text-[10px] font-bold mt-0.5 ${selected ? netCfg.text : "text-white/30"}`}>₵{p.price.toFixed(2)}</p>
                      {p.validity && <p className="text-[9px] text-white/20 mt-0.5">{p.validity}</p>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Step 3: Phone & Frequency ── */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-white/10 text-white/50 text-[8px] font-black flex items-center justify-center">3</span>
                Recipient & Schedule
              </p>
              {/* Name */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Recipient Name <span className="text-white/20 normal-case tracking-normal font-normal">(optional label)</span></p>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                  <input
                    type="text"
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="e.g. Mum, Wife, Client A"
                    maxLength={40}
                    className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-sm text-white outline-none transition-all focus:border-sky-500/50 placeholder:text-white/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Phone */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Recipient Phone</p>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(formatPhone(e.target.value))}
                      placeholder="0241234567"
                      maxLength={10}
                      className={`w-full h-12 pl-10 pr-4 bg-black/40 border rounded-xl text-sm text-white font-mono outline-none transition-all ${
                        phone.length === 0
                          ? "border-white/10 focus:border-sky-500/50"
                          : isValidGhanaPhone(phone)
                          ? detectNetwork(phone) === network
                            ? "border-emerald-500/40 focus:border-emerald-500/60"
                            : "border-amber-500/40 focus:border-amber-500/60"
                          : "border-red-500/40 focus:border-red-500/60"
                      }`}
                    />
                    {phone.length > 0 && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isValidGhanaPhone(phone)
                          ? <ShieldCheck className={`w-4 h-4 ${detectNetwork(phone) === network ? "text-emerald-400" : "text-amber-400"}`} />
                          : <XCircle className="w-4 h-4 text-red-400" />}
                      </div>
                    )}
                  </div>
                  <PhoneValidator phone={phone} selectedNetwork={network} />
                </div>

                {/* Frequency */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Renewal Frequency</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["daily", "weekly", "monthly"] as const).map(f => {
                      const cfg = FREQ_CONFIG[f];
                      const active = frequency === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFrequency(f)}
                          className={`py-2.5 rounded-xl border text-center transition-all ${
                            active
                              ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                              : "border-white/8 bg-white/[0.02] text-white/30 hover:text-white/50 hover:border-white/20"
                          }`}
                        >
                          <p className="text-[11px] font-black">{cfg.label}</p>
                          <p className="text-[9px] opacity-60 mt-0.5">{cfg.sub}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Summary + Create ── */}
            {packageSize && phoneValid && (
              <div className={`p-4 rounded-2xl border ${netCfg.border} bg-white/[0.02] space-y-2`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Schedule Summary</p>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl ${netCfg.color} flex items-center justify-center shrink-0`}>
                    <CalendarClock className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-white">{network} {packageSize}</p>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${netCfg.border} ${netCfg.text}`}>
                        {detectNetwork(phone) === network ? "✓ verified" : network}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {recipientName ? `${recipientName} · ` : ""}{phone} · {FREQ_CONFIG[frequency].label.toLowerCase()}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${netCfg.text} shrink-0`} />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !packageSize || !phoneValid}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:bg-white/10 disabled:text-white/30 text-white font-black text-sm transition-all shadow-lg shadow-sky-500/20 disabled:shadow-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              {saving ? "Creating schedule…" : "Create Auto-Renewal"}
            </button>
          </div>
        </div>
      )}

      {/* ── Schedule List ───────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/6 flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm text-white">Your Schedules</h3>
            <p className="text-[10px] text-white/30 mt-0.5">{activeCount} active of {schedules.length} total</p>
          </div>
          <span className="text-xs font-bold text-white/30 bg-white/5 border border-white/8 px-2.5 py-1 rounded-full">
            {schedules.length}
          </span>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-[72px] rounded-2xl bg-white/5 animate-pulse" />)}
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto">
              <CalendarClock className="w-7 h-7 text-white/15" />
            </div>
            <div>
              <p className="text-sm font-bold text-white/30">No schedules yet</p>
              <p className="text-xs text-white/20 mt-1">Hit "New Schedule" to set one up</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sky-500/15 border border-sky-500/25 text-sky-400 text-sm font-black hover:bg-sky-500/25 transition-all"
            >
              <Plus className="w-4 h-4" /> Create First Schedule
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {schedules.map(s => {
              const cfg = NETWORK_CONFIG[s.network as keyof typeof NETWORK_CONFIG] ?? NETWORK_CONFIG.MTN;
              return (
                <div
                  key={s.id}
                  className={`group relative flex items-center gap-4 rounded-2xl border px-4 py-4 transition-all ${
                    s.active
                      ? "border-white/8 bg-white/[0.025] hover:border-white/15"
                      : "border-white/4 bg-white/[0.01] opacity-45 hover:opacity-70"
                  }`}
                >
                  {/* Network dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.active ? cfg.color : "bg-white/15"}`} />

                  {/* Network + package icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.active ? `${cfg.color} bg-opacity-15` : "bg-white/5"} border border-white/8`}>
                    <CalendarClock className={`w-4 h-4 ${s.active ? cfg.text : "text-white/20"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm text-white">{s.network} {s.package_size}</p>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${cfg.border} ${cfg.text} bg-white/[0.02]`}>
                        {s.frequency}
                      </span>
                      {!s.active && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30">
                          Paused
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {s.recipient_name && (
                        <span className="text-[10px] font-bold text-white/60 flex items-center gap-1">
                          <User className="w-2.5 h-2.5" /> {s.recipient_name}
                        </span>
                      )}
                      <span className="text-[10px] text-white/35 flex items-center gap-1 font-mono">
                        <Phone className="w-2.5 h-2.5" /> {s.recipient_phone}
                      </span>
                      {s.active && (
                        <span className="text-[10px] text-white/30 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> {nextRunLabel(s.next_run_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => toggleActive(s.id, s.active)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
                        s.active
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          : "border-white/10 bg-white/5 text-white/30 hover:text-white/60"
                      }`}
                      aria-label={s.active ? "Pause" : "Resume"}
                    >
                      {s.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSchedule(s.id)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center border border-red-500/20 bg-red-500/5 text-red-400/50 hover:text-red-400 hover:bg-red-500/15 transition-all"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Info note ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/6">
        <Info className="w-4 h-4 text-white/20 shrink-0 mt-0.5" />
        <p className="text-[11px] text-white/25 leading-relaxed">
          Renewals are funded from your wallet. Maintain sufficient balance before each renewal date.
          Schedules with insufficient balance are skipped and retried the following day.
        </p>
      </div>

    </div>
  );
};

export default DashboardSchedule;
