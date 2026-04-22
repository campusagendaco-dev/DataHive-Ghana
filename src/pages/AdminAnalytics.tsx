import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Smartphone, Zap, Loader2 } from "lucide-react";

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProfit: 0,
    activeAgents: 0,
    topNetwork: "N/A",
  });

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      
      // 1. Calculate Total Profit
      const { data: orders } = await supabase
        .from("orders")
        .select("profit, network")
        .neq("status", "failed");

      const totalProfit = orders?.reduce((acc, order) => acc + (Number(order.profit) || 0), 0) || 0;

      // 2. Count Active Agents (agents with at least 1 order)
      const uniqueAgents = new Set(orders?.map(o => o.agent_id).filter(Boolean));
      const activeAgentsCount = uniqueAgents.size;

      // 3. Determine Top Network
      const networkCounts: Record<string, number> = {};
      orders?.forEach(o => {
        if (o.network) {
          networkCounts[o.network] = (networkCounts[o.network] || 0) + 1;
        }
      });
      
      let topNetwork = "N/A";
      let maxCount = 0;
      for (const [net, count] of Object.entries(networkCounts)) {
        if (count > maxCount) {
          maxCount = count;
          topNetwork = net;
        }
      }

      setStats({
        totalProfit,
        activeAgents: activeAgentsCount,
        topNetwork,
      });
      
      setLoading(false);
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <div>
        <h1 className="font-display text-2xl font-bold">Financial Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Track profit margins, network volume, and top performers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" /> Total Net Profit
            </CardDescription>
            <CardTitle className="text-3xl font-black">
              {loading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : `GH₵ ${stats.totalProfit.toFixed(2)}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mt-1">Calculated from Sell Price vs API Cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Active Resellers
            </CardDescription>
            <CardTitle className="text-3xl font-black">
              {loading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : stats.activeAgents}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mt-1">Agents generating volume this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-500" /> Top Network
            </CardDescription>
            <CardTitle className="text-3xl font-black">
              {loading ? <Loader2 className="w-6 h-6 animate-spin inline" /> : stats.topNetwork}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mt-1">Highest sales volume by network</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" /> Platform Insights
          </CardTitle>
          <CardDescription>Visual breakdown of revenue vs API costs.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center border-t border-white/5">
          <p className="text-muted-foreground text-sm flex flex-col items-center gap-2">
            <BarChart3 className="w-8 h-8 opacity-20" />
            Charts are gathering data from your real-time orders.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
