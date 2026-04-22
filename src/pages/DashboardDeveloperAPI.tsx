import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Copy, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const DashboardDeveloperAPI = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchApiKey = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("api_key")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (!error && data) {
        setApiKey(data.api_key);
      }
      setLoading(false);
    };

    fetchApiKey();
  }, [user]);

  const generateApiKey = async () => {
    if (!user) return;
    setGenerating(true);
    
    // Generate a secure random string for the API key
    const newKey = `sdg_${crypto.randomUUID().replace(/-/g, "")}`;
    
    const { error } = await supabase
      .from("profiles")
      .update({ api_key: newKey })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Failed to generate API Key", description: error.message, variant: "destructive" });
    } else {
      setApiKey(newKey);
      toast({ title: "New API Key generated successfully" });
    }
    setGenerating(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Developer API</h1>
          <p className="text-sm text-muted-foreground mt-1">Integrate SwiftData Ghana directly into your own applications.</p>
        </div>
        <Link to="/api-docs">
          <Button variant="outline" className="gap-2">
            <ExternalLink className="w-4 h-4" />
            View Documentation
          </Button>
        </Link>
      </div>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-500" /> Your API Credentials
          </CardTitle>
          <CardDescription>Use this key to authenticate your programmatic requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secret API Key</label>
            <div className="flex gap-2">
              <Input 
                value={apiKey || "Click generate to create your first key"} 
                readOnly 
                type={apiKey ? "text" : "text"}
                className="font-mono bg-black/20"
              />
              {apiKey && (
                <Button variant="secondary" size="icon" onClick={() => copyToClipboard(apiKey)}>
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-amber-500/70 font-medium">Keep this key secret! Anyone with it can spend your wallet balance.</p>
          </div>

          <div className="pt-4 border-t border-white/5">
            <Button onClick={generateApiKey} disabled={generating} variant="secondary" className="gap-2">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {apiKey ? "Regenerate API Key" : "Generate API Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Start</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>1. Ensure your wallet has sufficient balance.</p>
            <p>2. Copy your API Key above.</p>
            <p>3. Send a POST request to our buying endpoint.</p>
            <p>4. Monitor your order status via API or dashboard.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">IP Whitelisting (Coming Soon)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            For extra security, you will soon be able to restrict API requests to specific server IP addresses.
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardDeveloperAPI;
