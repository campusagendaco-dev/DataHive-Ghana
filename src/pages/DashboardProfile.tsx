import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  User, Mail, Phone, Store, ShieldCheck, Trophy, 
  TrendingUp, ShoppingCart, Award, Calendar, Activity,
  ChevronRight, BadgeCheck, Copy, ExternalLink, Settings,
  Zap, Heart, Target, Star
} from "lucide-react";
import { useAppTheme } from "@/contexts/ThemeContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProfileStats {
  total_fulfilled_orders: number;
  total_sales_volume: number;
  total_own_profit: number;
  rank_position?: number;
}

const DashboardProfile = () => {
  const { user, profile } = useAuth();
  const { theme } = useAppTheme();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchProfileData = async () => {
      try {
        // Fetch sales stats from view
        const { data: statsData } = await supabase
          .from("user_sales_stats")
          .select("*")
          .eq("user_id", user.id)
          .single();

        // Fetch rank from leaderboard RPC
        const { data: leaderboardData } = await supabase.rpc("get_agent_leaderboard");
        const myRank = leaderboardData?.find((entry: any) => entry.is_current_user)?.rank_position;

        setStats({
          total_fulfilled_orders: statsData?.total_fulfilled_orders || 0,
          total_sales_volume: statsData?.total_sales_volume || 0,
          total_own_profit: statsData?.total_own_profit || 0,
          rank_position: myRank
        });
      } catch (error) {
        console.error("Error fetching profile stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  const isPaidAgent = Boolean(profile?.agent_approved || profile?.sub_agent_approved);
  const accountType = isPaidAgent ? (profile?.is_sub_agent ? "Sub-Agent" : "Direct Agent") : "Regular Customer";
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const accountId = (profile as any)?.topup_reference || "PENDING";

  return (
    <div className="min-h-screen pb-24">
      {/* ── Premium Hero Section ── */}
      <div className="relative h-48 sm:h-64 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        
        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-5%] w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 sm:-mt-24 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* ── Left Sidebar / Profile Info ── */}
          <div className="w-full md:w-80 space-y-6">
            <Card className="border-none bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden ring-1 ring-white/10">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
                  <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-card relative">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`} />
                    <AvatarFallback className="text-2xl bg-primary/10">
                      {profile?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isPaidAgent && (
                    <div className="absolute bottom-1 right-1 bg-blue-500 text-white p-1.5 rounded-full border-4 border-card shadow-lg">
                      <BadgeCheck className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-1">
                  <h2 className="text-xl font-black tracking-tight">{profile?.full_name || "New User"}</h2>
                  <p className="text-sm text-muted-foreground font-medium">{user?.email}</p>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary px-3 py-1 text-[10px] uppercase tracking-wider font-bold">
                    {accountType}
                  </Badge>
                  {profile?.onboarding_complete && (
                    <Badge variant="outline" className="bg-green-500/5 border-green-500/20 text-green-500 px-3 py-1 text-[10px] uppercase tracking-wider font-bold">
                      Verified
                    </Badge>
                  )}
                </div>

                <div className="w-full mt-6 pt-6 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> Account ID
                    </span>
                    <button 
                      onClick={() => copyToClipboard(`DH-${accountId}`, "Account ID")}
                      className="font-mono font-bold hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      DH-{accountId}
                      <Copy className="w-3 h-3 opacity-50" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Joined
                    </span>
                    <span className="font-semibold">
                      {new Date(profile?.created_at || "").toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={() => window.location.href = '/dashboard/settings'}
                  variant="outline" 
                  className="w-full mt-6 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 font-bold"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats Mini-Card */}
            <Card className="border-none bg-indigo-600/10 border border-indigo-500/20 shadow-sm overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/20">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Activity Level</p>
                    <p className="text-sm font-black">Professional</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="text-indigo-400">85%</span>
                  </div>
                  <Progress value={85} className="h-1.5 bg-indigo-600/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Main Content Area ── */}
          <div className="flex-1 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Orders", value: stats?.total_fulfilled_orders, icon: ShoppingCart, color: "blue" },
                { label: "Sales Volume", value: `₵${stats?.total_sales_volume.toFixed(0)}`, icon: TrendingUp, color: "amber" },
                { label: "Total Profit", value: `₵${stats?.total_own_profit.toFixed(0)}`, icon: Award, color: "green" },
                { label: "Global Rank", value: stats?.rank_position ? `#${stats.rank_position}` : "—", icon: Trophy, color: "purple" },
              ].map((item, i) => (
                <Card key={i} className="border-none bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                  <div className={`absolute -right-2 -bottom-2 w-16 h-16 opacity-5 group-hover:opacity-10 transition-opacity`}>
                    <item.icon className="w-full h-full" />
                  </div>
                  <CardContent className="p-4 flex flex-col gap-1">
                    <div className={`p-2 rounded-lg w-fit mb-1 bg-${item.color}-500/10 text-${item.color}-500`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                    {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-lg font-black">{item.value}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-card/50 backdrop-blur-sm border border-white/5 p-1">
                <TabsTrigger value="overview" className="font-bold px-6">Overview</TabsTrigger>
                <TabsTrigger value="performance" className="font-bold px-6">Performance</TabsTrigger>
                <TabsTrigger value="store" className="font-bold px-6">My Store</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Account Details */}
                  <Card className="border-none bg-card shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        Account Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {[
                        { label: "Store Name", value: profile?.store_name || "Not set", icon: Store },
                        { label: "Phone", value: profile?.phone || "Not set", icon: Phone },
                        { label: "WhatsApp", value: profile?.whatsapp_number || "Not set", icon: Activity },
                        { label: "Referral ID", value: profile?.topup_reference || "N/A", icon: Target },
                      ].map((item) => (
                        <div key={item.label} className="group">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5">
                            <item.icon className="w-3 h-3" />
                            {item.label}
                          </p>
                          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Ranking Insights */}
                  <Card className="border-none bg-gradient-to-br from-purple-600/10 to-indigo-600/5 shadow-md relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Trophy className="w-24 h-24" />
                    </div>
                    <CardHeader>
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-400" />
                        Leaderboard Status
                      </CardTitle>
                      <CardDescription>Your current standing among all agents</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-end gap-3">
                        <p className="text-5xl font-black leading-none bg-gradient-to-br from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                          {stats?.rank_position ? `#${stats.rank_position}` : "N/A"}
                        </p>
                        <p className="text-xs text-muted-foreground font-bold uppercase pb-1">Current Ranking</p>
                      </div>
                      <div className="space-y-2">
                        <div className="w-full bg-white/5 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.5)] transition-all duration-1000" 
                            style={{ width: stats?.rank_position ? `${Math.max(15, 100 - (stats.rank_position * 2))}%` : '5%' }} 
                          />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Maintain high sales volume to reach the <b>Top 10</b> and unlock exclusive agent rewards.
                        </p>
                      </div>
                      <Button 
                        onClick={() => window.location.href = '/dashboard/leaderboard'}
                        variant="secondary"
                        className="w-full font-bold group"
                      >
                        Explore Leaderboard
                        <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions Footer */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Store", path: "/dashboard/my-store", icon: Store, color: "bg-blue-500/10 text-blue-500" },
                    { label: "Wallet", path: "/dashboard/wallet", icon: Zap, color: "bg-amber-500/10 text-amber-500" },
                    { label: "Orders", path: "/dashboard/orders", icon: ShoppingCart, color: "bg-green-500/10 text-green-500" },
                    { label: "Support", path: "/dashboard/report-issue", icon: Mail, color: "bg-purple-500/10 text-purple-500" },
                  ].map((action, i) => (
                    <button
                      key={i}
                      onClick={() => window.location.href = action.path}
                      className="flex flex-col items-center justify-center p-4 rounded-2xl bg-card border border-white/5 hover:border-primary/30 transition-all hover:-translate-y-1"
                    >
                      <div className={`p-3 rounded-xl mb-2 ${action.color}`}>
                        <action.icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider">{action.label}</span>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="performance" className="focus-visible:outline-none">
                <Card className="border-none bg-card shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      Sales Analytics
                    </CardTitle>
                    <CardDescription>Detailed breakdown of your business performance</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 py-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="text-center space-y-2">
                        <p className="text-3xl font-black">₵{stats?.total_own_profit.toFixed(2)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lifetime Profit</p>
                        <div className="h-1 w-12 bg-green-500 mx-auto rounded-full mt-2" />
                      </div>
                      <div className="text-center space-y-2 border-x border-white/5">
                        <p className="text-3xl font-black">{stats?.total_fulfilled_orders}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Successful Trades</p>
                        <div className="h-1 w-12 bg-blue-500 mx-auto rounded-full mt-2" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-3xl font-black">₵{stats?.total_sales_volume.toFixed(0)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Turnover Volume</p>
                        <div className="h-1 w-12 bg-amber-500 mx-auto rounded-full mt-2" />
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col sm:flex-row items-center gap-6">
                      <div className="p-4 bg-primary/10 rounded-full">
                        <Award className="w-8 h-8 text-primary" />
                      </div>
                      <div className="space-y-1 text-center sm:text-left flex-1">
                        <h4 className="font-bold">Next Milestone: Top 10 Agent</h4>
                        <p className="text-xs text-muted-foreground">Keep processing orders to increase your sales volume and climb the leaderboard. Top 10 agents get reduced rates!</p>
                      </div>
                      <Button variant="default" className="font-bold whitespace-nowrap shadow-lg shadow-primary/20">
                        View Incentives
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="store" className="focus-visible:outline-none">
                <Card className="border-none bg-card shadow-sm overflow-hidden">
                  <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-700 relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      <Store className="w-24 h-24 text-white" />
                    </div>
                  </div>
                  <CardContent className="p-8 -mt-12 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-end gap-4 mb-6">
                      <div className="w-20 h-20 rounded-2xl bg-card border-4 border-card shadow-xl flex items-center justify-center">
                        <Store className="w-10 h-10 text-primary" />
                      </div>
                      <div className="pb-2">
                        <h3 className="text-xl font-black">{profile?.store_name || "Your Store"}</h3>
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> 
                          {profile?.slug ? `swiftdata.gh/store/${profile.slug}` : "Store link pending setup"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Button 
                        disabled={!profile?.slug}
                        onClick={() => window.open(`/store/${profile?.slug}`, '_blank')}
                        className="font-bold h-12 rounded-xl"
                      >
                        Visit Public Store
                      </Button>
                      <Button 
                        onClick={() => window.location.href = '/dashboard/my-store'}
                        variant="secondary" 
                        className="font-bold h-12 rounded-xl"
                      >
                        Configure Storefront
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardProfile;

