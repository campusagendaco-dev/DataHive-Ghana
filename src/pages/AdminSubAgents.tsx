import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/utils/auditLogger";
import {
  CheckCircle, Clock, Search, Wallet, Phone,
  Loader2, RefreshCw, Store, MessageCircle, ShoppingCart, Users2, ChevronDown, User
} from "lucide-react";

interface SubAgentRow {
  user_id: string;
  full_name: string;
  email: string;
  store_name: string;
  phone: string;
  momo_number: string;
  momo_network: string;
  slug: string | null;
  is_agent: boolean;
  is_sub_agent: boolean;
  sub_agent_approved: boolean;
  onboarding_complete: boolean;
  created_at: string;
  parent_agent_id: string | null;
  parent_name?: string;
  wallet_balance?: number;
  total_sales_volume?: number;
}

const AdminSubAgents = () => {
  const [agents, setAgents] = useState<SubAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "approved" | "pending">("all");
  const [topupAmount, setTopupAmount] = useState<Record<string, string>>({});
  const [toppingUp, setToppingUp] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;
  const { toast } = useToast();
  const { user: currentUser, session } = useAuth();

  const fetchAgents = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
      setPage(0);
    }
    
    const currentPage = isLoadMore ? page + 1 : 0;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" }) as any;

    query = query.eq("is_sub_agent", true);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,store_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    if (filter === "approved") {
      query = query.eq("sub_agent_approved", true);
    } else if (filter === "pending") {
      query = query.eq("sub_agent_approved", false);
    }

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    
    const rows = ((data as any[]) || []) as SubAgentRow[];

    // Fetch extra data: Parent Names, Wallet Balances, Sales Volume
    const ids = rows.map(r => r.user_id);
    const parentIds = Array.from(new Set(rows.map(r => r.parent_agent_id).filter(Boolean))) as string[];

    if (ids.length > 0) {
      const [walletsRes, salesRes, parentsRes] = await Promise.all([
        supabase.from("wallets").select("agent_id, balance").in("agent_id", ids),
        supabase.from("user_sales_stats").select("user_id, total_sales_volume").in("user_id", ids),
        parentIds.length > 0 ? supabase.from("profiles").select("user_id, full_name").in("user_id", parentIds) : Promise.resolve({ data: [] }),
      ]);

      const walletMap = new Map((walletsRes.data || []).map((w: any) => [w.agent_id, w.balance]));
      const salesMap = new Map((salesRes.data || []).map((s: any) => [s.user_id, s.total_sales_volume]));
      const parentMap = new Map((parentsRes.data || []).map((p: any) => [p.user_id, p.full_name]));

      rows.forEach(r => {
        r.wallet_balance = walletMap.get(r.user_id) ?? 0;
        r.total_sales_volume = salesMap.get(r.user_id) ?? 0;
        if (r.parent_agent_id) {
          r.parent_name = parentMap.get(r.parent_agent_id) || "Unknown Parent";
        }
      });
    }

    setAgents(prev => isLoadMore ? [...prev, ...rows] : rows);
    setHasMore(count ? (from + rows.length < count) : rows.length === PAGE_SIZE);
    if (isLoadMore) setPage(currentPage);
    setLoading(false);
  }, [filter, page, search]);

  useEffect(() => { 
    const timer = setTimeout(() => fetchAgents(false), 300);
    return () => clearTimeout(timer);
  }, [fetchAgents]);

  const handleApprove = async (userId: string) => {
    setApprovingId(userId);
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "approve_sub_agent", user_id: userId },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    if (error || data?.error) {
      toast({ title: "Failed to approve", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Sub-Agent approved" });
      setAgents(prev => prev.map(a => a.user_id === userId ? { ...a, sub_agent_approved: true } : a));
      if (currentUser) await logAudit(currentUser.id, "approve_sub_agent", { target_user_id: userId });
    }
    setApprovingId(null);
  };

  const handleTopUp = async (agent: SubAgentRow) => {
    const amount = parseFloat(topupAmount[agent.user_id] || "");
    if (!amount || amount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" }); return;
    }
    setToppingUp(agent.user_id);

    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: { action: "manual_topup", user_id: agent.user_id, amount },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });

    if (error || data?.error) {
      toast({ title: "Failed to top up", description: data?.error || error?.message, variant: "destructive" });
    } else {
      if (currentUser) {
        await logAudit(currentUser.id, "manual_wallet_topup", {
          target_agent_id: agent.user_id,
          target_agent_name: agent.full_name,
          amount,
          new_balance: data.new_balance,
        });
      }

      toast({ title: `GH₵${amount.toFixed(2)} credited to ${agent.full_name}` });
      setTopupAmount(prev => ({ ...prev, [agent.user_id]: "" }));
      setAgents(prev => prev.map(a => a.user_id === agent.user_id ? { ...a, wallet_balance: data.new_balance } : a));
    }
    setToppingUp(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="text-white/50 text-sm">Loading sub-agents...</p>
      </div>
    );
  }

  const approvedCount = agents.filter(a => a.sub_agent_approved).length;
  const pendingCount = agents.filter(a => !a.sub_agent_approved).length;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Sub-Agent Management
          </h1>
          <p className="text-sm text-white/50 mt-1">View and manage all sub-agents and their parent agent links.</p>
        </div>
        <Button onClick={() => fetchAgents(false)} className="gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Sub-Agents", value: agents.length, color: "text-white" },
          { label: "Approved", value: approvedCount, color: "text-blue-400" },
          { label: "Pending", value: pendingCount, color: "text-yellow-400" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 text-center">
            <p className={`font-display text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search by name, email, parent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-blue-400/40"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "approved", "pending"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${
                filter === f
                  ? "bg-blue-400/20 text-blue-400 border border-blue-400/30"
                  : "bg-white/5 text-white/50 border border-white/10 hover:text-white/80"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {agents.length === 0 ? (
        <div className="text-center py-16 text-white/30 text-sm">No sub-agents found.</div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div key={agent.user_id} className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
              <div className="p-4 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <p className="font-bold text-white text-base">{agent.full_name || "—"}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {agent.sub_agent_approved ? (
                          <Badge className="gap-1 bg-blue-500/20 text-blue-400 border-blue-500/30 text-[9px] font-bold">
                            <CheckCircle className="w-2.5 h-2.5" /> Active
                          </Badge>
                        ) : (
                          <Badge className="gap-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[9px] font-bold">
                            <Clock className="w-2.5 h-2.5" /> Pending Approval
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/40">
                      <span className="flex items-center gap-1.5">
                        <Users2 className="w-3.5 h-3.5 text-blue-400/50" /> Parent: <span className="text-white/70 font-semibold">{agent.parent_name || "Direct Signup"}</span>
                      </span>
                      {agent.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-white/20" /> {agent.phone}
                        </span>
                      )}
                      <span className="truncate">{agent.email}</span>
                      <span className="text-[10px] uppercase tracking-wider text-white/20">Joined {new Date(agent.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://wa.me/233${agent.phone?.replace(/^0/, "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                    {!agent.sub_agent_approved && (
                      <Button
                        size="sm"
                        onClick={() => handleApprove(agent.user_id)}
                        disabled={approvingId === agent.user_id}
                        className="text-xs bg-blue-500 text-white font-bold hover:bg-blue-400 h-9 rounded-xl"
                      >
                        {approvingId === agent.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Approve"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
                   <div className="flex items-center gap-6">
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Wallet Balance</p>
                        <p className="text-sm font-black text-white">GH₵{(agent.wallet_balance || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5">Sales Volume</p>
                        <p className="text-sm font-black text-green-400">GH₵{(agent.total_sales_volume || 0).toFixed(2)}</p>
                      </div>
                   </div>

                   <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs">₵</span>
                        <Input
                          type="number"
                          placeholder="Top-up"
                          value={topupAmount[agent.user_id] || ""}
                          onChange={(e) => setTopupAmount(prev => ({ ...prev, [agent.user_id]: e.target.value }))}
                          className="pl-7 w-24 bg-white/5 border-white/10 text-white text-xs rounded-lg h-8 focus:border-blue-400/40"
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleTopUp(agent)}
                        disabled={toppingUp === agent.user_id}
                        className="h-8 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 text-xs rounded-lg"
                      >
                        {toppingUp === agent.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                      </Button>
                      <Link
                        to={`/admin/orders?agent=${encodeURIComponent(agent.full_name || agent.email)}`}
                        className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors text-xs gap-2"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" /> History
                      </Link>
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="pt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchAgents(true)}
            disabled={loading}
            className="bg-white/5 border-white/10 text-white rounded-xl px-10 font-black tracking-widest uppercase text-xs"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
            Load More
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminSubAgents;
