import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  CreditCard, Search, RefreshCw, AlertTriangle, 
  CheckCircle2, XCircle, Clock, ChevronRight, 
  ExternalLink, ArrowDownToLine, Filter, Loader2,
  PlayCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokePublicFunctionAsUser } from "@/lib/public-function-client";
import { logAudit } from "@/utils/auditLogger";
import { useAuth } from "@/hooks/useAuth";

interface PaystackTransaction {
  id: number;
  reference: string;
  amount: number;
  status: string;
  gateway_response: string;
  paid_at: string;
  created_at: string;
  customer: {
    email: string;
  };
  metadata?: {
    custom_fields?: Array<{ display_name: string; variable_name: string; value: string }>;
  };
}

interface OrderMatch {
  id: string;
  status: string;
  amount: number;
  created_at: string;
}

interface ReconciliationRow {
  paystack: PaystackTransaction;
  order: OrderMatch | null;
  matchStatus: "perfect" | "mismatch_amount" | "missing_order" | "failed_order" | "pending_payment";
}

const AdminReconciliation = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rows, setRows] = useState<ReconciliationRow[]>([]);
  const [filter, setFilter] = useState<"all" | "mismatch" | "missing" | "failed">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);

  const fetchReconciliationData = useCallback(async (isLoadMore = false) => {
    setLoading(true);
    try {
      // 1. Get transactions from Paystack via Edge Function
      const { data: psData, error: psError } = await supabase.functions.invoke("admin-user-actions", {
        body: { 
          action: "get_paystack_transactions", 
          page: isLoadMore ? page + 1 : 1,
          status: "success" // Only interested in successful payments for reconciliation
        },
      });

      if (psError || !psData?.success) throw new Error(psError?.message || "Failed to fetch Paystack data");

      const transactions: PaystackTransaction[] = psData.transactions;
      setMeta(psData.meta);
      if (isLoadMore) setPage(p => p + 1);

      // 2. Get corresponding orders from DB
      const references = transactions.map(t => t.reference);
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, status, amount, created_at")
        .in("id", references);

      if (ordersError) throw ordersError;

      const orderMap = new Map<string, OrderMatch>();
      ordersData?.forEach(o => orderMap.set(o.id, o));

      // 3. Match them up
      const newRows: ReconciliationRow[] = transactions.map(t => {
        const order = orderMap.get(t.reference) || null;
        const psAmountGHS = t.amount / 100;
        
        let matchStatus: ReconciliationRow["matchStatus"] = "perfect";
        if (!order) {
          matchStatus = "missing_order";
        } else if (order.status === "fulfillment_failed") {
          matchStatus = "failed_order";
        } else if (Math.abs(order.amount - psAmountGHS) > 0.01) {
          matchStatus = "mismatch_amount";
        } else if (order.status === "pending") {
          matchStatus = "pending_payment";
        }

        return { paystack: t, order, matchStatus };
      });

      setRows(prev => isLoadMore ? [...prev, ...newRows] : newRows);
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [page, toast]);

  useEffect(() => {
    fetchReconciliationData();
  }, []);

  const handleRetryFulfillment = async (reference: string) => {
    try {
      const { data, error } = await invokePublicFunctionAsUser("verify-payment", {
        body: { reference },
      });
      if (error) throw error;
      
      toast({ title: "Fulfillment Triggered", description: `Order ${reference.slice(0,8)} is being processed.` });
      
      if (currentUser) {
        await logAudit(currentUser.id, "reconciliation_retry", { reference });
      }
      
      // Refresh local data after a delay
      setTimeout(() => fetchReconciliationData(), 2000);
    } catch (err: any) {
      toast({ title: "Retry Failed", description: err.message, variant: "destructive" });
    }
  };

  const filteredRows = rows.filter(r => {
    const matchesSearch = r.paystack.reference.toLowerCase().includes(search.toLowerCase()) || 
                          r.paystack.customer.email.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filter === "all") return true;
    if (filter === "mismatch") return r.matchStatus === "mismatch_amount";
    if (filter === "missing") return r.matchStatus === "missing_order";
    if (filter === "failed") return r.matchStatus === "failed_order";
    return true;
  });

  const stats = {
    total: rows.length,
    mismatched: rows.filter(r => r.matchStatus !== "perfect").length,
    missing: rows.filter(r => r.matchStatus === "missing_order").length,
    failed: rows.filter(r => r.matchStatus === "failed_order").length,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-amber-500" />
            Financial Reconciliation
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Compare Paystack successful payments with internal order fulfillment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="border-white/10 bg-white/5 hover:bg-white/10"
            onClick={() => { setSyncing(true); fetchReconciliationData(); }}
            disabled={syncing}
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync Paystack
          </Button>
          <Button className="bg-amber-500 hover:bg-amber-400 text-black font-bold">
            <ArrowDownToLine className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Analyzed", value: stats.total, icon: Search, color: "text-blue-400" },
          { label: "Discrepancies", value: stats.mismatched, icon: AlertTriangle, color: stats.mismatched > 0 ? "text-red-400" : "text-green-400" },
          { label: "Missing Orders", value: stats.missing, icon: XCircle, color: stats.missing > 0 ? "text-orange-400" : "text-white/20" },
          { label: "Failed Fulfillment", value: stats.failed, icon: PlayCircle, color: stats.failed > 0 ? "text-amber-400" : "text-white/20" },
        ].map(s => (
          <Card key={s.label} className="bg-white/[0.03] border-white/5 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-white/5 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-black text-white">{s.value}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input 
            placeholder="Search by reference or customer email..." 
            className="pl-10 bg-white/5 border-white/10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
          {[
            { id: "all", label: "All" },
            { id: "mismatch", label: "Amount Mismatch" },
            { id: "missing", label: "Missing Orders" },
            { id: "failed", label: "Failed Orders" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${filter === f.id ? "bg-amber-500 text-black" : "text-white/40 hover:text-white hover:bg-white/5"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/5">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/30">Payment Info</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Paid Amount</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/30 text-center">Match Status</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/30">DB Order</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/30 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loading && rows.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-8">
                      <div className="h-12 w-full bg-white/5 animate-pulse rounded-xl" />
                    </td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-20 text-center">
                    <Filter className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <p className="text-white/40 font-bold">No discrepancies found</p>
                    <p className="text-[11px] text-white/20 uppercase tracking-widest mt-1">Everything looks perfectly balanced</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.paystack.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                          <CreditCard className="w-5 h-5 text-white/40" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white font-mono">{row.paystack.reference}</p>
                          <p className="text-[10px] text-white/30 truncate">{row.paystack.customer.email}</p>
                          <p className="text-[9px] text-white/20 mt-0.5 italic">{new Date(row.paystack.paid_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-sm font-black text-white">GH₵{(row.paystack.amount / 100).toFixed(2)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-center gap-1">
                        {row.matchStatus === "perfect" ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Matched
                          </div>
                        ) : row.matchStatus === "missing_order" ? (
                          <div className="flex items-center gap-1.5 text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <XCircle className="w-3 h-3" /> Missing Order
                          </div>
                        ) : row.matchStatus === "failed_order" ? (
                          <div className="flex items-center gap-1.5 text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" /> Delivery Failed
                          </div>
                        ) : row.matchStatus === "pending_payment" ? (
                          <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <Clock className="w-3 h-3" /> Pending
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" /> Amount Mismatch
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {row.order ? (
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${row.order.status === 'fulfilled' ? 'text-emerald-400' : 'text-white/60'}`}>
                            {row.order.status.toUpperCase()}
                          </p>
                          <p className="text-[10px] text-white/30">DB Amt: GH₵{row.order.amount.toFixed(2)}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-white/10 italic">No record found</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {row.matchStatus !== "perfect" && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 text-[10px] font-bold bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                            onClick={() => handleRetryFulfillment(row.paystack.reference)}
                          >
                            <PlayCircle className="w-3 h-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                        <a 
                          href={`https://dashboard.paystack.com/#/transactions/${row.paystack.id}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-white/40 group-hover:text-white" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Load More */}
      {meta && rows.length < meta.total && (
        <div className="flex justify-center pt-4">
          <Button 
            variant="ghost" 
            className="text-white/40 hover:text-white hover:bg-white/5"
            onClick={() => fetchReconciliationData(true)}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownToLine className="w-4 h-4 mr-2" />}
            Load More Transactions
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminReconciliation;
