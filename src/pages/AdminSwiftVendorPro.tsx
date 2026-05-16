import { useState, useEffect } from "react"; // Rebuild Triggered: 2026-05-15
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, TrendingUp, ShieldAlert, Globe, Zap, 
  Settings, Lock, Unlock, RefreshCw, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, DollarSign, Activity, Wallet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetTrigger
} from "@/components/ui/sheet";

const AdminSwiftVendorPro = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [systemStats, setSystemStats] = useState({
    totalFloat: 0,
    totalProfit: 0,
    activeVendors: 0,
    failedToday: 0
  });
  
  const [config, setConfig] = useState({
    momoSplit: 50,
    africaMargin: 2.5,
    isFrozen: false
  });

  useEffect(() => {
    fetchVendors();
    fetchSystemRules();
  }, []);

  const fetchSystemRules = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("sub_agent_base_fee, at_markup_percentage, maintenance_mode")
        .single();
      
      if (error) throw error;
      if (data) {
        setConfig({
          momoSplit: data.sub_agent_base_fee,
          africaMargin: data.at_markup_percentage || 0,
          isFrozen: data.maintenance_mode || false
        });
      }
    } catch (err) {
      console.error("Failed to fetch rules");
    }
  };

  const saveSystemRules = async () => {
    setSavingRules(true);
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({
          sub_agent_base_fee: config.momoSplit,
          at_markup_percentage: config.africaMargin,
          maintenance_mode: config.isFrozen
        })
        .eq("id", 1); // Assuming ID 1 is the main settings

      if (error) throw error;
      toast.success("Global System Rules Synchronized");
    } catch (err: any) {
      toast.error(err.message || "Failed to sync rules");
    } finally {
      setSavingRules(false);
    }
  };

  const fetchVendors = async () => {
    setLoading(true);
    try {
      // Fetch all wallets (vendors)
      const { data: wallets, error: wError } = await supabase
        .from("wallets")
        .select(`
          id, 
          balance, 
          agent_id,
          profiles:agent_id(full_name, phone, store_name, terminal_locked)
        `);

      if (wError) throw wError;

      // Fetch Today's stats for each vendor
      const today = new Date();
      today.setHours(0,0,0,0);

      const { data: orders } = await supabase
        .from("orders")
        .select("agent_id, amount, profit, parent_profit, status")
        .gte("created_at", today.toISOString());

      const vendorData = wallets.map(w => {
        const vendorOrders = orders?.filter(o => o.agent_id === w.agent_id) || [];
        const successOrders = vendorOrders.filter(o => o.status === "fulfilled");
        
        return {
          ...w,
          business_name: w.profiles?.store_name || "Unknown Business",
          agent_name: w.profiles?.full_name || "Unknown Agent",
          terminal_locked: w.profiles?.terminal_locked || false,
          today_profit: successOrders.reduce((acc, curr) => acc + (Number(curr.profit) + Number(curr.parent_profit || 0)), 0),
          today_count: successOrders.length,
          status: vendorOrders.some(o => o.status === "failed") ? "Warning" : "Healthy"
        };
      });

      setVendors(vendorData);
      
      // Global Stats
      setSystemStats({
        totalFloat: vendorData.reduce((acc, v) => acc + Number(v.balance), 0),
        totalProfit: vendorData.reduce((acc, v) => acc + v.today_profit, 0),
        activeVendors: vendorData.length,
        failedToday: orders?.filter(o => o.status === "failed").length || 0
      });

    } catch (err: any) {
      toast.error("Failed to fetch vendor data");
    } finally {
      setLoading(false);
    }
  };

  const toggleVendorLock = async (agentId: string, currentlyLocked: boolean) => {
    try {
      const action = currentlyLocked ? 'unlock' : 'lock';
      const { data, error } = await supabase.functions.invoke("admin-vendor-security", {
        body: { agent_id: agentId, action }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data.message || `Terminal ${currentlyLocked ? 'unlocked' : 'locked'} successfully`);
      fetchVendors(); // Refresh UI
    } catch (err: any) {
      toast.error(err.message || "Security override failed");
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10 bg-[#0a0a0b] min-h-screen text-white">
      {/* Super Pro Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 italic uppercase">
            <ShieldAlert className="w-10 h-10 text-primary animate-pulse" />
            Swift Vendor Master
          </h1>
          <p className="text-muted-foreground mt-2 font-bold tracking-widest text-xs uppercase">Institutional Control Console • v2.0 Pro</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl border-white/5 bg-white/5 font-black gap-2 h-12 px-6" onClick={fetchVendors}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Sync Network
          </Button>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button className="rounded-2xl font-black gap-2 h-12 px-6 shadow-xl shadow-primary/20">
                <Settings className="w-4 h-4" />
                System Rules
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-[#0a0a0b] border-white/5 text-white w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="text-2xl font-black text-primary uppercase italic">Tactical Rules</SheetTitle>
                <SheetDescription className="text-muted-foreground">Adjust institutional parameters across the entire network.</SheetDescription>
              </SheetHeader>
              
              <div className="space-y-8 mt-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Zap className="w-3 h-3 text-indigo-400" />
                    Global MoMo Split (%)
                  </label>
                  <div className="flex items-center gap-4">
                    <Input 
                      type="number" 
                      value={config.momoSplit} 
                      onChange={(e) => setConfig({...config, momoSplit: Number(e.target.value)})}
                      className="bg-white/5 border-none h-14 rounded-2xl font-black text-center text-xl" 
                    />
                    <span className="text-xl font-black text-indigo-400">%</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Globe className="w-3 h-3 text-emerald-400" />
                    Africa Hub Margin (%)
                  </label>
                  <div className="flex items-center gap-4">
                    <Input 
                      type="number" 
                      value={config.africaMargin} 
                      onChange={(e) => setConfig({...config, africaMargin: Number(e.target.value)})}
                      className="bg-white/5 border-none h-14 rounded-2xl font-black text-center text-xl" 
                    />
                    <span className="text-xl font-black text-emerald-400">%</span>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-red-500/5 border border-red-500/10 space-y-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <Lock className="w-5 h-5 text-red-500" />
                         <span className="font-black text-sm uppercase">Emergency Freeze</span>
                      </div>
                      <Button 
                        variant={config.isFrozen ? "default" : "outline"}
                        className={cn("rounded-xl font-black h-10", config.isFrozen ? "bg-red-500 hover:bg-red-600" : "border-red-500/20 text-red-500")}
                        onClick={() => setConfig({...config, isFrozen: !config.isFrozen})}
                      >
                        {config.isFrozen ? "ACTIVE" : "OFF"}
                      </Button>
                   </div>
                   <p className="text-[10px] font-medium text-red-400 leading-relaxed italic">
                     "Activating this will instantly suspend all transaction capabilities across the entire Swift Vendor network."
                   </p>
                </div>

                <Button 
                  className="w-full h-16 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20 gap-3"
                  onClick={saveSystemRules}
                  disabled={savingRules}
                >
                  {savingRules ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
                  Synchronize Rules
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Global Pulse Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Network Float", value: `₵${systemStats.totalFloat.toLocaleString()}`, icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
          { label: "Consolidated Profit", value: `₵${systemStats.totalProfit.toFixed(2)}`, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Active Terminals", value: systemStats.activeVendors, icon: Activity, color: "text-indigo-400", bg: "bg-indigo-400/10" },
          { label: "Network Failures", value: systemStats.failedToday, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10" },
        ].map((stat, i) => (
          <Card key={i} className="border-none bg-white/5 backdrop-blur-xl shadow-2xl">
            <CardContent className="p-6 flex items-center gap-5">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", stat.bg)}>
                <stat.icon className={cn("w-7 h-7", stat.color)} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-black tracking-tight">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Vendor Fleet List */}
        <Card className="lg:col-span-2 border-none bg-white/5 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
               <Users className="w-5 h-5 text-primary" />
               Vendor Fleet Management
            </CardTitle>
            <CardDescription className="font-medium">Real-time status of all deployed POS terminals</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vendor Details</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Live Float</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Daily Yield</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center">Health</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-black text-primary">
                            {v.business_name[0]}
                          </div>
                          <div>
                            <p className="font-black text-sm">{v.business_name}</p>
                            <p className="text-[10px] font-bold text-muted-foreground">{v.agent_name} • {v.profiles?.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <p className="font-black text-primary">₵{Number(v.balance).toFixed(2)}</p>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          <p className="font-black text-emerald-500">₵{v.today_profit.toFixed(2)}</p>
                          <p className="text-[8px] font-black text-muted-foreground uppercase">{v.today_count} Trx</p>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={cn(
                          "rounded-lg border-none text-[8px] font-black px-2 h-5",
                          v.status === "Healthy" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                        )}>
                          {v.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10">
                            <Zap className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn("h-8 w-8 rounded-lg", v.terminal_locked ? "text-emerald-500 hover:bg-emerald-500/10" : "text-red-400 hover:bg-red-400/10")}
                            onClick={() => toggleVendorLock(v.agent_id, v.terminal_locked)}
                            title={v.terminal_locked ? "Unlock Terminal" : "Lock Terminal"}
                          >
                            {v.terminal_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Global Rules Panel */}
        <div className="space-y-6">
          <Card className="border-none bg-white/5 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-indigo-400">
                 <Zap className="w-5 h-5" />
                 Profit Split Logic
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="space-y-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">MoMo Split (Vendor %)</label>
                    <div className="flex items-center gap-3">
                       <Input type="number" defaultValue="50" className="bg-white/5 border-none font-black h-12 rounded-xl text-center" />
                       <span className="font-black text-indigo-400">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Africa Hub Margin</label>
                    <div className="flex items-center gap-3">
                       <Input type="number" defaultValue="2.5" className="bg-white/5 border-none font-black h-12 rounded-xl text-center" />
                       <span className="font-black text-indigo-400">%</span>
                    </div>
                  </div>
                  <Button className="w-full h-12 rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">
                    Apply Global Rates
                  </Button>
               </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-primary/5 backdrop-blur-xl border border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                 <Globe className="w-5 h-5 text-primary" />
                 Africa Hub Gateway
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20">
                  <span className="text-sm font-bold">Pan-African Transfers</span>
                  <Badge className="bg-emerald-500 text-white font-black text-[8px] px-2">ONLINE</Badge>
               </div>
               <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20">
                  <span className="text-sm font-bold">Identity Resolution (KYC)</span>
                  <Badge className="bg-emerald-500 text-white font-black text-[8px] px-2">ACTIVE</Badge>
               </div>
               <p className="text-[10px] font-bold text-muted-foreground px-2 leading-relaxed italic">
                 "Super Pro admin can monitor international payouts in real-time and adjust currency buffer rates for maximum profitability."
               </p>
            </CardContent>
          </Card>

          <Button variant="outline" className="w-full h-14 rounded-2xl border-red-500/20 text-red-400 hover:bg-red-400/10 font-black gap-2">
            <Lock className="w-4 h-4" />
            Emergency Network Freeze
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSwiftVendorPro;
