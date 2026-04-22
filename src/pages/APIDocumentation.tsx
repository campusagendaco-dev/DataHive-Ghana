import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Code2, Copy, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const APIDocumentation = () => {
  const { toast } = useToast();

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Code snippet copied" });
  };

  const balanceSnippet = `curl -X GET "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api?action=balance" \\
  -H "x-api-key: YOUR_SECRET_KEY"`;

  const buySnippet = `curl -X POST "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api?action=buy" \\
  -H "x-api-key: YOUR_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "network": "MTN",
    "plan_id": "mtn-1gb-30days",
    "phone": "054XXXXXXX",
    "request_id": "unique_id_123"
  }'`;

  return (
    <div className="min-h-screen bg-[#030305] text-white selection:bg-amber-400/30 pb-20">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard/api" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500/20 text-amber-500">v1.0.0</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <section className="space-y-4">
          <div className="bg-amber-400/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
            <Code2 className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-4xl font-black tracking-tight">Developer Documentation</h1>
          <p className="text-lg text-white/60 max-w-2xl">
            Integrate SwiftData Ghana's powerful data vending engine into your own applications with our simple REST API.
          </p>
        </section>

        {/* Authentication */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm font-mono text-white/40">01</span>
            Authentication
          </h2>
          <p className="text-white/60 text-sm">
            All API requests must be authenticated using your Secret API Key passed in the <code className="bg-white/10 px-1.5 py-0.5 rounded text-amber-400">x-api-key</code> header.
          </p>
          <Card className="bg-black/40 border-white/5 overflow-hidden">
            <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Request Header</span>
            </div>
            <CardContent className="p-4">
              <pre className="text-sm font-mono text-amber-200/80">x-api-key: sdg_your_secret_key_here</pre>
            </CardContent>
          </Card>
        </section>

        {/* Check Balance */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm font-mono text-white/40">02</span>
            Check Balance
          </h2>
          <p className="text-white/60 text-sm">Retrieve your current wallet balance in GH₵.</p>
          <Card className="bg-black/40 border-white/5 overflow-hidden">
            <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center">
              <div className="flex gap-2">
                <Badge className="bg-blue-500/20 text-blue-400 border-none">GET</Badge>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">/balance</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(balanceSnippet)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <CardContent className="p-0">
              <pre className="p-4 text-xs font-mono bg-black/60 overflow-x-auto text-emerald-400/90 leading-relaxed">
                {balanceSnippet}
              </pre>
            </CardContent>
          </Card>
        </section>

        {/* Buy Data */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm font-mono text-white/40">03</span>
            Purchase Data
          </h2>
          <p className="text-white/60 text-sm">Place a request to buy a data package for a specific phone number.</p>
          <Card className="bg-black/40 border-white/5 overflow-hidden">
            <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center">
              <div className="flex gap-2">
                <Badge className="bg-amber-500/20 text-amber-400 border-none">POST</Badge>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">/buy</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(buySnippet)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <CardContent className="p-0">
              <pre className="p-4 text-xs font-mono bg-black/60 overflow-x-auto text-emerald-400/90 leading-relaxed">
                {buySnippet}
              </pre>
            </CardContent>
          </Card>
        </section>

        {/* Error Codes */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm font-mono text-white/40">04</span>
            Error Responses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="font-bold text-red-400 text-sm">401 Unauthorized</p>
              <p className="text-xs text-white/40 mt-1">Missing or invalid API Key in the request header.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="font-bold text-red-400 text-sm">402 Payment Required</p>
              <p className="text-xs text-white/40 mt-1">Insufficient wallet balance to complete the purchase.</p>
            </div>
          </div>
        </section>

        <section className="pt-12 border-t border-white/5 flex flex-col items-center text-center">
          <div className="bg-blue-500/10 p-4 rounded-full mb-4">
            <Terminal className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold">Need help with integration?</h3>
          <p className="text-sm text-white/60 mt-2 max-w-sm mb-6">
            Our technical support team is available on WhatsApp to help you with your custom implementation.
          </p>
          <a href="https://whatsapp.com/channel/0029VbCx0q4KLaHfJaiHLN40" target="_blank" rel="noreferrer">
            <Button className="bg-amber-400 text-black hover:bg-amber-300 font-bold">Contact Support</Button>
          </a>
        </section>
      </div>
    </div>
  );
};

export default APIDocumentation;
