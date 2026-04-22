import { useEffect, useMemo, useState, useRef } from "react";
import { Loader2, Search, CheckCircle2, Clock, XCircle, ShieldCheck, AlertTriangle, RefreshCw, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LOOKBACK_DAYS = 30;

interface TrackedOrder {
  id: string;
  status: string;
  customer_phone: string | null;
  network: string | null;
  package_size: string | null;
  amount: number;
  created_at: string;
  updated_at: string | null;
}

function normalizePhoneForQuery(phone: string): string[] {
  const digits = phone.replace(/\D+/g, "");
  if (!digits) return [];
  const variants = new Set<string>();
  if (digits.length === 10 && digits.startsWith("0")) {
    variants.add(digits);
    variants.add(`233${digits.slice(1)}`);
  } else if (digits.length === 12 && digits.startsWith("233")) {
    variants.add(digits);
    variants.add(`0${digits.slice(3)}`);
  } else if (digits.length === 9) {
    variants.add(`0${digits}`);
    variants.add(`233${digits}`);
  } else {
    variants.add(digits);
  }
  return Array.from(variants);
}

type StatusKey = "delivered" | "processing" | "failed" | "pending";

interface DisplayStatus {
  key: StatusKey;
  label: string;
  shortLabel: string;
  icon: typeof CheckCircle2;
  dot: string;
  badge: string;
  text: string;
}

function getDisplayStatus(order: TrackedOrder): DisplayStatus {
  if (order.status === "fulfilled") {
    return {
      key: "delivered",
      label: "Delivered Successfully",
      shortLabel: "Delivered",
      icon: CheckCircle2,
      dot: "bg-green-500",
      badge: "bg-green-500/12 border-green-500/25 text-green-600 dark:text-green-400",
      text: "text-green-600 dark:text-green-400",
    };
  }
  if (order.status === "fulfillment_failed") {
    return {
      key: "failed",
      label: "Delivery Failed",
      shortLabel: "Not Fulfilled",
      icon: XCircle,
      dot: "bg-red-500",
      badge: "bg-red-500/10 border-red-500/25 text-red-600 dark:text-red-400",
      text: "text-red-600 dark:text-red-400",
    };
  }
  if (order.status === "paid" || order.status === "processing") {
    return {
      key: "processing",
      label: "Processing — Delivering Data",
      shortLabel: "Processing",
      icon: Loader2,
      dot: "bg-blue-500",
      badge: "bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400",
      text: "text-blue-600 dark:text-blue-400",
    };
  }
  return {
    key: "pending",
    label: "Payment Pending",
    shortLabel: "Pending",
    icon: Clock,
    dot: "bg-amber-400",
    badge: "bg-amber-400/10 border-amber-400/25 text-amber-600 dark:text-amber-400",
    text: "text-amber-600 dark:text-amber-400",
  };
}

const networkColors: Record<string, { bg: string; text: string }> = {
  MTN:        { bg: "bg-amber-400",  text: "text-black" },
  Telecel:    { bg: "bg-red-600",    text: "text-white" },
  AirtelTigo: { bg: "bg-blue-600",   text: "text-white" },
};

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

interface PhoneOrderTrackerProps {
  title?: string;
  subtitle?: string;
  className?: string;
  defaultPhone?: string;
}

const PhoneOrderTracker = ({
  title = "Track Your Order",
  subtitle = "Enter the phone number used for purchase to see all recent deliveries.",
  className = "",
  defaultPhone,
}: PhoneOrderTrackerProps) => {
  const [phone, setPhone] = useState(defaultPhone || "");
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isPhoneValid = useMemo(() => {
    const d = phone.replace(/\D+/g, "");
    return d.length === 9 || d.length === 10 || d.length === 12;
  }, [phone]);

  const fetchOrders = async (phoneValue: string, silent = false): Promise<TrackedOrder[]> => {
    const variants = normalizePhoneForQuery(phoneValue);
    if (!variants.length) return [];

    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);

    const { data, error: qErr } = await supabase
      .from("orders")
      .select("id, status, customer_phone, network, package_size, amount, created_at, updated_at")
      .eq("order_type", "data")
      .in("customer_phone", variants)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (qErr) throw qErr;
    return (data || []) as TrackedOrder[];
  };

  const subscribeToOrders = (orderIds: string[]) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (!orderIds.length) return;

    const ch = supabase
      .channel(`tracker-orders-${orderIds[0]}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload: any) => {
          const updated = payload.new;
          if (!updated?.id) return;
          setOrders((prev) =>
            prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
          );
        }
      )
      .subscribe();

    channelRef.current = ch;
  };

  useEffect(() => () => { if (channelRef.current) supabase.removeChannel(channelRef.current); }, []);

  // Auto-search when defaultPhone is provided (e.g. from OrderStatus page)
  useEffect(() => {
    if (defaultPhone && normalizePhoneForQuery(defaultPhone).length > 0) {
      void (async () => {
        setLoading(true);
        setSearched(true);
        try {
          const found = await fetchOrders(defaultPhone);
          setOrders(found);
          subscribeToOrders(found.map((o) => o.id));
          if (!found.length) setError(`No data orders found in the last ${LOOKBACK_DAYS} days for this number.`);
        } catch {
          setError("Could not load orders. Please try again.");
        } finally {
          setLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPhone]);

  const handleTrack = async () => {
    setError("");
    setOrders([]);
    setLoading(true);
    setSearched(true);

    try {
      const found = await fetchOrders(phone);
      setOrders(found);
      subscribeToOrders(found.map((o) => o.id));
      if (!found.length) setError(`No data orders found in the last ${LOOKBACK_DAYS} days for this number.`);
    } catch {
      setError("Could not load orders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!searched || !phone) return;
    setRefreshing(true);
    try {
      const found = await fetchOrders(phone, true);
      setOrders(found);
    } catch { /* ignore */ }
    finally { setRefreshing(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && isPhoneValid) handleTrack(); };

  const stats = orders.reduce(
    (acc, o) => {
      if (o.status === "fulfilled") acc.delivered += 1;
      else if (o.status === "fulfillment_failed") acc.failed += 1;
      else acc.processing += 1;
      return acc;
    },
    { delivered: 0, failed: 0, processing: 0 }
  );

  return (
    <div className={`rounded-2xl border border-border bg-card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          {searched && orders.length > 0 && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="shrink-0 p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Recipient phone (e.g. 0241234567)"
            className="bg-background"
            type="tel"
            inputMode="numeric"
          />
          <Button onClick={handleTrack} disabled={!isPhoneValid || loading} className="shrink-0 gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Track
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 p-3 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Results */}
      {orders.length > 0 && (
        <div className="p-5 space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-green-500/8 border border-green-500/20 px-3 py-2.5">
              <p className="font-black text-lg text-green-600 dark:text-green-400">{stats.delivered}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Delivered</p>
            </div>
            <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 px-3 py-2.5">
              <p className="font-black text-lg text-blue-600 dark:text-blue-400">{stats.processing}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Processing</p>
            </div>
            <div className="rounded-xl bg-red-500/8 border border-red-500/20 px-3 py-2.5">
              <p className="font-black text-lg text-red-600 dark:text-red-400">{stats.failed}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Failed</p>
            </div>
          </div>

          {/* Order cards */}
          <div className="space-y-2.5">
            {orders.map((order) => {
              const ds = getDisplayStatus(order);
              const nc = networkColors[order.network || ""] || { bg: "bg-secondary", text: "text-foreground" };
              const { date, time } = fmt(order.created_at);
              const isSpinning = ds.key === "processing";

              return (
                <div
                  key={order.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3 hover:bg-secondary/60 transition-colors"
                >
                  {/* Network badge */}
                  <div className={`${nc.bg} ${nc.text} rounded-lg px-2.5 py-1.5 text-center shrink-0`}>
                    <p className="font-black text-xs leading-none">{order.network || "—"}</p>
                    <p className="font-black text-base leading-tight mt-0.5">{order.package_size || "—"}</p>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm">{order.network} {order.package_size}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ds.badge}`}>
                        <ds.icon className={`w-3 h-3 shrink-0 ${isSpinning ? "animate-spin" : ""}`} />
                        {ds.shortLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {date} &nbsp;·&nbsp; {time}
                    </p>
                  </div>

                  {/* Amount + status dot */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm">GH₵ {Number(order.amount).toFixed(2)}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${ds.dot} ${ds.key === "processing" ? "animate-pulse" : ""}`} />
                      <span className={`text-[10px] font-medium ${ds.text}`}>{ds.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Showing last {orders.length} order{orders.length !== 1 ? "s" : ""} · Updates live · {LOOKBACK_DAYS}-day history
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="p-5 space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
};

export default PhoneOrderTracker;
