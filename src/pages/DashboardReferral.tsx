import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Gift, Copy, CheckCircle2, Users2, Wallet,
  Share2, Clock, Star, Zap, TrendingUp, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Referral {
  id: string;
  referee_id: string;
  credited: boolean;
  credit_amount: number;
  created_at: string;
  credited_at: string | null;
}

// ── Tier config ────────────────────────────────────────────────────────────────
const TIERS = [
  {
    name: "Starter",
    min: 0,
    max: 4,
    credit: 2.00,
    icon: Star,
    color: "text-slate-400",
    badgeBorder: "border-slate-500/30",
    badgeBg: "bg-slate-500/8",
    badgeText: "text-slate-300",
    bar: "bg-slate-500",
    glow: "rgba(148,163,184,0.08)",
  },
  {
    name: "Silver",
    min: 5,
    max: 19,
    credit: 2.50,
    icon: Zap,
    color: "text-sky-400",
    badgeBorder: "border-sky-500/30",
    badgeBg: "bg-sky-500/8",
    badgeText: "text-sky-400",
    bar: "bg-sky-500",
    glow: "rgba(14,165,233,0.08)",
  },
  {
    name: "Gold",
    min: 20,
    max: Infinity,
    credit: 3.00,
    icon: TrendingUp,
    color: "text-amber-400",
    badgeBorder: "border-amber-400/30",
    badgeBg: "bg-amber-400/8",
    badgeText: "text-amber-400",
    bar: "bg-amber-400",
    glow: "rgba(251,191,36,0.1)",
  },
];

const getTier = (credited: number) =>
  [...TIERS].reverse().find((t) => credited >= t.min) ?? TIERS[0];

const DashboardReferral = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralCode = profile?.referral_code ?? undefined;
  const referralLink = referralCode
    ? `${window.location.origin}/?ref=${referralCode}`
    : null;

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });
      setReferrals((data as unknown as Referral[]) || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Referral link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (!referralLink) return;
    if (navigator.share) {
      navigator.share({
        title: "Get data on SwiftData Ghana",
        text: "Buy cheap data bundles on SwiftData Ghana — use my link:",
        url: referralLink,
      });
    } else {
      copyLink();
    }
  };

  const shareWhatsAppStatus = () => {
    if (!referralLink) return;
    const tierLine =
      currentTier.name !== "Starter"
        ? ` I'm already a ${currentTier.name} agent!`
        : "";
    const text =
      `🔥 *Earn FREE money with SwiftData Ghana!*\n\n` +
      `I'm making extra income referring friends to buy cheap data bundles 🇬🇭${tierLine}\n\n` +
      `⚡ All networks — MTN, AirtelTigo, Telecel\n` +
      `💰 Instant delivery · Lowest prices in Ghana\n\n` +
      `👇 Sign up through MY link:\n${referralLink}\n\n` +
      `✅ You get great prices, I get rewarded — everyone wins! 🙌`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const totalEarned = referrals.filter((r) => r.credited).reduce((s, r) => s + Number(r.credit_amount), 0);
  const pendingCount = referrals.filter((r) => !r.credited).length;
  const creditedCount = referrals.filter((r) => r.credited).length;

  const currentTier = getTier(creditedCount);
  const nextTier = TIERS[TIERS.indexOf(currentTier) + 1] ?? null;
  const progressToNext = nextTier
    ? Math.min(((creditedCount - currentTier.min) / (nextTier.min - currentTier.min)) * 100, 100)
    : 100;

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div>
        <h1 className="font-black text-3xl tracking-tight mb-1">Referral Program</h1>
        <p className="text-muted-foreground text-sm">
          Share your link — earn wallet credit for every friend who buys data.
          Higher tier = bigger reward per referral.
        </p>
      </div>

      {/* ── Tier status card ─────────────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border p-6 space-y-4",
          currentTier.badgeBg, currentTier.badgeBorder,
        )}
        style={{ boxShadow: `0 0 60px ${currentTier.glow}` }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none"
          style={{ background: currentTier.glow }} />

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border", currentTier.badgeBg, currentTier.badgeBorder)}>
              <currentTier.icon className={cn("w-7 h-7", currentTier.color)} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Tier</p>
              <p className={cn("text-3xl font-black leading-none mt-0.5", currentTier.color)}>
                {currentTier.name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">You earn</p>
            <p className={cn("text-4xl font-black leading-none mt-0.5", currentTier.color)}>
              ₵{currentTier.credit.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">per referral</p>
          </div>
        </div>

        {/* Tier ladder */}
        <div className="relative grid grid-cols-3 gap-2">
          {TIERS.map((t) => {
            const isActive = t.name === currentTier.name;
            const isPast = TIERS.indexOf(t) < TIERS.indexOf(currentTier);
            return (
              <div key={t.name}
                className={cn(
                  "rounded-xl border p-3 text-center transition-all",
                  isActive ? cn(t.badgeBg, t.badgeBorder) : "border-border/40 bg-card/30 opacity-50",
                )}>
                <p className={cn("text-xs font-black", isActive ? t.color : "text-muted-foreground")}>
                  {t.name}
                </p>
                <p className={cn("text-sm font-black mt-0.5", isActive ? t.color : "text-muted-foreground")}>
                  ₵{t.credit.toFixed(2)}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {t.min === 0 ? "0-4 refs" : t.max === Infinity ? `${t.min}+ refs` : `${t.min}-${t.max} refs`}
                </p>
                {(isActive || isPast) && (
                  <CheckCircle2 className={cn("w-3 h-3 mx-auto mt-1", t.color)} />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress to next tier */}
        {nextTier ? (
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground font-semibold">{creditedCount} credited</span>
              <span className="text-muted-foreground">
                {nextTier.min - creditedCount} more to{" "}
                <span className={cn("font-black", nextTier.color)}>{nextTier.name}</span>
                {" "}(₵{nextTier.credit.toFixed(2)}/ref)
              </span>
            </div>
            <div className="h-2 rounded-full bg-black/20 overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", currentTier.bar)}
                style={{ width: `${progressToNext}%` }}
              />
            </div>
          </div>
        ) : (
          <div className={cn("flex items-center gap-2 text-xs font-bold", currentTier.color)}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Maximum tier reached — enjoy GH₵{currentTier.credit.toFixed(2)} per referral!
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Earned", value: `₵${totalEarned.toFixed(2)}`, icon: Wallet, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
          { label: "Referred", value: referrals.length, icon: Users2, color: "text-foreground", bg: "bg-card border-border" },
          { label: "Pending", value: pendingCount, icon: Clock, color: "text-amber-400", bg: "bg-amber-400/8 border-amber-400/20" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-2xl border p-4 text-center", s.bg)}>
            <s.icon className={cn("w-5 h-5 mx-auto mb-1.5", s.color)} />
            <p className={cn("font-black text-xl", s.color)}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral link card */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 space-y-4"
        style={{
          background: "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.06) 100%)",
          border: "1px solid rgba(251,191,36,0.22)",
        }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-400/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
            <Gift className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="font-black text-base text-foreground">Your Referral Link</h2>
            <p className="text-xs text-muted-foreground">Share this — you earn when they buy</p>
          </div>
        </div>

        {referralLink ? (
          <>
            <div className="relative z-10 rounded-2xl bg-black/20 border border-white/10 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-0.5">Your unique link</p>
              <p className="text-sm font-bold text-foreground break-all">{referralLink}</p>
            </div>

            <div className="relative z-10 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={copyLink}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black border transition-all",
                  copied
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-400 border-amber-400 text-black hover:bg-amber-300",
                )}
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>

              <button
                type="button"
                onClick={shareLink}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black border border-white/15 bg-white/5 text-foreground hover:bg-white/10 transition-all"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>

              <button
                type="button"
                onClick={shareWhatsAppStatus}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/15 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp Status
              </button>
            </div>
          </>
        ) : (
          <div className="relative z-10 rounded-2xl bg-secondary/40 p-4 text-sm text-muted-foreground">
            Your referral link is being generated. Refresh the page in a moment.
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-3xl border border-border bg-card/60 p-6 space-y-4">
        <h3 className="font-black text-base">How it works</h3>
        <div className="space-y-3">
          {[
            { step: "1", text: "Copy your referral link and share it on WhatsApp Status, Facebook, or anywhere." },
            { step: "2", text: "Your friend signs up and makes their first data purchase." },
            { step: "3", text: "Wallet credit is automatically added — more as you reach higher tiers." },
            { step: "4", text: "No limit — refer as many as you want, unlock Gold tier for GH₵3.00/referral." },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </span>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral history */}
      <div className="rounded-3xl border border-border bg-card/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-black text-base">Referral History</h3>
          {creditedCount > 0 && (
            <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              {creditedCount} credited
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div className="py-16 text-center">
            <Users2 className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No referrals yet</p>
            <p className="text-xs text-muted-foreground/60">Share your link to get started</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border",
                    r.credited
                      ? "bg-emerald-500/10 border-emerald-500/25"
                      : "bg-amber-400/10 border-amber-400/25",
                  )}>
                    {r.credited
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : <Clock className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {r.credited ? "Reward Credited" : "Awaiting first purchase"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "text-sm font-black",
                  r.credited ? "text-emerald-400" : "text-muted-foreground/50",
                )}>
                  {r.credited ? `+₵${Number(r.credit_amount).toFixed(2)}` : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardReferral;
