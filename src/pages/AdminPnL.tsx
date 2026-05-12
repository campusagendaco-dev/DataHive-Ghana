import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, Loader2, TrendingUp, DollarSign,
  BarChart2, Download, PackageSearch,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailyPnLRow {
  report_date: string;
  network: string | null;
  order_type: string | null;
  provider_name: string | null;
  handler_type: string | null;
  total_orders: number;
  fulfilled_orders: number;
  failed_orders: number;
  gross_revenue: number;
  total_cost: number;
  agent_profits: number;
  parent_profits: number;
  gross_profit: number;
  margin_pct: number;
  paystack_fees: number;
}

interface PackageProfitRow {
  network: string | null;
  package_size: string | null;
  order_type: string | null;
  fulfilled_count: number;
  failed_count: number;
  avg_selling_price: number;
  avg_cost_price: number;
  avg_profit: number;
  total_revenue: number;
  total_profit: number;
  profit_margin_pct: number;
  failure_rate_pct: number;
  last_sold_at: string | null;
}

type DateRange = "7" | "30" | "90";
type GroupBy = "By Day" | "By Network" | "By Provider";
type MainTab = "pnl" | "packages";

const fmt = (n: number) =>
  `GH₵${Number(n ?? 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (n: number) => `${Number(n ?? 0).toFixed(1)}%`;

// ─── Margin colour helper ─────────────────────────────────────────────────────
function marginColour(pct: number) {
  if (pct >= 15) return "text-emerald-400";
  if (pct >= 5) return "text-amber-400";
  return "text-red-400";
}

function marginBadgeCls(pct: number) {
  if (pct >= 15) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (pct >= 5) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-red-500/10 text-red-400 border-red-500/20";
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  cardBg,
  head,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  cardBg: string;
  head: string;
  sub: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex items-start gap-4 ${cardBg}`}>
      <div className={`rounded-xl p-2.5 ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className={`text-xs font-medium mb-0.5 ${sub}`}>{label}</p>
        <p className={`text-xl font-bold tracking-tight ${head}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const lines = [
    keys.join(","),
    ...rows.map((r) =>
      keys.map((k) => JSON.stringify(r[k] ?? "")).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Network progress bar ─────────────────────────────────────────────────────
const NETWORK_COLOURS: Record<string, string> = {
  MTN: "bg-yellow-400",
  Telecel: "bg-red-400",
  AirtelTigo: "bg-blue-400",
};

function NetworkBreakdown({
  rows,
  cardBg,
  head,
  sub,
}: {
  rows: DailyPnLRow[];
  cardBg: string;
  head: string;
  sub: string;
}) {
  const byNetwork = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const net = r.network ?? "Unknown";
      map[net] = (map[net] ?? 0) + Number(r.gross_revenue ?? 0);
    }
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([net, rev]) => ({ net, rev, pct: total ? (rev / total) * 100 : 0 }));
  }, [rows]);

  return (
    <div className={`rounded-2xl border p-5 mb-4 ${cardBg}`}>
      <p className={`text-sm font-semibold mb-4 ${head}`}>Network Revenue Share</p>
      <div className="space-y-3">
        {byNetwork.map(({ net, rev, pct }) => (
          <div key={net}>
            <div className="flex justify-between text-xs mb-1">
              <span className={`font-medium ${head}`}>{net}</span>
              <span className={sub}>
                {fmt(rev)} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full ${NETWORK_COLOURS[net] ?? "bg-violet-400"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
        {byNetwork.length === 0 && (
          <p className={`text-xs ${sub}`}>No data for selected period.</p>
        )}
      </div>
    </div>
  );
}

// ─── Aggregation helper ───────────────────────────────────────────────────────
function aggregate(rows: DailyPnLRow[], groupBy: GroupBy): DailyPnLRow[] {
  const key = (r: DailyPnLRow) => {
    if (groupBy === "By Day") return r.report_date;
    if (groupBy === "By Network") return r.network ?? "Unknown";
    return r.provider_name ?? "Unknown";
  };

  const map = new Map<string, DailyPnLRow>();
  for (const r of rows) {
    const k = key(r);
    if (!map.has(k)) {
      map.set(k, {
        report_date: groupBy === "By Day" ? r.report_date : "",
        network: groupBy === "By Network" ? (r.network ?? "Unknown") : (groupBy === "By Day" ? r.network : ""),
        order_type: null,
        provider_name: groupBy === "By Provider" ? (r.provider_name ?? "Unknown") : null,
        handler_type: null,
        total_orders: 0,
        fulfilled_orders: 0,
        failed_orders: 0,
        gross_revenue: 0,
        total_cost: 0,
        agent_profits: 0,
        parent_profits: 0,
        gross_profit: 0,
        margin_pct: 0,
        paystack_fees: 0,
      });
    }
    const acc = map.get(k)!;
    acc.total_orders += Number(r.total_orders ?? 0);
    acc.fulfilled_orders += Number(r.fulfilled_orders ?? 0);
    acc.failed_orders += Number(r.failed_orders ?? 0);
    acc.gross_revenue += Number(r.gross_revenue ?? 0);
    acc.total_cost += Number(r.total_cost ?? 0);
    acc.agent_profits += Number(r.agent_profits ?? 0);
    acc.parent_profits += Number(r.parent_profits ?? 0);
    acc.gross_profit += Number(r.gross_profit ?? 0);
    acc.paystack_fees += Number(r.paystack_fees ?? 0);
  }

  // Recompute margin % from aggregated values
  for (const acc of map.values()) {
    acc.margin_pct = acc.gross_revenue > 0 ? (acc.gross_profit / acc.gross_revenue) * 100 : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.gross_revenue - a.gross_revenue);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminPnL() {
  const { isDark } = useAppTheme();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pnlRows, setPnlRows] = useState<DailyPnLRow[]>([]);
  const [packageRows, setPackageRows] = useState<PackageProfitRow[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>("30");
  const [groupBy, setGroupBy] = useState<GroupBy>("By Day");
  const [mainTab, setMainTab] = useState<MainTab>("pnl");

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0d140d]" : "bg-gray-50";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.07]" : "bg-white border-gray-200 shadow-sm";
  const head = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-white/40" : "text-gray-500";
  const tableHead = isDark ? "text-white/30 border-white/[0.06]" : "text-gray-400 border-gray-100";
  const tableRow = isDark
    ? "border-white/[0.05] hover:bg-white/[0.025] transition-colors"
    : "border-gray-100 hover:bg-gray-50 transition-colors";
  const tabActive = "bg-emerald-600 text-white";
  const tabInactive = isDark
    ? "text-white/50 hover:text-white hover:bg-white/5"
    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100";

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(dateRange));
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const [pnlRes, pkgRes] = await Promise.all([
      supabase
        .from("v_daily_pnl" as any)
        .select("*")
        .gte("report_date", cutoffStr)
        .order("report_date", { ascending: false }),
      supabase
        .from("v_package_profitability" as any)
        .select("*")
        .order("total_revenue", { ascending: false }),
    ]);

    if (pnlRes.error) {
      toast({ title: "Failed to load P&L data", description: pnlRes.error.message, variant: "destructive" });
    } else {
      setPnlRows((pnlRes.data ?? []) as DailyPnLRow[]);
    }

    if (pkgRes.error) {
      toast({ title: "Failed to load package profitability", description: pkgRes.error.message, variant: "destructive" });
    } else {
      setPackageRows((pkgRes.data ?? []) as PackageProfitRow[]);
    }

    setLoading(false);
  }, [dateRange, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Aggregated view ───────────────────────────────────────────────────────
  const aggregated = useMemo(() => aggregate(pnlRows, groupBy), [pnlRows, groupBy]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalRevenue = useMemo(() => pnlRows.reduce((s, r) => s + Number(r.gross_revenue ?? 0), 0), [pnlRows]);
  const totalCost = useMemo(() => pnlRows.reduce((s, r) => s + Number(r.total_cost ?? 0), 0), [pnlRows]);
  const totalGrossProfit = useMemo(() => pnlRows.reduce((s, r) => s + Number(r.gross_profit ?? 0), 0), [pnlRows]);
  const avgMargin = useMemo(
    () => (totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0),
    [totalRevenue, totalGrossProfit]
  );

  // ── Column label for groupBy ──────────────────────────────────────────────
  const groupLabel = groupBy === "By Day" ? "Date" : groupBy === "By Network" ? "Network" : "Provider";
  const groupValue = (r: DailyPnLRow) => {
    if (groupBy === "By Day") return r.report_date;
    if (groupBy === "By Network") return r.network ?? "—";
    return r.provider_name ?? "—";
  };

  return (
    <div className={`min-h-screen ${bg} px-4 py-6 md:px-8`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${head}`}>P&amp;L Dashboard</h1>
          <p className={`text-sm mt-0.5 ${sub}`}>Revenue, cost and margin analysis</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className={`gap-2 ${isDark ? "border-white/10 text-white/60 hover:text-white hover:bg-white/5" : ""}`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={`Revenue (${dateRange}d)`}
          value={fmt(totalRevenue)}
          icon={DollarSign}
          accent="bg-blue-500/10 text-blue-400"
          cardBg={cardBg}
          head={head}
          sub={sub}
        />
        <StatCard
          label={`Total Cost (${dateRange}d)`}
          value={fmt(totalCost)}
          icon={BarChart2}
          accent="bg-red-500/10 text-red-400"
          cardBg={cardBg}
          head={head}
          sub={sub}
        />
        <StatCard
          label={`Gross Profit (${dateRange}d)`}
          value={fmt(totalGrossProfit)}
          icon={TrendingUp}
          accent="bg-emerald-500/10 text-emerald-400"
          cardBg={cardBg}
          head={head}
          sub={sub}
        />
        <StatCard
          label="Avg Margin %"
          value={fmtPct(avgMargin)}
          icon={PackageSearch}
          accent={
            avgMargin >= 15
              ? "bg-emerald-500/10 text-emerald-400"
              : avgMargin >= 5
              ? "bg-amber-500/10 text-amber-400"
              : "bg-red-500/10 text-red-400"
          }
          cardBg={cardBg}
          head={head}
          sub={sub}
        />
      </div>

      {/* Network breakdown */}
      {!loading && <NetworkBreakdown rows={pnlRows} cardBg={cardBg} head={head} sub={sub} />}

      {/* Controls bar */}
      <div className={`rounded-2xl border p-4 mb-4 ${cardBg}`}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {/* Date range */}
            {(["7", "30", "90"] as DateRange[]).map((d) => (
              <button
                key={d}
                onClick={() => setDateRange(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  dateRange === d ? tabActive : tabInactive
                }`}
              >
                Last {d}d
              </button>
            ))}
            <span className={`mx-1 self-center text-xs ${sub}`}>|</span>
            {/* Group by */}
            {(["By Day", "By Network", "By Provider"] as GroupBy[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  groupBy === g ? "bg-violet-600 text-white" : tabInactive
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(aggregated as unknown as Record<string, unknown>[], `pnl_${dateRange}d_${groupBy.replace(" ", "_")}.csv`)}
            className={`gap-2 text-xs h-8 ${isDark ? "border-white/10 text-white/60 hover:text-white hover:bg-white/5" : ""}`}
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 mb-4">
        {(
          [
            ["pnl", "Daily P&L"],
            ["packages", "Package Profitability"],
          ] as [MainTab, string][]
        ).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              mainTab === tab ? tabActive : tabInactive
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── P&L Table ──────────────────────────────────────────────────────── */}
      {mainTab === "pnl" && (
        <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className={`w-6 h-6 animate-spin ${sub}`} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-xs uppercase tracking-wider ${tableHead}`}>
                    <th className="px-4 py-3 text-left">{groupLabel}</th>
                    {groupBy === "By Day" && <th className="px-4 py-3 text-left">Network</th>}
                    {groupBy === "By Day" && <th className="px-4 py-3 text-left">Provider</th>}
                    <th className="px-4 py-3 text-left">Orders</th>
                    <th className="px-4 py-3 text-left">Revenue</th>
                    <th className="px-4 py-3 text-left">Cost</th>
                    <th className="px-4 py-3 text-left">Gross Profit</th>
                    <th className="px-4 py-3 text-left">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregated.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={`text-center py-16 text-sm ${sub}`}>
                        No data for selected period
                      </td>
                    </tr>
                  ) : (
                    aggregated.map((r, i) => (
                      <tr key={i} className={`border-b ${tableRow}`}>
                        <td className={`px-4 py-3 font-mono text-xs ${head}`}>{groupValue(r)}</td>
                        {groupBy === "By Day" && (
                          <td className={`px-4 py-3 text-xs ${sub}`}>{r.network ?? "—"}</td>
                        )}
                        {groupBy === "By Day" && (
                          <td className={`px-4 py-3 text-xs ${sub}`}>{r.provider_name ?? "—"}</td>
                        )}
                        <td className={`px-4 py-3 font-mono ${head}`}>
                          {r.total_orders}
                          {r.failed_orders > 0 && (
                            <span className="text-red-400 ml-1 text-[10px]">(-{r.failed_orders})</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 font-mono ${head}`}>{fmt(r.gross_revenue)}</td>
                        <td className={`px-4 py-3 font-mono ${sub}`}>{fmt(r.total_cost)}</td>
                        <td className="px-4 py-3 font-mono text-emerald-400">{fmt(r.gross_profit)}</td>
                        <td className="px-4 py-3">
                          <Badge
                            className={`border text-[10px] px-2 font-mono ${marginBadgeCls(r.margin_pct)}`}
                          >
                            {fmtPct(r.margin_pct)}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Package Profitability Table ─────────────────────────────────────── */}
      {mainTab === "packages" && (
        <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
          {/* Package export button */}
          <div className={`flex justify-end px-4 py-3 border-b ${tableHead}`}>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportCSV(
                  packageRows as unknown as Record<string, unknown>[],
                  "package_profitability.csv"
                )
              }
              className={`gap-2 text-xs h-7 ${
                isDark ? "border-white/10 text-white/60 hover:text-white hover:bg-white/5" : ""
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className={`w-6 h-6 animate-spin ${sub}`} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-xs uppercase tracking-wider ${tableHead}`}>
                    <th className="px-4 py-3 text-left">Network</th>
                    <th className="px-4 py-3 text-left">Package</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Fulfilled</th>
                    <th className="px-4 py-3 text-left">Failed %</th>
                    <th className="px-4 py-3 text-left">Avg Selling</th>
                    <th className="px-4 py-3 text-left">Avg Cost</th>
                    <th className="px-4 py-3 text-left">Avg Profit</th>
                    <th className="px-4 py-3 text-left">Total Revenue</th>
                    <th className="px-4 py-3 text-left">Total Profit</th>
                    <th className="px-4 py-3 text-left">Margin %</th>
                    <th className="px-4 py-3 text-left">Last Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {packageRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className={`text-center py-16 text-sm ${sub}`}>
                        No package profitability data
                      </td>
                    </tr>
                  ) : (
                    packageRows.map((r, i) => (
                      <tr key={i} className={`border-b ${tableRow}`}>
                        <td className={`px-4 py-3 text-xs ${head}`}>
                          <span
                            className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                              NETWORK_COLOURS[r.network ?? ""] ?? "bg-violet-400"
                            }`}
                          />
                          {r.network ?? "—"}
                        </td>
                        <td className={`px-4 py-3 font-mono text-xs ${head}`}>{r.package_size ?? "—"}</td>
                        <td className={`px-4 py-3 text-xs ${sub}`}>{r.order_type ?? "—"}</td>
                        <td className={`px-4 py-3 font-mono ${head}`}>{r.fulfilled_count}</td>
                        <td className="px-4 py-3 font-mono">
                          <span
                            className={
                              r.failure_rate_pct >= 10
                                ? "text-red-400"
                                : r.failure_rate_pct >= 5
                                ? "text-amber-400"
                                : sub
                            }
                          >
                            {fmtPct(r.failure_rate_pct)}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-mono ${sub}`}>{fmt(r.avg_selling_price)}</td>
                        <td className={`px-4 py-3 font-mono ${sub}`}>{fmt(r.avg_cost_price)}</td>
                        <td className="px-4 py-3 font-mono text-emerald-400">{fmt(r.avg_profit)}</td>
                        <td className={`px-4 py-3 font-mono ${head}`}>{fmt(r.total_revenue)}</td>
                        <td className="px-4 py-3 font-mono text-emerald-400">{fmt(r.total_profit)}</td>
                        <td className="px-4 py-3">
                          <Badge
                            className={`border text-[10px] px-2 font-mono ${marginBadgeCls(r.profit_margin_pct)}`}
                          >
                            {fmtPct(r.profit_margin_pct)}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-xs ${sub}`}>
                          {r.last_sold_at ? new Date(r.last_sold_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className={`mt-4 text-xs text-center ${sub}`}>
        Data sourced from{" "}
        <code className="font-mono">v_daily_pnl</code> and{" "}
        <code className="font-mono">v_package_profitability</code> views.
      </p>
    </div>
  );
}
