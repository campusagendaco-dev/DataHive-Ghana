import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet, ShoppingCart, TrendingUp, ArrowDownToLine, ArrowUpRight,
  Users2, Zap, Store, ClipboardList, ChevronRight, RefreshCw, CloudOff,
  Gift, Sparkles, Activity,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppTheme } from "@/contexts/ThemeContext";
import FreeDataClaimBanner from "@/components/FreeDataClaimBanner";
import WelcomeAnnouncement from "@/components/WelcomeAnnouncement";
import ReferAndEarn from "@/components/ReferAndEarn";
import DailyCheckIn from "@/components/DailyCheckIn";
import PromoCarousel from "@/components/PromoCarousel";

interface DashboardStats {
  walletBalance: number;
  totalOrders: number;
  totalDeposited: number;
  totalSalesAmount: number;
  subAgentEarnings: number;
  totalProfit: number;
  loyaltyBalance: number;
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const Dashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { theme } = useAppTheme();
  const isPaidAgent = Boolean(profile?.agent_approved || profile?.sub_agent_approved);
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    walletBalance: 0,
    totalOrders: 0,
    totalDeposited: 0,
    totalSalesAmount: 0,
    subAgentEarnings: 0,
    totalProfit: 0,
    loyaltyBalance: 0,
  });

  const fetchData = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(false);

    try {
      const [walletRes, ordersRes] = await Promise.all([
        supabase.from("wallets").select("balance, loyalty_balance").eq("agent_id", user.id).single(),
        supabase
          .from("orders")
          .select("amount, order_type, status, profit")
          .eq("agent_id", user.id)
          .in("status", ["paid", "processing", "fulfilled", "fulfillment_failed"]),
      ]);

      if (walletRes.error && walletRes.error.code !== "PGRST116") throw new Error("Fetch failed");
      if (ordersRes.error) throw new Error("Fetch failed");

      const balance = walletRes.data ? Number(walletRes.data.balance) : 0;
      const allOrders = ordersRes.data ?? [];
      const fulfilledOrders = allOrders.filter((o: any) => o.status === "fulfilled");
      const depositedOrders = allOrders.filter((o: any) => o.order_type === "wallet_topup" && o.status === "fulfilled");
      const salesOrders = allOrders.filter((o: any) =>
        ["data", "api", "airtime", "utility"].includes(o.order_type) && o.status === "fulfilled"
      );
      const subAgentActivationOrders = allOrders.filter((o: any) => o.order_type === "sub_agent_activation" && o.status === "fulfilled");

      setStats({
        walletBalance: balance,
        totalOrders: fulfilledOrders.length,
        totalDeposited: depositedOrders.reduce((s: number, o: any) => s + Number(o.amount || 0), 0),
        totalSalesAmount: salesOrders.reduce((s: number, o: any) => s + Number(o.amount || 0), 0),
        subAgentEarnings: subAgentActivationOrders.reduce((s: number, o: any) => s + Number(o.profit || 0), 0),
        totalProfit: fulfilledOrders.reduce((s: number, o: any) => s + Number(o.profit || 0), 0),
        loyaltyBalance: Number(walletRes.data?.loyalty_balance || 0),
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();

    const walletChannel = supabase
      .channel("dashboard-wallet")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `agent_id=eq.${user?.id}` }, (p: any) => {
        if (p.new?.balance !== undefined) setStats(prev => ({ ...prev, walletBalance: Number(p.new.balance) }));
      })
      .subscribe();

    const ordersChannel = supabase
      .channel("dashboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `agent_id=eq.${user?.id}` }, () => {
        fetchData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [user, fetchData]);

  const primary = `hsl(${theme.primary})`;

  const statCards = [
    { label: "Total Deposited", value: `GH₵ ${stats.totalDeposited.toFixed(2)}`, icon: ArrowDownToLine, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", glow: "shadow-blue-500/10" },
    { label: "Data Orders",     value: stats.totalOrders,                           icon: ShoppingCart,    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", glow: "shadow-emerald-500/10" },
    { label: "Sales Volume",    value: `GH₵ ${stats.totalSalesAmount.toFixed(2)}`, icon: ArrowUpRight,    color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/20",  glow: "shadow-violet-500/10" },
    { label: "Profit Earned",   value: `GH₵ ${stats.totalProfit.toFixed(2)}`,      icon: TrendingUp,      color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",   glow: "shadow-amber-500/10" },
  ];

  const quickActions = [
    { label: "Buy MTN Data",   icon: Zap,          path: "/dashboard/buy-data/mtn",  color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
    { label: "Transactions",   icon: ClipboardList, path: "/dashboard/transactions",  color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
    { label: "My Store",       icon: Store,         path: "/dashboard/my-store",      color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { label: "Top Up Wallet",  icon: ArrowDownToLine, path: "/dashboard/wallet",      color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-5">

      <FreeDataClaimBanner />

      {/* ── Greeting row ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/35 text-xs font-medium">{getGreeting()} 👋</p>
          <h1 className="text-xl font-black text-white tracking-tight">{firstName}</h1>
        </div>
        <button
          type="button"
          onClick={() => fetchData(true)}
          aria-label="Refresh dashboard"
          className={`w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all ${refreshing ? "animate-spin" : ""}`}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <DailyCheckIn />
      <WelcomeAnnouncement />
      <PromoCarousel />

      {/* ── Hero balance card ── */}
      <div
        className="relative rounded-3xl overflow-hidden p-5 sm:p-6 text-white shadow-2xl"
        style={{ background: theme.heroHex }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-6 w-40 h-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3 h-3 text-white/40" />
              <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Wallet Balance</p>
            </div>

            {loading
              ? <Skeleton className="h-12 w-48 bg-white/10 rounded-xl" />
              : <p className="text-5xl sm:text-6xl font-black leading-none tracking-tight">
                  GH₵ <span>{stats.walletBalance.toFixed(2)}</span>
                </p>}

            <p className="text-white/35 text-xs mt-2">Available for data bundles</p>

            {/* SwiftPoints pill */}
            <button
              type="button"
              onClick={() => navigate("/dashboard/wallet")}
              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 hover:bg-white/20 transition-all"
            >
              <Gift className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                {stats.loyaltyBalance} SwiftPoints
              </span>
              <ChevronRight className="w-3 h-3 text-white/30" />
            </button>
          </div>

          <div className="flex flex-row sm:flex-col gap-2.5 sm:items-end">
            <button
              type="button"
              onClick={() => navigate("/dashboard/wallet")}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black transition-all hover:opacity-90 active:scale-95 shadow-lg"
              style={{ background: primary, color: "#000" }}
            >
              <Wallet className="w-4 h-4" /> Top Up
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard/buy-data/mtn")}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all active:scale-95"
            >
              <Zap className="w-4 h-4" /> Buy Data
            </button>
          </div>
        </div>

        {/* Mini stats row */}
        <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/10">
          <div>
            <p className="text-white/35 text-[10px] uppercase tracking-widest font-bold">Deposited</p>
            {loading
              ? <Skeleton className="h-5 w-24 mt-1 bg-white/10" />
              : <p className="text-white font-black text-base mt-0.5">GH₵ {stats.totalDeposited.toFixed(2)}</p>}
          </div>
          <div>
            <p className="text-white/35 text-[10px] uppercase tracking-widest font-bold">Orders</p>
            {loading
              ? <Skeleton className="h-5 w-16 mt-1 bg-white/10" />
              : <p className="text-white font-black text-base mt-0.5">{stats.totalOrders}</p>}
          </div>
          {isPaidAgent && (
            <div className="col-span-2 sm:col-span-1">
              <p className="text-white/35 text-[10px] uppercase tracking-widest font-bold">Total Profit</p>
              {loading
                ? <Skeleton className="h-5 w-24 mt-1 bg-white/10" />
                : <p className="font-black text-base mt-0.5" style={{ color: primary }}>
                    GH₵ {stats.totalProfit.toFixed(2)}
                  </p>}
            </div>
          )}
        </div>
      </div>

      <ReferAndEarn />

      {/* ── Error state ── */}
      {error && (
        <div className="rounded-3xl p-8 border border-red-500/20 bg-red-500/5 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <CloudOff className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Connection Issues</h3>
            <p className="text-sm text-white/50 max-w-xs mx-auto mt-1">Couldn't load your latest data. Check your connection and try again.</p>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 bg-white text-black text-sm font-black hover:bg-white/90 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-4 border border-white/8 bg-white/[0.03]">
                <Skeleton className="h-4 w-4 mb-3 rounded-lg" />
                <Skeleton className="h-6 w-3/4 mb-1.5 rounded-lg" />
                <Skeleton className="h-3 w-full rounded-lg" />
              </div>
            ))
          : statCards.map((s) => (
              <div
                key={s.label}
                className={`rounded-2xl p-4 flex flex-col gap-2 border shadow-lg ${s.bg} ${s.glow}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className={`font-black text-base sm:text-lg leading-tight ${s.color}`}>{s.value}</p>
                <p className="text-white/40 text-[11px] font-medium">{s.label}</p>
              </div>
            ))}
      </div>

      {/* ── Quick actions ── */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3 flex items-center gap-2">
          <Sparkles className="w-3 h-3" /> Quick Actions
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {quickActions.map((a) => (
            <button
              type="button"
              key={a.label}
              onClick={() => navigate(a.path)}
              className={`group flex flex-col items-start gap-3 rounded-2xl border p-4 transition-all hover:scale-[1.02] active:scale-[0.98] ${a.bg} ${a.border}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${a.bg} border ${a.border}`}>
                <a.icon className={`w-4 h-4 ${a.color}`} />
              </div>
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-black text-white/80">{a.label}</span>
                <ChevronRight className={`w-3.5 h-3.5 ${a.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Agent upsell ── */}
      {!isPaidAgent && (
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
          <div className="flex-1 relative">
            <p className="font-black text-sm text-white mb-1 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Unlock Agent Prices
            </p>
            <p className="text-white/40 text-xs leading-relaxed">
              Become an agent to get wholesale bundle rates, your own store, and profit tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/agent-program")}
            className="relative shrink-0 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-black text-black transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-amber-500/20"
            style={{ background: primary }}
          >
            Become an Agent <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
