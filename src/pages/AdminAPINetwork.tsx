import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, Key, ShieldCheck, Search, Trash2, 
  Terminal, Globe, Zap, ShieldAlert, Lock, Unlock, 
  RefreshCw, TrendingUp, Users, ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AdminAPINetwork = () => {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    totalKeys: 0,
    totalDailySpend: 0,
    estimatedYield: 0,
    activeAgents: 0
  });

  useEffect(() => {
    fetchGlobalAPIState();
  }, []);

  const fetchGlobalAPIState = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_api_keys")
        .select(`
          *,
          profiles:agent_id(full_name, store_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setKeys(data || []);
      
      // Calculate Stats
      const activeKeys = data?.filter(k => k.is_active) || [];
      const dailySpend = data?.reduce((acc, k) => acc + Number(k.current_daily_spend), 0) || 0;
      const uniqueAgents = new Set(data?.map(k => k.agent_id)).size;

      setStats({
        totalKeys: data?.length || 0,
        totalDailySpend: dailySpend,
        estimatedYield: dailySpend * 0.02, // Example platform cut
        activeAgents: uniqueAgents
      });
    } catch (err: any) {
      toast.error("Failed to fetch API network state");
    } finally {
      setLoading(false);
    }
  };

  const toggleKeyStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("agent_api_keys")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Key ${currentStatus ? 'suspended' : 'restored'} successfully`);
      setKeys(keys.map(k => k.id === id ? { ...k, is_active: !currentStatus } : k));
    } catch (err: any) {
      toast.error("Emergency override failed");
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm("GLOBAL REVOCATION: This will permanently break the developer integration. Continue?")) return;
    try {
      const { error } = await supabase
        .from("agent_api_keys")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Developer Access Revoked Globally");
      setKeys(keys.filter(k => k.id !== id));
    } catch (err: any) {
      toast.error("Revocation failed");
    }
  };

  const filteredKeys = keys.filter(k => 
    k.key_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.profiles?.store_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 italic uppercase">
            <Activity className="w-8 h-8 text-amber-500" />
            API Network Intelligence
          </h1>
          <p className="text-muted-foreground mt-1 font-medium italic">Master Oversight: Decentralized Developer Keys</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => window.open("/docs/agent-api", "_blank")}
            className="rounded-2xl border-white/10 bg-white/5 font-black gap-2 h-12"
          >
            <ExternalLink className="w-4 h-4" />
            View API Docs
          </Button>
          <Button 
            variant="outline" 
            onClick={fetchGlobalAPIState}
            className="rounded-2xl border-white/10 bg-white/5 font-black gap-2 h-12"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Sync Network
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <Card className="border-none bg-amber-500/5 border border-amber-500/10">
           <CardContent className="p-6">
              <Key className="w-5 h-5 text-amber-500 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Dev Keys</p>
              <p className="text-3xl font-black">{stats.totalKeys}</p>
           </CardContent>
         </Card>
         <Card className="border-none bg-indigo-500/5 border border-indigo-500/10">
           <CardContent className="p-6">
              <Globe className="w-5 h-5 text-indigo-400 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Daily Network Vol</p>
              <p className="text-3xl font-black">₵{stats.totalDailySpend.toFixed(2)}</p>
           </CardContent>
         </Card>
         <Card className="border-none bg-emerald-500/5 border border-emerald-500/10">
           <CardContent className="p-6">
              <TrendingUp className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Platform Yield</p>
              <p className="text-3xl font-black text-emerald-400">₵{stats.estimatedYield.toFixed(2)}</p>
           </CardContent>
         </Card>
         <Card className="border-none bg-primary/5 border border-primary/10">
           <CardContent className="p-6">
              <Users className="w-5 h-5 text-primary mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Provider Agents</p>
              <p className="text-3xl font-black">{stats.activeAgents}</p>
           </CardContent>
         </Card>
      </div>

      <Card className="border-none bg-white/[0.02] backdrop-blur-xl border border-white/5 overflow-hidden">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div>
            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
               <ShieldAlert className="w-5 h-5 text-red-500" />
               Emergency Override Console
            </CardTitle>
            <CardDescription>Revoke or suspend any developer key globally.</CardDescription>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search keys, agents or businesses..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white/5 border-none h-12 pl-11 rounded-2xl font-bold"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.02] text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-white/5">
                  <th className="px-6 py-4">Key / Dev Name</th>
                  <th className="px-6 py-4">Issuing Agent</th>
                  <th className="px-6 py-4">Business</th>
                  <th className="px-6 py-4">Usage Status</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Emergency Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <RefreshCw className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
                      <p className="font-black text-sm uppercase tracking-widest animate-pulse">Syncing Network State...</p>
                    </td>
                  </tr>
                ) : filteredKeys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-muted-foreground font-bold">
                      No matching developer keys found in the registry.
                    </td>
                  </tr>
                ) : (
                  filteredKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-black text-sm">{k.key_name}</span>
                          <code className="text-[10px] text-primary/60 font-mono mt-1 uppercase tracking-tighter">
                            {k.api_key.substring(0, 15)}...
                          </code>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-bold text-sm">{k.profiles?.full_name || "Unknown Agent"}</p>
                      </td>
                      <td className="px-6 py-5">
                        <Badge variant="outline" className="rounded-lg border-white/10 bg-white/5 font-black text-[10px]">
                          {k.profiles?.store_name || "Direct Provider"}
                        </Badge>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1.5 w-32">
                           <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase text-muted-foreground italic">₵{Number(k.current_daily_spend).toFixed(0)} / ₵{k.spending_limit_daily}</span>
                              <span className="text-[9px] font-black text-amber-500">{( (Number(k.current_daily_spend) / Number(k.spending_limit_daily)) * 100).toFixed(0)}%</span>
                           </div>
                           <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all", (Number(k.current_daily_spend) / Number(k.spending_limit_daily)) > 0.8 ? "bg-red-500" : "bg-emerald-500")}
                                style={{ width: `${Math.min(100, (Number(k.current_daily_spend) / Number(k.spending_limit_daily)) * 100)}%` }}
                              />
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-muted-foreground text-xs font-medium">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <button 
                            type="button" 
                            onClick={() => toggleKeyStatus(k.id, k.is_active)}
                            title={k.is_active ? "Suspend API Key" : "Restore API Key"}
                            className={cn("h-10 w-10 flex items-center justify-center rounded-xl transition-all", k.is_active ? "text-red-400 hover:bg-red-400/10" : "text-emerald-500 hover:bg-emerald-500/10")}
                           >
                              {k.is_active ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                           </button>
                           <button 
                            type="button" 
                            onClick={() => revokeKey(k.id)}
                            title="Permanently Revoke Key"
                            className="h-10 w-10 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10 transition-all"
                           >
                              <Trash2 className="w-5 h-5" />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAPINetwork;
