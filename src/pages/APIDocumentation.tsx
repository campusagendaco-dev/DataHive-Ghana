import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Copy, Check, Terminal, Shield, Zap, Code2, BookOpen,
  AlertCircle, ChevronRight, Globe, Key, List, ShoppingCart, AlertTriangle,
  Activity, Lock, RotateCcw, ExternalLink, Menu, X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const BASE_URL = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";

type Lang = "curl" | "node" | "python" | "php";
const LANGS: Lang[] = ["curl", "node", "python", "php"];
const LANG_LABELS: Record<Lang, string> = { curl: "cURL", node: "Node.js", python: "Python", php: "PHP" };

// ─── Code Snippets ────────────────────────────────────────────────────────────
const makeSnippets = (key: string): Record<Lang, string> => {
  const K = "YOUR_API_KEY";
  const s: Record<string, Record<Lang, string>> = {
    balance: {
      curl: `curl -X GET "${BASE_URL}?action=balance" \\\n  -H "x-api-key: sdg_${K}"`,
      node: `const res = await fetch("${BASE_URL}?action=balance", {\n  headers: { "x-api-key": "sdg_${K}" },\n});\nconst { balance } = await res.json();\nconsole.log("Balance:", balance); // 45.50`,
      python: `import requests\n\nres = requests.get(\n    "${BASE_URL}",\n    params={"action": "balance"},\n    headers={"x-api-key": "sdg_${K}"},\n)\nprint(res.json())`,
      php: `<?php\n$ch = curl_init("${BASE_URL}?action=balance");\ncurl_setopt_array($ch, [\n    CURLOPT_HTTPHEADER    => ["x-api-key: sdg_${K}"],\n    CURLOPT_RETURNTRANSFER => true,\n]);\n$res = json_decode(curl_exec($ch));\necho $res->balance;`,
    },
    plans: {
      curl: `curl -X GET "${BASE_URL}?action=plans" \\\n  -H "x-api-key: sdg_${K}"`,
      node: `const res = await fetch("${BASE_URL}?action=plans", {\n  headers: { "x-api-key": "sdg_${K}" },\n});\nconst { plans } = await res.json();\nplans.forEach(p => console.log(p.id, p.price));`,
      python: `import requests\n\nres = requests.get(\n    "${BASE_URL}",\n    params={"action": "plans"},\n    headers={"x-api-key": "sdg_${K}"},\n)\nfor plan in res.json()["plans"]:\n    print(plan["id"], plan["price"])`,
      php: `<?php\n$ch = curl_init("${BASE_URL}?action=plans");\ncurl_setopt_array($ch, [\n    CURLOPT_HTTPHEADER    => ["x-api-key: sdg_${K}"],\n    CURLOPT_RETURNTRANSFER => true,\n]);\n$data = json_decode(curl_exec($ch));\nforeach ($data->plans as $plan) {\n    echo $plan->id . " → GH₵" . $plan->price . "\\n";\n}`,
    },
    buy: {
      curl: `curl -X POST "${BASE_URL}?action=buy" \\\n  -H "x-api-key: sdg_${K}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "network": "MTN",\n    "plan_id": "mtn-1gb",\n    "phone": "054XXXXXXX",\n    "request_id": "ord_$(uuidgen)"\n  }'`,
      node: `import { randomUUID } from "crypto";\n\nconst res = await fetch("${BASE_URL}?action=buy", {\n  method: "POST",\n  headers: {\n    "x-api-key": "sdg_${K}",\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({\n    network: "MTN",\n    plan_id: "mtn-1gb",\n    phone: "054XXXXXXX",\n    request_id: randomUUID(),\n  }),\n});\n\nconst data = await res.json();\nconsole.log(data.status); // "pending"`,
      python: `import requests, uuid\n\nres = requests.post(\n    "${BASE_URL}",\n    params={"action": "buy"},\n    headers={\n        "x-api-key": "sdg_${K}",\n        "Content-Type": "application/json",\n    },\n    json={\n        "network": "MTN",\n        "plan_id": "mtn-1gb",\n        "phone": "054XXXXXXX",\n        "request_id": str(uuid.uuid4()),\n    },\n)\nprint(res.json())`,
      php: `<?php\n$payload = json_encode([\n    "network"    => "MTN",\n    "plan_id"    => "mtn-1gb",\n    "phone"      => "054XXXXXXX",\n    "request_id" => uniqid("ord_", true),\n]);\n$ch = curl_init("${BASE_URL}?action=buy");\ncurl_setopt_array($ch, [\n    CURLOPT_POST           => true,\n    CURLOPT_POSTFIELDS     => $payload,\n    CURLOPT_HTTPHEADER     => [\n        "x-api-key: sdg_${K}",\n        "Content-Type: application/json",\n    ],\n    CURLOPT_RETURNTRANSFER => true,\n]);\necho curl_exec($ch);`,
    },
    orders: {
      curl: `curl -X GET "${BASE_URL}?action=orders&limit=20&offset=0" \\\n  -H "x-api-key: sdg_${K}"`,
      node: `const res = await fetch(\n  "${BASE_URL}?action=orders&limit=20&offset=0",\n  { headers: { "x-api-key": "sdg_${K}" } }\n);\nconst { orders, total } = await res.json();\nconsole.log(\`Showing \${orders.length} of \${total} orders\`);`,
      python: `import requests\n\nres = requests.get(\n    "${BASE_URL}",\n    params={"action": "orders", "limit": 20, "offset": 0},\n    headers={"x-api-key": "sdg_${K}"},\n)\ndata = res.json()\nfor order in data["orders"]:\n    print(order["id"], order["status"])`,
      php: `<?php\n$url = "${BASE_URL}?action=orders&limit=20&offset=0";\n$ch = curl_init($url);\ncurl_setopt_array($ch, [\n    CURLOPT_HTTPHEADER    => ["x-api-key: sdg_${K}"],\n    CURLOPT_RETURNTRANSFER => true,\n]);\n$data = json_decode(curl_exec($ch));\nforeach ($data->orders as $order) {\n    echo $order->id . " → " . $order->status . "\\n";\n}`,
    },
  };
  return s[key];
};

// ─── Responses ────────────────────────────────────────────────────────────────
const RESPONSES: Record<string, string> = {
  balance: `{\n  "success": true,\n  "balance": 45.50\n}`,
  plans: `{\n  "success": true,\n  "plans": [\n    {\n      "id": "mtn-1gb",\n      "network": "MTN",\n      "label": "1 GB",\n      "price": 5.00,\n      "is_active": true\n    },\n    {\n      "id": "telecel-5gb",\n      "network": "Telecel",\n      "label": "5 GB",\n      "price": 18.00,\n      "is_active": true\n    }\n  ]\n}`,
  buy_ok: `{\n  "success": true,\n  "order_id": "a3f2b1c0-...",\n  "status": "pending",\n  "message": "Order queued for delivery"\n}`,
  buy_dup: `{\n  "error": "Duplicate request_id",\n  "order_id": "a3f2b1c0-..."\n}`,
  buy_low: `{\n  "error": "Insufficient balance",\n  "balance": 2.00,\n  "required": 5.00\n}`,
  orders: `{\n  "success": true,\n  "orders": [\n    {\n      "id": "a3f2b1c0-...",\n      "network": "MTN",\n      "plan_id": "mtn-1gb",\n      "phone": "054XXXXXXX",\n      "amount": 5.00,\n      "status": "fulfilled",\n      "created_at": "2026-04-23T10:15:30Z"\n    }\n  ],\n  "total": 142,\n  "limit": 20,\n  "offset": 0\n}`,
  error_401: `{\n  "error": "Invalid or missing API key"\n}`,
  error_403: `{\n  "error": "API access not enabled for this account"\n}`,
};

// ─── Reusable components ──────────────────────────────────────────────────────
function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`p-1.5 rounded-lg bg-white/5 hover:bg-white/15 transition-colors ${className}`}
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
    </button>
  );
}

function CodeBlock({ code, label, className = "" }: { code: string; label?: string; className?: string }) {
  return (
    <div className={`relative rounded-xl bg-[#080810] border border-white/8 overflow-hidden ${className}`}>
      {label && (
        <div className="px-4 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!label && <CopyButton text={code} className="absolute top-3 right-3 z-10" />}
      <pre className="p-5 text-xs font-mono text-emerald-300/85 leading-relaxed overflow-x-auto whitespace-pre pr-12">{code}</pre>
    </div>
  );
}

function ResponseBlock({ code, label, variant = "success" }: { code: string; label?: string; variant?: "success" | "error" }) {
  const color = variant === "error" ? "text-red-300/85" : "text-sky-300/85";
  return (
    <div className="relative rounded-xl bg-[#080810] border border-white/8 overflow-hidden">
      {label && (
        <div className="px-4 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!label && <CopyButton text={code} className="absolute top-3 right-3 z-10" />}
      <pre className={`p-5 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre pr-12 ${color}`}>{code}</pre>
    </div>
  );
}

function MultiLangBlock({ snippetKey, activeLang }: { snippetKey: string; activeLang: Lang }) {
  const snippets = makeSnippets(snippetKey);
  return <CodeBlock code={snippets[activeLang]} />;
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono ${method === "GET" ? "bg-sky-500/15 text-sky-300 border border-sky-500/20" : "bg-amber-500/15 text-amber-300 border border-amber-500/20"}`}>
      {method}
    </span>
  );
}

function ParamRow({ name, type, required, desc }: { name: string; type: string; required: boolean; desc: string }) {
  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
      <div className="col-span-3 font-mono text-amber-300 font-semibold">{name}</div>
      <div className="col-span-2 text-sky-400 font-mono">{type}</div>
      <div className="col-span-2">
        {required
          ? <span className="text-red-400 font-bold text-[10px] uppercase tracking-wide">Required</span>
          : <span className="text-white/25 text-[10px] uppercase tracking-wide">Optional</span>}
      </div>
      <div className="col-span-5 text-white/45 leading-relaxed">{desc}</div>
    </div>
  );
}

function SectionAnchor({ id }: { id: string }) {
  return <span id={id} className="block -mt-20 pt-20 invisible absolute" />;
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "overview",        label: "Overview",           icon: BookOpen },
  { id: "authentication",  label: "Authentication",      icon: Key },
  { id: "balance",         label: "Check Balance",       icon: Activity },
  { id: "plans",           label: "List Plans",          icon: List },
  { id: "buy",             label: "Purchase Bundle",     icon: ShoppingCart },
  { id: "orders",          label: "Order History",       icon: Globe },
  { id: "errors",          label: "Error Reference",     icon: AlertTriangle },
  { id: "rate-limits",     label: "Rate Limits",         icon: Zap },
  { id: "best-practices",  label: "Best Practices",      icon: Shield },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
const APIDocumentation = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [activeLang, setActiveLang] = useState<Lang>("curl");
  const [activeSection, setActiveSection] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Replace placeholder key with real key if user is logged in
  const userApiKey = profile?.api_key ?? null;

  const copy = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: label ?? "Copied!" });
  };

  // Track active section via scroll
  useEffect(() => {
    const onScroll = () => {
      const offsets = NAV_ITEMS.map(({ id }) => {
        const el = document.getElementById(id);
        return { id, top: el ? el.getBoundingClientRect().top : Infinity };
      });
      const active = offsets.filter(({ top }) => top <= 120).slice(-1)[0];
      if (active) setActiveSection(active.id);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNavOpen(false);
  };

  const Sidebar = () => (
    <nav className="space-y-0.5">
      <div className="flex items-center gap-2 px-3 py-3 mb-3 border-b border-white/5">
        <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
          <Code2 className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          <p className="text-xs font-black text-white tracking-tight leading-none">API Docs</p>
          <p className="text-[9px] text-white/30 uppercase tracking-widest mt-0.5">v1.0</p>
        </div>
      </div>
      <p className="px-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-white/20">Reference</p>
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => scrollTo(id)}
          className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            activeSection === id
              ? "bg-amber-400/10 text-amber-300 border border-amber-400/20"
              : "text-white/40 hover:text-white/70 hover:bg-white/5"
          }`}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          {label}
          {activeSection === id && <ChevronRight className="w-3 h-3 ml-auto text-amber-400/60" />}
        </button>
      ))}
      <div className="pt-4 mt-2 border-t border-white/5 px-3">
        <Link to="/dashboard/api">
          <button className="w-full text-left flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors py-1.5">
            <ExternalLink className="w-3 h-3" /> Developer Dashboard
          </button>
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#030305] text-white selection:bg-amber-400/25">

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#030305]/95 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <Link to="/dashboard/api" className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm">
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Dashboard</span>
            </Link>
          </div>

          {/* Global language picker */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/8">
            {LANGS.map((l) => (
              <button
                key={l}
                onClick={() => setActiveLang(l)}
                className={`px-3 py-1 text-xs rounded-lg font-mono font-bold transition-all ${
                  activeLang === l ? "bg-amber-400 text-black shadow-sm" : "text-white/35 hover:text-white/70"
                }`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] hidden sm:flex">● Live</Badge>
            <Badge variant="outline" className="border-amber-500/20 text-amber-400 text-[10px]">v1</Badge>
          </div>
        </div>
      </div>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden pt-14">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNavOpen(false)} />
          <div className="relative w-64 h-full bg-[#0c0c18] border-r border-white/5 p-3 overflow-y-auto">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex max-w-[1400px] mx-auto pt-14">

        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-4 border-r border-white/5">
          <Sidebar />
        </aside>

        {/* Main content */}
        <main ref={scrollRef} className="flex-1 min-w-0 px-6 lg:px-12 xl:px-16 py-12 pb-32 space-y-24">

          {/* ── Overview ─────────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="overview" />
            <div className="flex items-start justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/10 border border-amber-400/20 rounded-full text-xs font-bold text-amber-400 mb-4">
                  <Zap className="w-3 h-3" /> REST API · v1.0
                </div>
                <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-none mb-4">
                  SwiftData Ghana<br />
                  <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                    API Reference
                  </span>
                </h1>
                <p className="text-white/50 text-lg max-w-2xl leading-relaxed">
                  Programmatically vend MTN, Telecel and AirtelTigo data bundles to any Ghanaian phone number.
                  Secure key-based auth, idempotency-safe purchases, and real-time delivery.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {[
                { icon: Shield, label: "Key-based auth", sub: "x-api-key header", color: "text-emerald-400", bg: "bg-emerald-400/8 border-emerald-400/15" },
                { icon: Zap, label: "Instant delivery", sub: "Real-time fulfillment", color: "text-amber-400", bg: "bg-amber-400/8 border-amber-400/15" },
                { icon: RotateCcw, label: "Idempotency", sub: "Safe retries via request_id", color: "text-purple-400", bg: "bg-purple-400/8 border-purple-400/15" },
                { icon: Terminal, label: "JSON responses", sub: "Consistent schema", color: "text-sky-400", bg: "bg-sky-400/8 border-sky-400/15" },
              ].map(({ icon: Icon, label, sub, color, bg }) => (
                <div key={label} className={`p-4 rounded-xl border ${bg} space-y-2`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                  <p className="text-sm font-bold text-white/80">{label}</p>
                  <p className="text-[11px] text-white/35">{sub}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/8 overflow-hidden">
              <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Base URL</span>
                <CopyButton text={BASE_URL} />
              </div>
              <div className="px-5 py-4 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <code className="text-sm font-mono text-emerald-300 break-all">{BASE_URL}</code>
              </div>
            </div>
          </section>

          {/* ── Authentication ───────────────────────────────────────── */}
          <section>
            <SectionAnchor id="authentication" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-white/40" />
              </div>
              <h2 className="text-2xl font-black">Authentication</h2>
            </div>
            <p className="text-white/45 text-sm mb-6 ml-11 max-w-xl">
              Include your Secret API Key in the <code className="text-amber-400 bg-white/5 px-1.5 py-0.5 rounded-md">x-api-key</code> header on every request.
              Keys follow the format <code className="text-amber-400 bg-white/5 px-1.5 py-0.5 rounded-md">sdg_live_…</code>
            </p>

            <div className="grid lg:grid-cols-2 gap-6 ml-11">
              <div className="space-y-4">
                <CodeBlock code={`x-api-key: sdg_live_YOUR_SECRET_KEY`} label="Required Header" />

                {userApiKey && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-emerald-300 mb-1">Your key is substituted in all examples</p>
                      <p className="text-[11px] text-white/40">Your API key is used in every code snippet on this page.</p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-300 mb-1">Keep your key secret</p>
                    <p className="text-[11px] text-white/40 leading-relaxed">Your API key has full wallet spending rights. Never embed it in client-side code, mobile apps, or public repositories. Always call the API from a backend server using environment variables.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/8 overflow-hidden">
                  <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Who can use the API?</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {[
                      { role: "Agent", approved: true, desc: "Fully approved agents have API access." },
                      { role: "Sub-Agent", approved: true, desc: "Approved sub-agents can also integrate." },
                      { role: "Regular User", approved: false, desc: "Non-agent accounts are not permitted." },
                    ].map(({ role, approved, desc }) => (
                      <div key={role} className="flex items-start gap-3 px-4 py-3 text-xs">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${approved ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {approved ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </span>
                        <div>
                          <p className="font-bold text-white/75">{role}</p>
                          <p className="text-white/35 mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Check Balance ────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="balance" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-white/40" />
              </div>
              <h2 className="text-2xl font-black">Check Wallet Balance</h2>
            </div>

            <div className="ml-11 flex flex-wrap items-center gap-3 mb-6">
              <MethodBadge method="GET" />
              <code className="text-white/55 text-sm font-mono bg-white/5 px-3 py-1 rounded-lg border border-white/8">?action=balance</code>
            </div>

            <p className="text-white/45 text-sm mb-6 ml-11 max-w-xl">Returns your current wallet balance in GH₵. Use this before bulk purchases to ensure sufficient funds.</p>

            <div className="grid lg:grid-cols-2 gap-6 ml-11">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Request</p>
                <MultiLangBlock snippetKey="balance" activeLang={activeLang} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Response · 200 OK</p>
                <ResponseBlock code={RESPONSES.balance} />
              </div>
            </div>
          </section>

          {/* ── List Plans ───────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="plans" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <List className="w-4 h-4 text-white/40" />
              </div>
              <h2 className="text-2xl font-black">List Available Plans</h2>
            </div>

            <div className="ml-11 flex flex-wrap items-center gap-3 mb-6">
              <MethodBadge method="GET" />
              <code className="text-white/55 text-sm font-mono bg-white/5 px-3 py-1 rounded-lg border border-white/8">?action=plans</code>
            </div>

            <p className="text-white/45 text-sm mb-6 ml-11 max-w-xl">
              Returns all active data packages available for purchase. Use the <code className="text-amber-400 bg-white/5 px-1 rounded">id</code> field as <code className="text-amber-400 bg-white/5 px-1 rounded">plan_id</code> in the buy endpoint.
            </p>

            <div className="grid lg:grid-cols-2 gap-6 ml-11">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Request</p>
                <MultiLangBlock snippetKey="plans" activeLang={activeLang} />

                <div className="mt-4 rounded-xl border border-white/8 overflow-hidden">
                  <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Plan Object Schema</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {[
                      { name: "id", type: "string", desc: "Unique plan ID, used as plan_id when buying" },
                      { name: "network", type: "string", desc: '"MTN" | "Telecel" | "AirtelTigo"' },
                      { name: "label", type: "string", desc: 'Human-readable size, e.g. "1 GB"' },
                      { name: "price", type: "number", desc: "Cost in GH₵ deducted from your wallet" },
                      { name: "is_active", type: "boolean", desc: "false when the plan is temporarily unavailable" },
                    ].map(({ name, type, desc }) => (
                      <div key={name} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs hover:bg-white/[0.02]">
                        <div className="col-span-4 font-mono text-amber-300">{name}</div>
                        <div className="col-span-3 font-mono text-sky-400">{type}</div>
                        <div className="col-span-5 text-white/40">{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Response · 200 OK</p>
                <ResponseBlock code={RESPONSES.plans} />
              </div>
            </div>
          </section>

          {/* ── Purchase Bundle ──────────────────────────────────────── */}
          <section>
            <SectionAnchor id="buy" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 text-white/40" />
              </div>
              <h2 className="text-2xl font-black">Purchase Data Bundle</h2>
            </div>

            <div className="ml-11 flex flex-wrap items-center gap-3 mb-6">
              <MethodBadge method="POST" />
              <code className="text-white/55 text-sm font-mono bg-white/5 px-3 py-1 rounded-lg border border-white/8">?action=buy</code>
            </div>

            <p className="text-white/45 text-sm mb-6 ml-11 max-w-xl">
              Deducts the plan price from your wallet and dispatches the bundle to the recipient's phone.
              Always provide a unique <code className="text-amber-400 bg-white/5 px-1 rounded">request_id</code> — repeated calls with the same ID are idempotent and safe to retry.
            </p>

            <div className="ml-11 space-y-6">
              {/* Param table */}
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Request Body (JSON)</span>
                </div>
                <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-white/[0.02] border-b border-white/5">
                  <div className="col-span-3 text-[9px] font-bold uppercase tracking-widest text-white/20">Field</div>
                  <div className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-white/20">Type</div>
                  <div className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-white/20">Required</div>
                  <div className="col-span-5 text-[9px] font-bold uppercase tracking-widest text-white/20">Description</div>
                </div>
                <ParamRow name="network" type="string" required desc='Network: "MTN" | "Telecel" | "AirtelTigo"' />
                <ParamRow name="plan_id" type="string" required desc="Package ID from ?action=plans" />
                <ParamRow name="phone" type="string" required desc="Recipient number (e.g. 054XXXXXXX or 23354XXXXXXX)" />
                <ParamRow name="request_id" type="string" required={false} desc="Idempotency key — UUID recommended. Prevents duplicate orders on retry." />
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Request</p>
                  <MultiLangBlock snippetKey="buy" activeLang={activeLang} />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Success · 202 Accepted</p>
                    <ResponseBlock code={RESPONSES.buy_ok} variant="success" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Duplicate · 409 Conflict</p>
                    <ResponseBlock code={RESPONSES.buy_dup} variant="error" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Low Balance · 402</p>
                    <ResponseBlock code={RESPONSES.buy_low} variant="error" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 flex gap-3">
                <RotateCcw className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-purple-300 mb-1">Idempotency guarantee</p>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    If a request with the same <code className="text-purple-300 bg-white/5 px-1 rounded">request_id</code> is received twice,
                    the API returns the original response (409) without charging your wallet a second time.
                    Generate a fresh UUID (<code className="text-purple-300 bg-white/5 px-1 rounded">crypto.randomUUID()</code>) for every new order.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Order History ────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="orders" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-white/40" />
              </div>
              <h2 className="text-2xl font-black">Order History</h2>
            </div>

            <div className="ml-11 flex flex-wrap items-center gap-3 mb-6">
              <MethodBadge method="GET" />
              <code className="text-white/55 text-sm font-mono bg-white/5 px-3 py-1 rounded-lg border border-white/8">?action=orders</code>
            </div>

            <p className="text-white/45 text-sm mb-6 ml-11 max-w-xl">
              Retrieves your paginated order history, newest first. Use <code className="text-amber-400 bg-white/5 px-1 rounded">limit</code> and <code className="text-amber-400 bg-white/5 px-1 rounded">offset</code> for pagination.
            </p>

            <div className="ml-11 space-y-6">
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Query Parameters</span>
                </div>
                <ParamRow name="limit" type="number" required={false} desc="Number of orders per page (default: 20, max: 100)" />
                <ParamRow name="offset" type="number" required={false} desc="Number of orders to skip for pagination (default: 0)" />
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Request</p>
                  <MultiLangBlock snippetKey="orders" activeLang={activeLang} />

                  <div className="mt-4 rounded-xl border border-white/8 overflow-hidden">
                    <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">Order Status Values</span>
                    </div>
                    {[
                      { status: "pending", color: "text-amber-400", desc: "Awaiting processing" },
                      { status: "fulfilled", color: "text-emerald-400", desc: "Data delivered successfully" },
                      { status: "fulfillment_failed", color: "text-red-400", desc: "Delivery failed — contact support" },
                    ].map(({ status, color, desc }) => (
                      <div key={status} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0 text-xs hover:bg-white/[0.02]">
                        <code className={`font-mono font-bold ${color}`}>{status}</code>
                        <span className="text-white/35 ml-auto">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Response · 200 OK</p>
                  <ResponseBlock code={RESPONSES.orders} />
                </div>
              </div>
            </div>
          </section>

          {/* ── Error Reference ──────────────────────────────────────── */}
          <section>
            <SectionAnchor id="errors" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-white/40" />
              </div>
              <h2 className="text-2xl font-black">Error Reference</h2>
            </div>
            <p className="text-white/45 text-sm mb-6 ml-11 max-w-xl">All errors return JSON with an <code className="text-amber-400 bg-white/5 px-1 rounded">error</code> field. HTTP status codes follow REST conventions.</p>

            <div className="ml-11 grid lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                  <div className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-white/20">Code</div>
                  <div className="col-span-4 text-[9px] font-bold uppercase tracking-widest text-white/20">Status</div>
                  <div className="col-span-6 text-[9px] font-bold uppercase tracking-widest text-white/20">Description</div>
                </div>
                {[
                  { code: "400", color: "text-orange-400", title: "Bad Request", desc: "Missing or invalid request fields" },
                  { code: "401", color: "text-red-400", title: "Unauthorized", desc: "Missing or invalid x-api-key" },
                  { code: "402", color: "text-red-400", title: "Payment Required", desc: "Insufficient wallet balance" },
                  { code: "403", color: "text-red-400", title: "Forbidden", desc: "Account not approved or access disabled" },
                  { code: "409", color: "text-yellow-400", title: "Conflict", desc: "Duplicate request_id — returns existing order" },
                  { code: "429", color: "text-orange-400", title: "Too Many Requests", desc: "Rate limit exceeded" },
                  { code: "500", color: "text-red-500", title: "Server Error", desc: "Retry with exponential backoff" },
                ].map(({ code, color, title, desc }) => (
                  <div key={code} className="grid grid-cols-12 gap-2 px-4 py-3 text-xs border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <div className={`col-span-2 font-mono font-black text-sm ${color}`}>{code}</div>
                    <div className="col-span-4 font-semibold text-white/65">{title}</div>
                    <div className="col-span-6 text-white/35">{desc}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">401 Unauthorized</p>
                  <ResponseBlock code={RESPONSES.error_401} variant="error" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">403 Forbidden</p>
                  <ResponseBlock code={RESPONSES.error_403} variant="error" />
                </div>
              </div>
            </div>
          </section>

          {/* ── Rate Limits ──────────────────────────────────────────── */}
          <section>
            <SectionAnchor id="rate-limits" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-white/40" />
              </div>
              <h2 className="text-2xl font-black">Rate Limits</h2>
            </div>
            <p className="text-white/45 text-sm mb-6 ml-11 max-w-xl">
              Rate limits are enforced per API key. Exceeding limits returns <code className="text-amber-400 bg-white/5 px-1 rounded">HTTP 429</code>.
              Implement exponential backoff (start at 1 s, double each retry, cap at 32 s).
            </p>

            <div className="ml-11 space-y-4">
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
                  <div className="col-span-6 text-[9px] font-bold uppercase tracking-widest text-white/20">Endpoint</div>
                  <div className="col-span-3 text-[9px] font-bold uppercase tracking-widest text-white/20">Default Limit</div>
                  <div className="col-span-3 text-[9px] font-bold uppercase tracking-widest text-white/20">Window</div>
                </div>
                {[
                  { endpoint: "GET ?action=balance", limit: "120 req", window: "per minute" },
                  { endpoint: "GET ?action=plans", limit: "60 req", window: "per minute" },
                  { endpoint: "GET ?action=orders", limit: "60 req", window: "per minute" },
                  { endpoint: "POST ?action=buy", limit: "30 req", window: "per minute (configurable)" },
                ].map(({ endpoint, limit, window }) => (
                  <div key={endpoint} className="grid grid-cols-12 px-4 py-3 text-xs border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <code className="col-span-6 font-mono text-white/55">{endpoint}</code>
                    <span className="col-span-3 text-amber-400 font-bold">{limit}</span>
                    <span className="col-span-3 text-white/30">{window}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-white/25">
                Admins can adjust your <code className="text-amber-400">buy</code> rate limit. Contact support to request a higher limit for high-volume integrations.
              </p>
            </div>
          </section>

          {/* ── Best Practices ───────────────────────────────────────── */}
          <section>
            <SectionAnchor id="best-practices" />
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-white/40" />
              </div>
              <h2 className="text-2xl font-black">Best Practices</h2>
            </div>
            <p className="text-white/45 text-sm mb-6 ml-11 max-w-xl">Follow these guidelines for a reliable, secure integration.</p>

            <div className="ml-11 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  icon: Lock, color: "text-emerald-400", bg: "bg-emerald-400/8 border-emerald-400/15",
                  title: "Store keys server-side only",
                  body: "Never embed your API key in mobile apps, frontend JavaScript, or public repositories. Load it from an environment variable on your backend.",
                },
                {
                  icon: RotateCcw, color: "text-purple-400", bg: "bg-purple-400/8 border-purple-400/15",
                  title: "Use idempotency keys",
                  body: "Generate a UUID (e.g. crypto.randomUUID()) per order attempt and pass it as request_id. This makes retries safe — the same order will never be charged twice.",
                },
                {
                  icon: Activity, color: "text-sky-400", bg: "bg-sky-400/8 border-sky-400/15",
                  title: "Check balance before bulk orders",
                  body: "Call ?action=balance before dispatching large batches to avoid mid-batch 402 failures. Pause the batch and top up if balance is low.",
                },
                {
                  icon: RotateCcw, color: "text-amber-400", bg: "bg-amber-400/8 border-amber-400/15",
                  title: "Rotate keys periodically",
                  body: "Regenerate your API key from the Developer Dashboard regularly. Old keys are immediately invalidated — update all integrations before rotating.",
                },
                {
                  icon: AlertCircle, color: "text-orange-400", bg: "bg-orange-400/8 border-orange-400/15",
                  title: "Handle 500s with backoff",
                  body: "On a 500 error, retry with exponential backoff: wait 1 s, then 2 s, 4 s, 8 s… up to 32 s. Always include a unique request_id so retries are safe.",
                },
                {
                  icon: Globe, color: "text-blue-400", bg: "bg-blue-400/8 border-blue-400/15",
                  title: "Poll orders for fulfillment",
                  body: "The buy endpoint returns status: \"pending\". Poll ?action=orders or check the dashboard to confirm delivery. Most orders fulfil within 30 seconds.",
                },
              ].map(({ icon: Icon, color, bg, title, body }) => (
                <div key={title} className={`p-5 rounded-xl border ${bg} space-y-3`}>
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${color} shrink-0`} />
                    <p className="text-sm font-bold text-white/80">{title}</p>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Support CTA ──────────────────────────────────────────── */}
          <section className="border-t border-white/5 pt-12">
            <div className="rounded-2xl bg-gradient-to-br from-amber-400/8 via-transparent to-transparent border border-amber-400/15 p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto">
                <Terminal className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-2xl font-black">Need integration help?</h3>
              <p className="text-white/40 text-sm max-w-sm mx-auto">
                Our technical team is on WhatsApp to assist with custom setups, bulk automation, webhook questions, and anything else.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a href="https://whatsapp.com/channel/0029VbCx0q4KLaHfJaiHLN40" target="_blank" rel="noreferrer">
                  <Button className="bg-amber-400 text-black hover:bg-amber-300 font-bold rounded-xl px-8 h-11 gap-2">
                    <Terminal className="w-4 h-4" /> Chat on WhatsApp
                  </Button>
                </a>
                <Link to="/dashboard/api">
                  <Button variant="outline" className="border-white/10 text-white/60 hover:bg-white/5 rounded-xl px-6 h-11 gap-2">
                    <Key className="w-4 h-4" /> Manage API Key
                  </Button>
                </Link>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
};

export default APIDocumentation;
