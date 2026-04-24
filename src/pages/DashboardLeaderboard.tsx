import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Medal, Star, TrendingUp, AlertCircle, Award, Target, Flame } from "lucide-react";
import { useAppTheme } from "@/contexts/ThemeContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface LeaderboardEntry {
  rank_position: number;
  agent_name: string;
  day_orders: number;
  week_orders: number;
  is_current_user: boolean;
}

const DashboardLeaderboard = () => {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useAppTheme();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data: result, error: rpcError } = await supabase.rpc("get_agent_leaderboard");
        
        if (rpcError) {
          throw rpcError;
        }
        
        setData(result || []);
      } catch (err: any) {
        setError(err.message || "Could not load leaderboard data. Please make sure the latest database updates are applied.");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const topThree = data.slice(0, 3);
  const others = data.slice(3);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto flex flex-col gap-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
          <AlertCircle className="w-12 h-12 mb-4 opacity-80" />
          <h2 className="text-xl font-black">Leaderboard Unavailable</h2>
          <p className="text-sm mt-1 opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto pb-24">
      {/* ── Header Section ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white shadow-2xl">
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-white/10 border-white/20 text-white font-black uppercase tracking-widest text-[10px]">
                Global Rankings
              </Badge>
              <div className="flex items-center gap-1 text-amber-400">
                <Flame className="w-3 h-3 fill-amber-400" />
                <span className="text-[10px] font-black uppercase">Live</span>
              </div>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
              Agent Leaderboard <Trophy className="w-8 h-8 text-amber-400" />
            </h1>
            <p className="text-indigo-100 font-medium max-w-md">
              The highest performing agents of the week. Scale your sales to claim your spot on the podium!
            </p>
          </div>
          <div className="flex items-center gap-6 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-black">{data.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Active Agents</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="space-y-1">
              <p className="text-2xl font-black">{data.reduce((acc, curr) => acc + curr.day_orders, 0)}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Daily Sales</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── The Podium (Top 3) ── */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          {/* Rank 2 */}
          {topThree[1] && (
            <Card className="border-none bg-card/60 backdrop-blur-sm shadow-xl order-2 md:order-1 relative group overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gray-400" />
              <CardContent className="p-6 text-center space-y-4">
                <div className="relative inline-block">
                  <div className="w-16 h-16 rounded-2xl bg-gray-400/10 flex items-center justify-center text-gray-400 border border-gray-400/20">
                    <Medal className="w-8 h-8" />
                  </div>
                  <div className="absolute -top-2 -right-2 bg-gray-400 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">2</div>
                </div>
                <div>
                  <h3 className="font-black text-lg truncate px-2">{topThree[1].agent_name}</h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase">Silver Tier</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <div className="space-y-0.5">
                    <p className="text-lg font-black">{topThree[1].day_orders}</p>
                    <p className="text-[8px] font-bold uppercase text-muted-foreground">Today</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-lg font-black">{topThree[1].week_orders}</p>
                    <p className="text-[8px] font-bold uppercase text-muted-foreground">Week</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rank 1 */}
          {topThree[0] && (
            <Card className="border-none bg-card shadow-2xl order-1 md:order-2 relative group overflow-hidden scale-105 z-10">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-400 to-amber-600" />
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl group-hover:bg-amber-400/20 transition-all" />
              <CardContent className="p-8 text-center space-y-6">
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-3xl bg-amber-400/10 flex items-center justify-center text-amber-500 border-2 border-amber-400/20 shadow-inner">
                    <Trophy className="w-12 h-12" />
                  </div>
                  <div className="absolute -top-3 -right-3 bg-amber-500 text-white text-xs font-black w-10 h-10 rounded-full flex items-center justify-center shadow-xl ring-4 ring-card">1</div>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <h3 className="font-black text-2xl truncate">{topThree[0].agent_name}</h3>
                    {topThree[0].is_current_user && <Star className="w-5 h-5 text-amber-500 fill-amber-500" />}
                  </div>
                  <Badge className="bg-amber-400/10 text-amber-500 border-amber-400/20 font-black uppercase tracking-widest text-[10px]">
                    Elite Reseller
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="space-y-1">
                    <p className="text-2xl font-black">{topThree[0].day_orders}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Orders Today</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black">{topThree[0].week_orders}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Orders Week</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rank 3 */}
          {topThree[2] && (
            <Card className="border-none bg-card/60 backdrop-blur-sm shadow-xl order-3 relative group overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-700/60" />
              <CardContent className="p-6 text-center space-y-4">
                <div className="relative inline-block">
                  <div className="w-16 h-16 rounded-2xl bg-amber-700/10 flex items-center justify-center text-amber-700 border border-amber-700/20">
                    <Medal className="w-8 h-8" />
                  </div>
                  <div className="absolute -top-2 -right-2 bg-amber-700 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">3</div>
                </div>
                <div>
                  <h3 className="font-black text-lg truncate px-2">{topThree[2].agent_name}</h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase">Bronze Tier</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <div className="space-y-0.5">
                    <p className="text-lg font-black">{topThree[2].day_orders}</p>
                    <p className="text-[8px] font-bold uppercase text-muted-foreground">Today</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-lg font-black">{topThree[2].week_orders}</p>
                    <p className="text-[8px] font-bold uppercase text-muted-foreground">Week</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── All Other Agents ── */}
      <Card className="border-none bg-card shadow-lg overflow-hidden">
        <CardHeader className="border-b border-white/5 px-6 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-500" />
            Other Contenders
          </CardTitle>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {others.length} Agents Listed
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {others.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm font-medium">
              Join the competition! Make a sale today to appear on the leaderboard.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-black/20 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 text-center w-16">Rank</th>
                    <th className="px-6 py-4">Agent Name</th>
                    <th className="px-6 py-4 text-center">Orders Today</th>
                    <th className="px-6 py-4 text-center">Orders Week</th>
                    <th className="px-6 py-4 text-right pr-10">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {others.map((row) => (
                    <tr 
                      key={row.agent_name + row.rank_position} 
                      className={`group transition-all ${row.is_current_user ? "bg-primary/5" : "hover:bg-white/5"}`}
                    >
                      <td className="px-6 py-4 text-center font-black text-muted-foreground">
                        {row.rank_position}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                            row.is_current_user ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"
                          }`}>
                            {row.agent_name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm flex items-center gap-2">
                              {row.agent_name}
                              {row.is_current_user && (
                                <Badge className="h-4 text-[8px] px-1.5 font-black uppercase">You</Badge>
                              )}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">Verified Agent</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-black">{row.day_orders}</span>
                      </td>
                      <td className="px-6 py-4 text-center text-muted-foreground">
                        <span className="text-sm font-medium">{row.week_orders}</span>
                      </td>
                      <td className="px-6 py-4 text-right pr-10">
                        <div className="flex items-center justify-end gap-1.5 text-green-500">
                          <TrendingUp className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Rising</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* ── Footer / Tips ── */}
      <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col md:flex-row items-center gap-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
          <Target className="w-6 h-6" />
        </div>
        <div className="flex-1 text-center md:text-left space-y-1">
          <h4 className="font-bold">Climb the Ranks</h4>
          <p className="text-xs text-muted-foreground">The Top 10 agents are rewarded with exclusive discounts, early access to new data networks, and priority support. Keep the momentum going!</p>
        </div>
        <Button variant="outline" className="font-bold h-11 px-8 rounded-xl border-indigo-500/20 hover:bg-indigo-500/5">
          Reseller Tips
        </Button>
      </div>
    </div>
  );
};

export default DashboardLeaderboard;

