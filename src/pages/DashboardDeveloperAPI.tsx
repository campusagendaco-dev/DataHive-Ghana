import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Key, Copy, RefreshCw, Loader2, ExternalLink,
  Shield, AlertTriangle, CheckCircle, Eye, EyeOff, Zap,
  Terminal, History, Bug, FlaskConical
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const DashboardDeveloperAPI = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [plaintextKey, setPlaintextKey] = useState<string | null>(null);
  const [plaintextSecret, setPlaintextSecret] = useState<string | null>(null);
  const [apiKeyPrefix, setApiKeyPrefix] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [accessEnabled, setAccessEnabled] = useState(true);
  const [rateLimit, setRateLimit] = useState(30);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [updatingTestMode, setUpdatingTestMode] = useState(false);

  const BASE_URL = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";

  const fetchApiKey = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("api_key_prefix, api_access_enabled, api_rate_limit, api_secret_key_hash, api_test_mode")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (data) {
      setApiKeyPrefix(data.api_key_prefix ?? null);
      setHasKey(!!data.api_key_prefix);
      setAccessEnabled(data.api_access_enabled ?? true);
      setRateLimit(data.api_rate_limit ?? 30);
      setTestMode(data.api_test_mode ?? false);
    }
    
    // Fetch recent logs
    const { data: logData } = await supabase
      .from("api_logs")
      .select("log_reference, endpoint, method, error_message, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (logData) setLogs(logData);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchApiKey();
  }, [user]);

  const generateApiKey = async () => {
    if (!user) return;
    if (hasKey && !confirmRegen) { setConfirmRegen(true); return; }
    setGenerating(true);
    setConfirmRegen(false);

    const newKey = `swft_live_${crypto.randomUUID().replace(/-/g, "")}`;
    const keyHash = await sha256Hex(newKey);
    const prefix = newKey.slice(0, 12);
    
    // Generate a new Secret Signing Key
    const newSecret = crypto.randomUUID().replace(/-/g, "");
    const secretHash = await sha256Hex(newSecret);

    const { error } = await supabase
      .from("profiles")
      .update({ 
        api_key_hash: keyHash, 
        api_key_prefix: prefix, 
        api_secret_key_hash: newSecret 
      })
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Failed to generate keys", description: error.message, variant: "destructive" });
    } else {
      setPlaintextKey(newKey);
      setPlaintextSecret(newSecret); 
      setApiKeyPrefix(prefix);
      setHasKey(true);
      setRevealed(true);
      toast({ title: "✅ New API Credentials generated", description: "Copy and store them securely — they will not be shown again." });
    }
    setGenerating(false);
  };

  const toggleTestMode = async (enabled: boolean) => {
    if (!user) return;
    setUpdatingTestMode(true);
    const { error } = await supabase
      .from("profiles")
      .update({ api_test_mode: enabled })
      .eq("user_id", user.id);
    
    if (error) {
      toast({ title: "Failed to update testing mode", description: error.message, variant: "destructive" });
    } else {
      setTestMode(enabled);
      toast({ 
        title: enabled ? "🚀 API Testing Mode Enabled" : "🔒 API Testing Mode Disabled",
        description: enabled 
          ? "You can now test integrations with only Bearer tokens. Charges and fulfillment are simulated."
          : "Production security and real fulfillment are now active."
      });
    }
    setUpdatingTestMode(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const maskedKey = apiKeyPrefix ? `${apiKeyPrefix}${"•".repeat(24)}` : "";

  return (
    <div className="p-6 md:p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-sky-400" /> Developer Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build custom integrations using our secure, production-grade API.
          </p>
        </div>
        <Link to="/api-docs">
          <Button variant="outline" className="gap-2 border-sky-500/30 text-sky-400 hover:bg-sky-500/10">
            <ExternalLink className="w-4 h-4" /> API Documentation
          </Button>
        </Link>
      </div>

      {/* Access status banner */}
      {!loading && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${accessEnabled ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-red-500/20 bg-red-500/5 text-red-400"}`}>
          {accessEnabled ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {accessEnabled ? "API access is active. Use your API key to start integrating." : "API access disabled. Please contact support."}
        </div>
      )}

      {/* API Credentials Card */}
      <Card className="border-sky-500/20 bg-sky-500/5 overflow-hidden">
        <CardHeader className="border-b border-sky-500/10 bg-sky-500/5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="w-5 h-5 text-sky-500" /> Authentication Credentials
          </CardTitle>
          <CardDescription>
            Use this key to authenticate your requests. Keep it secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading credentials...
            </div>
          ) : hasKey ? (
            <div className="grid gap-6">
              {/* API Key */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-sky-500/70">Public API Key (Bearer Token)</label>
                <div className="flex gap-2">
                  <Input
                    value={plaintextKey && revealed ? plaintextKey : maskedKey}
                    readOnly
                    className="font-mono bg-black/40 border-white/10 text-sm h-10"
                  />
                  {plaintextKey && (
                    <Button variant="secondary" size="icon" className="h-10 w-10" onClick={() => setRevealed(!revealed)}>
                      {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button variant="secondary" size="icon" className="h-10 w-10" onClick={() => copyToClipboard(plaintextKey || maskedKey)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>


              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Shield className="w-3.5 h-3.5" /> Rate Limit: <strong className="text-white/60">{rateLimit} req/min</strong>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Terminal className="w-3.5 h-3.5" /> Auth: <strong className="text-sky-400">Bearer Token</strong>
                </div>
                
                <div className="flex items-center gap-3 ml-auto bg-white/5 px-3 py-1.5 rounded-lg border border-white/8">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider leading-none">Testing Mode</span>
                    <span className="text-[9px] text-white/30 mt-1">Bypass signatures</span>
                  </div>
                  <Switch 
                    checked={testMode} 
                    onCheckedChange={toggleTestMode} 
                    disabled={updatingTestMode}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto">
                <Key className="w-6 h-6 text-sky-500 opacity-50" />
              </div>
              <p className="text-sm text-muted-foreground italic">No API credentials found. Generate them below to get started.</p>
            </div>
          )}

          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center gap-4">
            <Button
              onClick={generateApiKey}
              disabled={generating || !accessEnabled}
              variant={confirmRegen ? "destructive" : "secondary"}
              className="gap-2 w-full sm:w-auto"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {confirmRegen ? "Confirm Regeneration" : hasKey ? "Rotate Keys" : "Generate API Credentials"}
            </Button>
            {confirmRegen && (
              <Button variant="ghost" size="sm" className="text-white/40" onClick={() => setConfirmRegen(false)}>Cancel</Button>
            )}
            {hasKey && !confirmRegen && (
              <p className="text-[10px] text-white/20 italic max-w-xs">Rotating keys will immediately invalidate your current API Key.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Logs & Quick Start */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Start */}
        <Card className="lg:col-span-1 bg-white/3 border-white/8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" /> Quick Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-4 text-muted-foreground">
            <div className="space-y-1">
              <p className="font-bold text-white/60">1. Required Header</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>Authorization: Bearer [YOUR_KEY]</code></li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-white/60">2. Sample Request</p>
              <pre className="p-2 bg-black/40 rounded border border-white/5 overflow-x-auto text-[10px]">
                curl -X GET {BASE_URL}/balance \<br />
                &nbsp;&nbsp;-H "Authorization: Bearer [KEY]"
              </pre>
            </div>
            <Button variant="link" className="p-0 h-auto text-sky-400 text-xs" asChild>
              <Link to="/api-docs">View Integration Guide →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent API Logs */}
        <Card className="lg:col-span-2 bg-white/3 border-white/8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" /> Recent Errors & Activity
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchApiKey}>
              <RefreshCw className="w-3.5 h-3.5 text-white/40" />
            </Button>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-10 opacity-30">
                <Bug className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs">No errors or activity logged yet.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-white/5 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5 hover:bg-white/5 border-white/5">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest px-3">Reference</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest px-3">Endpoint</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest px-3">Status</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest px-3 text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.log_reference} className="border-white/5 text-[11px] hover:bg-white/[0.02]">
                        <TableCell className="font-mono text-amber-400 px-3">{log.log_reference}</TableCell>
                        <TableCell className="text-white/60 px-3 truncate max-w-[120px]">{log.method} {log.endpoint}</TableCell>
                        <TableCell className="px-3">
                          <Badge variant="outline" className="text-[9px] border-red-500/20 text-red-400 bg-red-500/5">Error</Badge>
                        </TableCell>
                        <TableCell className="text-right text-white/30 px-3">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-[10px] text-white/20 mt-4 italic flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> If you receive an Internal Server Error, provide the 8-character reference ID to support for troubleshooting.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardDeveloperAPI;
