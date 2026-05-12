import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAppTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, Loader2, Search, ChevronDown, ChevronUp,
  Users, TrendingUp, DollarSign, AlertTriangle,
  CreditCard, Activity, Clock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentRow {
  agent_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_sub_agent: boolean | null;
  joined_at: string | null;
  orders_30d: number;
  fulfilled_30d: number;
  failed_30d: number;
  revenue_30d: number;
  profit_30d: number;
  orders_7d: number;
  revenue_7d: number;
  orders_total: number;
  revenue_total: number;
  profit_total: number;
  last_order_at: string | null;
  days_since_last_order: number | null;
  wallet_balance: number;
  top_network: string | null;
  credit_enabled: boolean | null;
  credit_limit: number | null;
  credit_used: number | null;
}

type FilterTab = "All" | "Top Performers" | "Dormant" | "Sub-Agents";
type SortKey =
  | "full_name"
  | "orders_30d"
  | "revenue_30d"
  | "profit_30d"
  | "wallet_balance"
  | "days_since_last_order";

const PAGE_SIZE = 50;

const fmt = (n: number) =>
  `GH₵${Number(n ?? 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const relativeDate = (iso: string | null) => {
  if (!iso) return "Never";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
};

// ─── Status badge helper ───────────────────────────────────────────────────
function StatusBadge({ row }: { row: AgentRow }) {
  if (row.orders_30d === 0) {
    return (
      <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-2">
        Dormant
      </Badge>
    );
  }
  if (row.orders_7d === 0) {
    return (
      <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2">
        Slow
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2">
      Active
    </Badge>
  );
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

// ─── Expanded row detail ──────────────────────────────────────────────────────
function ExpandedDetail({ row, cardBg, head, sub }: { row: AgentRow; cardBg: string; head: string; sub: string }) {
  const periods = [
    { label: "Last 7 Days", orders: row.orders_7d, revenue: row.revenue_7d, profit: null },
    { label: "Last 30 Days", orders: row.orders_30d, revenue: row.revenue_30d, profit: row.profit_30d },
    { label: "All Time", orders: row.orders_total, revenue: row.revenue_total, profit: row.profit_total },
  ];

  return (
    <div className="px-4 pb-4 pt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
      {periods.map((p) => (
        <div key={p.label} className={`rounded-xl border p-4 ${cardBg}`}>
          <p className={`text-xs font-semibold mb-3 uppercase tracking-wider ${sub}`}>{p.label}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className={sub}>Orders</span>
              <span className={`font-medium ${head}`}>{p.orders}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={sub}>Revenue</span>
              <span className={`font-medium ${head}`}>{fmt(p.revenue)}</span>
            </div>
            {p.profit !== null && (
              <div className="flex justify-between text-sm">
                <span className={sub}>Profit</span>
                <span className="font-medium text-emerald-400">{fmt(p.profit)}</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Extra info */}
      <div className={`rounded-xl border p-4 md:col-span-3 flex flex-wrap gap-4 ${cardBg}`}>
        {row.top_network && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${sub}`}>Top Network</span>
            <Badge className="bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[10px] px-2">
              {row.top_network}
            </Badge>
          </div>
        )}
        {row.phone && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${sub}`}>Phone</span>
            <span className={`text-xs font-mono ${head}`}>{row.phone}</span>
          </div>
        )}
        {row.joined_at && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${sub}`}>Joined</span>
            <span className={`text-xs ${head}`}>{new Date(row.joined_at).toLocaleDateString()}</span>
          </div>
        )}
        {row.credit_enabled && (
          <>
            <div className="flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-violet-400" />
              <span className={`text-xs ${sub}`}>Credit Limit</span>
              <span className={`text-xs font-medium ${head}`}>{fmt(row.credit_limit ?? 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${sub}`}>Credit Used</span>
              <span className={`text-xs font-medium text-amber-400`}>{fmt(row.credit_used ?? 0)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminAgentPerformance() {
  const { isDark } = useAppTheme();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [sortKey, setSortKey] = useState<SortKey>("revenue_30d");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0d140d]" : "bg-gray-50";
  const cardBg = isDark ? "bg-white/[0.03] border-white/[0.07]" : "bg-white border-gray-200 shadow-sm";
  const head = isDark ? "text-white" : "text-gray-900";
  const sub = isDark ? "text-white/40" : "text-gray-500";
  const tableHead = isDark ? "text-white/30 border-white/[0.06]" : "text-gray-400 border-gray-100";
  const tableRow = isDark
    ? "border-white/[0.05] hover:bg-white/[0.025] transition-colors"
    : "border-gray-100 hover:bg-gray-50 transition-colors";
  const inputCls = isDark
    ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/20"
    : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400";

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("v_agent_performance" as any)
      .select("*")
      .order("revenue_30d", { ascending: false });

    if (error) {
      toast({ title: "Failed to load agent performance", description: error.message, variant: "destructive" });
    } else {
      setAgents((data ?? []) as AgentRow[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalActive = useMemo(() => agents.filter((a) => a.orders_30d > 0).length, [agents]);
  const totalRevenue30d = useMemo(() => agents.reduce((s, a) => s + Number(a.revenue_30d ?? 0), 0), [agents]);
  const totalProfit30d = useMemo(() => agents.reduce((s, a) => s + Number(a.profit_30d ?? 0), 0), [agents]);
  const dormantCount = useMemo(
    () => agents.filter((a) => (a.days_since_last_order ?? 999) > 14).length,
    [agents]
  );

  // ── Filter + search ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = agents;

    if (activeTab === "Top Performers") rows = rows.filter((a) => a.revenue_30d > 500);
    else if (activeTab === "Dormant") rows = rows.filter((a) => (a.days_since_last_order ?? 999) > 14 || a.orders_30d === 0);
    else if (activeTab === "Sub-Agents") rows = rows.filter((a) => a.is_sub_agent);

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (a) =>
          (a.full_name ?? "").toLowerCase().includes(q) ||
          (a.email ?? "").toLowerCase().includes(q)
      );
    }

    return rows;
  }, [agents, activeTab, search]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [filtered, sortKey, sortAsc]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1 opacity-20" />
    );

  const tabs: FilterTab[] = ["All", "Top Performers", "Dormant", "Sub-Agents"];

  return (
    <div className={`min-h-screen ${bg} px-4 py-6 md:px-8`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={`text-2xl font-bold ${head}`}>Agent Performance</h1>
          <p className={`text-sm mt-0.5 ${sub}`}>30-day performance overview for all agents</p>
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
          label="Active Agents (30d)"
          value={totalActive}
          icon={Users}
          accent="bg-emerald-500/10 text-emerald-400"
          cardBg={cardBg}
          head={head}
          sub={sub}
        />
        <StatCard
          label="30d Revenue"
          value={fmt(totalRevenue30d)}
          icon={DollarSign}
          accent="bg-blue-500/10 text-blue-400"
          cardBg={cardBg}
          head={head}
          sub={sub}
        />
        <StatCard
          label="30d Profit Paid"
          value={fmt(totalProfit30d)}
          icon={TrendingUp}
          accent="bg-violet-500/10 text-violet-400"
          cardBg={cardBg}
          head={head}
          sub={sub}
        />
        <StatCard
          label="Dormant Agents"
          value={dormantCount}
          icon={AlertTriangle}
          accent="bg-red-500/10 text-red-400"
          cardBg={cardBg}
          head={head}
          sub={sub}
        />
      </div>

      {/* Filter tabs + search */}
      <div className={`rounded-2xl border p-4 mb-4 ${cardBg}`}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Tabs */}
          <div className="flex gap-1 flex-wrap">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(0); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-emerald-600 text-white"
                    : isDark
                    ? "text-white/50 hover:text-white hover:bg-white/5"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${sub}`} />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search name or email…"
              className={`pl-9 h-8 text-xs ${inputCls}`}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className={`w-6 h-6 animate-spin ${sub}`} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-xs uppercase tracking-wider ${tableHead}`}>
                    {(
                      [
                        ["full_name", "Agent"],
                        ["orders_30d", "Orders (30d)"],
                        ["revenue_30d", "Revenue (30d)"],
                        ["profit_30d", "Profit (30d)"],
                        ["wallet_balance", "Wallet"],
                        ["days_since_last_order", "Last Active"],
                      ] as [SortKey, string][]
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="px-4 py-3 text-left cursor-pointer select-none whitespace-nowrap"
                      >
                        {label}
                        <SortIcon col={key} />
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`text-center py-16 text-sm ${sub}`}>
                        No agents found
                      </td>
                    </tr>
                  ) : (
                    paginated.map((row) => (
                      <React.Fragment key={row.agent_id}>
                        <tr
                          onClick={() => setExpandedId(expandedId === row.agent_id ? null : row.agent_id)}
                          className={`border-b cursor-pointer ${tableRow}`}
                        >
                          <td className="px-4 py-3">
                            <div className={`font-medium ${head}`}>{row.full_name ?? "—"}</div>
                            <div className={`text-xs ${sub}`}>{row.email ?? "—"}</div>
                          </td>
                          <td className={`px-4 py-3 font-mono font-medium ${head}`}>{row.orders_30d}</td>
                          <td className={`px-4 py-3 font-mono font-medium ${head}`}>{fmt(row.revenue_30d)}</td>
                          <td className="px-4 py-3 font-mono font-medium text-emerald-400">{fmt(row.profit_30d)}</td>
                          <td className={`px-4 py-3 font-mono font-medium ${head}`}>{fmt(row.wallet_balance)}</td>
                          <td className={`px-4 py-3 text-xs ${sub}`}>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {relativeDate(row.last_order_at)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge row={row} />
                          </td>
                        </tr>
                        {expandedId === row.agent_id && (
                          <tr key={`${row.agent_id}-expanded`} className={`border-b ${isDark ? "bg-white/[0.015]" : "bg-gray-50"}`}>
                            <td colSpan={7} className="p-0">
                              <ExpandedDetail row={row} cardBg={cardBg} head={head} sub={sub} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`flex items-center justify-between px-4 py-3 border-t ${tableHead}`}>
                <span className={`text-xs ${sub}`}>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className={`text-xs h-7 ${isDark ? "border-white/10 text-white/60 hover:text-white hover:bg-white/5" : ""}`}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                    className={`text-xs h-7 ${isDark ? "border-white/10 text-white/60 hover:text-white hover:bg-white/5" : ""}`}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer note */}
      <p className={`mt-4 text-xs text-center ${sub}`}>
        <Activity className="w-3 h-3 inline mr-1 mb-0.5" />
        Data sourced from <code className="font-mono">v_agent_performance</code> view. Refresh to get latest figures.
      </p>
    </div>
  );
}
