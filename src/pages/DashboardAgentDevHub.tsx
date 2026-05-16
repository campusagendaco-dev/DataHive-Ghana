import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Code, Key, ShieldCheck, Activity, Trash2, Plus, 
  Terminal, Globe, Zap, Settings, Lock, Unlock, 
  RefreshCw, AlertTriangle, Eye, EyeOff, Copy, Book
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

const DashboardAgentDevHub = () => {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyLimit, setNewKeyLimit] = useState(100);
  const [creating, setCreating] = useState(false);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("agent_api_keys")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (err: any) {
      toast.error("Failed to fetch developer keys");
    } finally {
      setLoading(false);
    }
  };

  const createKey = async () => {
    if (!newKeyName) return toast.error("Key name is required");
    setCreating(true);
    try {
      const generatedKey = `sk_agent_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
      
      const { data, error } = await supabase
        .from("agent_api_keys")
        .insert([{
          key_name: newKeyName,
          api_key: generatedKey,
          spending_limit_daily: newKeyLimit,
          permissions: { airtime: true, data: true }
        }])
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Developer Key Generated Successfully");
      setKeys([data, ...keys]);
      setShowCreateModal(false);
      setNewKeyName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const toggleKey = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from("agent_api_keys")
        .update({ is_active: !active })
        .eq("id", id);

      if (error) throw error;
      setKeys(keys.map(k => k.id === id ? { ...k, is_active: !active } : k));
      toast.success(`Key ${active ? 'deactivated' : 'activated'}`);
    } catch (err: any) {
      toast.error("Status update failed");
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Are you sure? This developer integration will break instantly.")) return;
    try {
      const { error } = await supabase
        .from("agent_api_keys")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setKeys(keys.filter(k => k.id !== id));
      toast.success("Key Revoked");
    } catch (err: any) {
      toast.error("Failed to revoke key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("API Key copied to clipboard");
  };

  return (
    <div className="p-6 md:p-10 space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 italic uppercase">
            <Code className="w-8 h-8 text-primary" />
            Agent Developer Hub
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Issue and manage API access for your developer network.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => window.open("/docs/agent-api", "_blank")}
            className="rounded-2xl border-white/10 bg-white/5 font-black gap-2 h-12 px-6"
          >
            <Book className="w-4 h-4" />
            View Documentation
          </Button>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="rounded-2xl font-black gap-2 h-12 px-6 shadow-xl shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Generate Dev Key
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="border-none bg-primary/5 backdrop-blur-xl border border-primary/10">
           <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                 <Key className="w-6 h-6 text-primary" />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Keys</p>
                 <p className="text-2xl font-black">{keys.filter(k => k.is_active).length}</p>
              </div>
           </CardContent>
         </Card>
         <Card className="border-none bg-indigo-500/5 backdrop-blur-xl border border-indigo-500/10">
           <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                 <ShieldCheck className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sentinel Guarded</p>
                 <p className="text-2xl font-black">ACTIVE</p>
              </div>
           </CardContent>
         </Card>
         <Card className="border-none bg-emerald-500/5 backdrop-blur-xl border border-emerald-500/10">
           <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                 <Activity className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Daily API Yield</p>
                 <p className="text-2xl font-black">₵{keys.reduce((acc, k) => acc + (Number(k.current_daily_spend) * 0.02), 0).toFixed(2)}</p>
              </div>
           </CardContent>
         </Card>
      </div>

      <Card className="border-none bg-white/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
             <Terminal className="w-5 h-5 text-primary" />
             Managed Developer Keys
          </CardTitle>
          <CardDescription>Live monitoring of spending limits and connectivity.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <RefreshCw className="w-10 h-10 text-primary animate-spin" />
              <p className="font-black text-sm uppercase tracking-widest animate-pulse">Scanning Registry...</p>
            </div>
          ) : keys.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <Code className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <p className="font-black text-muted-foreground">No developer keys issued yet.</p>
              <Button variant="link" className="text-primary font-black" onClick={() => setShowCreateModal(true)}>Generate your first key</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {keys.map((k) => (
                <div key={k.id} className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all group">
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-black">{k.key_name}</p>
                          <Badge className={cn("rounded-lg text-[8px] font-black", k.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                            {k.is_active ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 group/key">
                           <code className="text-xs bg-black/40 px-3 py-1.5 rounded-xl text-primary font-mono font-bold">
                             {showKeyId === k.id ? k.api_key : "••••••••••••••••••••••••"}
                           </code>
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-white"
                            onClick={() => setShowKeyId(showKeyId === k.id ? null : k.id)}
                           >
                             {showKeyId === k.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                           </Button>
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-white"
                            onClick={() => copyToClipboard(k.api_key)}
                           >
                             <Copy className="w-4 h-4" />
                           </Button>
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end gap-2">
                        <div className="flex items-center justify-between w-full md:w-64">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Daily Spend Usage</p>
                          <p className="text-[10px] font-black text-primary italic">Limit: ₵{k.spending_limit_daily}</p>
                        </div>
                        <div className="w-full md:w-64 h-2 bg-white/5 rounded-full overflow-hidden">
                           <div 
                            className="h-full bg-primary transition-all duration-1000"
                            style={{ width: `${Math.min(100, (Number(k.current_daily_spend) / Number(k.spending_limit_daily)) * 100)}%` }}
                           />
                        </div>
                        <p className="text-sm font-black">₵{Number(k.current_daily_spend).toFixed(2)} <span className="text-muted-foreground font-medium text-xs">/ ₵{k.spending_limit_daily}</span></p>
                      </div>

                      <div className="flex items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0 border-white/5">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-10 w-10 rounded-xl", k.is_active ? "text-red-400 hover:bg-red-400/10" : "text-emerald-500 hover:bg-emerald-500/10")}
                          onClick={() => toggleKey(k.id, k.is_active)}
                        >
                          {k.is_active ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-xl text-red-500 hover:bg-red-500/10"
                          onClick={() => deleteKey(k.id)}
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-[#0a0a0b] border-white/10 text-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase">Generate Developer Key</DialogTitle>
            <DialogDescription>Create a scoped API key with specific daily spending limits.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Key Description (e.g. Mobile App Dev)</label>
                <Input 
                  placeholder="Integration name..." 
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="bg-white/5 border-none h-14 rounded-2xl font-bold px-5" 
                />
             </div>
             <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Daily Spending Limit (GHS)</label>
                <div className="flex items-center gap-4">
                  <Input 
                    type="number" 
                    value={newKeyLimit}
                    onChange={(e) => setNewKeyLimit(Number(e.target.value))}
                    className="bg-white/5 border-none h-14 rounded-2xl font-black text-center text-xl w-32" 
                  />
                  <span className="text-muted-foreground font-medium text-sm italic">Max daily transactions from this key.</span>
                </div>
             </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full h-14 rounded-2xl font-black bg-primary hover:bg-primary/90 text-lg shadow-xl shadow-primary/20"
              onClick={createKey}
              disabled={creating}
            >
              {creating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              Authorize & Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardAgentDevHub;
