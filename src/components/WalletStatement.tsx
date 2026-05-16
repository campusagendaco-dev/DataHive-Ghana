
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, ArrowDownCircle, ArrowUpCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface StatementRow {
  id: string;
  created_at: string;
  type: 'deposit' | 'purchase' | 'withdrawal' | 'refund';
  description: string;
  amount: number;
  status: string;
}

export const WalletStatement = ({ userId }: { userId: string }) => {
  const [statement, setStatement] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchStatement = async () => {
      setLoading(true);
      
      // Fetch all orders (includes topups and purchases)
      const { data: orders } = await supabase
        .from("orders")
        .select("id, created_at, order_type, amount, status, network, package_size")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false });

      // Fetch all withdrawals
      const { data: withdrawals } = await supabase
        .from("withdrawals")
        .select("id, created_at, amount, status")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false });

      const combined: StatementRow[] = [];

      orders?.forEach(o => {
        if (o.status === 'failed' || o.status === 'cancelled') return; // Skip failed attempts as they didn't deduct funds

        if (o.order_type === 'wallet_topup') {
          if (o.status !== 'fulfilled') return; // Only show successful topups as deposits
          combined.push({
            id: o.id,
            created_at: o.created_at,
            type: 'deposit',
            description: 'Wallet Top-up (Paystack)',
            amount: Number(o.amount),
            status: o.status
          });
        } else {
          // For purchases, show them if they are fulfilled or processing
          combined.push({
            id: o.id,
            created_at: o.created_at,
            type: 'purchase',
            description: `${o.network || ''} ${o.package_size || ''} Data Bundle`,
            amount: Number(o.amount),
            status: o.status
          });
        }
      });

      withdrawals?.forEach(w => {
        combined.push({
          id: w.id,
          created_at: w.created_at,
          type: 'withdrawal',
          description: 'Cash Withdrawal',
          amount: Number(w.amount),
          status: w.status
        });
      });

      setStatement(combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setLoading(false);
    };

    if (userId) fetchStatement();
  }, [userId]);

  const filtered = statement.filter(s => 
    s.description.toLowerCase().includes(search.toLowerCase()) || 
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;

  return (
    <Card className="border-border bg-card shadow-sm overflow-hidden rounded-[2rem]">
      <CardHeader className="p-6 border-b border-border flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-sm font-black uppercase tracking-widest">Account Statement</CardTitle>
        </div>
        <div className="relative w-full max-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <Input 
            placeholder="Search..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/30 border-border rounded-lg"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b border-border">
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Description</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-right">Amount (GHS)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id} className="border-b border-border/5 hover:bg-muted/10 transition-colors">
                  <TableCell className="text-[10px] font-medium text-muted-foreground py-4">
                    {new Date(row.created_at).toLocaleString("en-GH", { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      {row.type === 'deposit' ? <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowUpCircle className="w-3.5 h-3.5 text-amber-500" />}
                      <span className="text-xs font-bold text-foreground">{row.description}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">{row.id}</p>
                  </TableCell>
                  <TableCell className={`text-right text-xs font-black py-4 ${row.type === 'deposit' ? "text-emerald-500" : (row.status === 'failed' || row.status === 'cancelled') ? "text-muted-foreground/40 line-through" : "text-foreground"}`}>
                    {row.type === 'deposit' ? '+' : '-'}{row.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center py-4">
                    <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-tighter ${row.status === 'fulfilled' || row.status === 'completed' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"}`}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-20 text-center text-muted-foreground/30 italic text-xs">
                    No transactions found for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
