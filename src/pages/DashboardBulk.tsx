import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Users, Send, CheckCircle2, AlertTriangle,
  Download, Info, Building2, MessageCircle, ChevronDown,
  ChevronUp, Zap, Upload, FileSpreadsheet, X,
} from "lucide-react";
import { basePackages } from "@/lib/data";

// ─── Network config ────────────────────────────────────────────────────────────
const NET_CFG = {
  MTN:       { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.35)", text: "#fbbf24" },
  Telecel:   { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.35)",  text: "#ef4444" },
  AirtelTigo:{ color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.35)", text: "#3b82f6" },
} as const;

const CARD_BG  = "#111116";
const PAGE_BG  = "#0a0a0f";
const INPUT_BG = "#1a1a24";

const DashboardBulk = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [inputNumbers, setInputNumbers]       = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<"MTN" | "Telecel" | "AirtelTigo">("MTN");
  const [selectedSize, setSelectedSize]       = useState("");
  const [isProcessing, setIsProcessing]       = useState(false);
  const [results, setResults]                 = useState<{ phone: string; status: "success" | "failed"; error?: string }[] | null>(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [showB2B, setShowB2B]                 = useState(false);
  const [confirmOpen, setConfirmOpen]         = useState(false);

  const cfg      = NET_CFG[selectedNetwork];
  const packages = useMemo(() => basePackages[selectedNetwork] || [], [selectedNetwork]);
  const selectedPackage = packages.find(p => p.size === selectedSize);

  const parsedNumbers = useMemo(() => {
    return inputNumbers
      .split(/[\s,;\n]+/)
      .map(n => n.replace(/\D+/g, ""))
      .filter(n => n.length >= 9 && n.length <= 12);
  }, [inputNumbers]);

  const totalCost = (selectedPackage?.price || 0) * parsedNumbers.length;
  const canSend   = parsedNumbers.length > 0 && !!selectedSize && !isProcessing;

  // CSV upload
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const numbers = text
        .split(/[\r\n,;]+/)
        .map(n => n.replace(/\D+/g, "").trim())
        .filter(n => n.length >= 9 && n.length <= 12)
        .join("\n");
      setInputNumbers(prev => prev ? prev + "\n" + numbers : numbers);
      toast({ title: `Loaded ${numbers.split("\n").filter(Boolean).length} numbers from file` });
    };
    reader.readAsText(file);
  };

  const handleBulkSend = async () => {
    setConfirmOpen(false);
    setIsProcessing(true);
    setResults([]);

    const batchResults: { phone: string; status: "success" | "failed"; error?: string }[] = [];

    for (let i = 0; i < parsedNumbers.length; i++) {
      const phone = parsedNumbers[i];
      try {
        const { data, error } = await supabase.functions.invoke("wallet-buy-data", {
          body: {
            network: selectedNetwork,
            package_size: selectedPackage!.size,
            customer_phone: phone,
            amount: selectedPackage!.price,
            reference: crypto.randomUUID(),
          },
        });

        if (error || data?.error) {
          batchResults.push({ phone, status: "failed", error: data?.error || "Transaction failed" });
        } else {
          if (data?.order_id) {
            supabase.functions.invoke("verify-payment", { body: { reference: data.order_id } }).catch(() => {});
          }
          batchResults.push({ phone, status: "success" });
        }
      } catch {
        batchResults.push({ phone, status: "failed", error: "System error" });
      }
      setResults([...batchResults]);
    }

    setIsProcessing(false);
    setShowSuccessOverlay(true);
  };

  const successCount = results?.filter(r => r.status === "success").length ?? 0;
  const failedCount  = results?.filter(r => r.status === "failed").length ?? 0;

  return (
    <div className="min-h-screen pb-24" style={{ background: PAGE_BG }}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Bulk Disbursement</h1>
              <p className="text-[11px] text-white/40">Send data to many numbers at once</p>
            </div>
          </div>
          <button
            onClick={() => {
              const csv = "phone\n0240000001\n0240000002\n0240000003";
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              a.download = "bulk_sample.csv";
              a.click();
            }}
            className="flex items-center gap-1.5 px-3 h-8 rounded-xl text-[11px] font-bold border transition-all"
            style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.50)" }}
          >
            <Download className="w-3.5 h-3.5" /> Sample CSV
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── LEFT ── */}
          <div className="lg:col-span-7 space-y-4">

            {/* Step 1 – Network */}
            <div className="rounded-3xl overflow-hidden border border-white/8" style={{ background: CARD_BG }}>
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/6">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-black shrink-0" style={{ background: cfg.color }}>1</span>
                <p className="text-xs font-black uppercase tracking-widest text-white/40">Select Network</p>
              </div>
              <div className="p-4 grid grid-cols-3 gap-2.5">
                {(["MTN", "Telecel", "AirtelTigo"] as const).map(net => {
                  const c = NET_CFG[net];
                  const active = selectedNetwork === net;
                  return (
                    <button
                      key={net}
                      type="button"
                      onClick={() => { setSelectedNetwork(net); setSelectedSize(""); }}
                      className="h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all border-2"
                      style={active
                        ? { background: c.bg, borderColor: c.border, color: c.text }
                        : { background: INPUT_BG, borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.40)" }}
                    >
                      {net}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2 – Recipients */}
            <div className="rounded-3xl overflow-hidden border border-white/8" style={{ background: CARD_BG }}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-black shrink-0" style={{ background: cfg.color }}>2</span>
                  <p className="text-xs font-black uppercase tracking-widest text-white/40">Recipients</p>
                </div>
                {parsedNumbers.length > 0 && (
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                    {parsedNumbers.length} numbers
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                {/* Upload zone */}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  aria-label="Upload numbers file"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFileUpload(f); }}
                  className="w-full h-16 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 transition-all"
                  style={{ borderColor: "rgba(255,255,255,0.12)", background: INPUT_BG }}
                >
                  <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                  <div className="text-left">
                    <p className="text-xs font-black text-white/70">Upload CSV / Excel file</p>
                    <p className="text-[10px] text-white/30">Column A: phone · Column B: optional</p>
                  </div>
                  <Upload className="w-4 h-4 text-white/20 ml-auto mr-1" />
                </button>

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                  <span className="text-[10px] text-white/25 font-bold">or type manually</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                </div>

                <div className="relative">
                  <textarea
                    value={inputNumbers}
                    onChange={(e) => setInputNumbers(e.target.value)}
                    placeholder={"0240000001\n0550000002\n0271234567"}
                    rows={6}
                    className="w-full rounded-2xl px-4 py-3 text-sm font-mono text-white resize-none outline-none transition-all"
                    style={{ background: INPUT_BG, border: "1.5px solid rgba(255,255,255,0.08)", lineHeight: 1.7 }}
                  />
                  {inputNumbers && (
                    <button
                      type="button"
                      onClick={() => setInputNumbers("")}
                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-white/25">One number per line, or separate by comma/space. Valid prefixes: 024, 025, 053, 054, 055, 059.</p>
              </div>
            </div>

            {/* Step 3 – Package */}
            <div className="rounded-3xl overflow-hidden border border-white/8" style={{ background: CARD_BG }}>
              <div className="flex items-center gap-2 px-5 py-4 border-b border-white/6">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-black shrink-0" style={{ background: cfg.color }}>3</span>
                <p className="text-xs font-black uppercase tracking-widest text-white/40">Choose Package</p>
              </div>
              <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {packages.map(p => {
                  const active = selectedSize === p.size;
                  return (
                    <button
                      key={p.size}
                      type="button"
                      onClick={() => setSelectedSize(p.size)}
                      className="p-3 rounded-2xl text-left transition-all border-2"
                      style={active
                        ? { background: cfg.bg, borderColor: cfg.border }
                        : { background: INPUT_BG, borderColor: "rgba(255,255,255,0.07)" }}
                    >
                      <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: active ? cfg.color : "rgba(255,255,255,0.30)" }}>{selectedNetwork}</p>
                      <p className="text-lg font-black text-white leading-none">{p.size}</p>
                      <p className="text-xs font-black mt-1" style={{ color: cfg.color }}>₵{p.price.toFixed(2)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT – Summary ── */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-3xl overflow-hidden border border-white/8" style={{ background: CARD_BG }}>
                <div className="px-5 py-4 border-b border-white/6">
                  <p className="text-xs font-black uppercase tracking-widest text-white/40">Order Summary</p>
                </div>
                <div className="px-5 py-5 space-y-3">
                  {[
                    { label: "Network",     value: selectedNetwork },
                    { label: "Package",     value: selectedSize || "—" },
                    { label: "Unit price",  value: selectedPackage ? `₵${selectedPackage.price.toFixed(2)}` : "—" },
                    { label: "Recipients", value: `${parsedNumbers.length} numbers` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-white/35">{label}</span>
                      <span className="text-xs font-bold text-white/80">{value}</span>
                    </div>
                  ))}

                  <div className="pt-3 mt-1 border-t border-white/6 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Total Cost</span>
                    <span className="text-3xl font-black" style={{ color: cfg.color }}>₵{totalCost.toFixed(2)}</span>
                  </div>
                </div>

                {/* Send button */}
                <div className="px-5 pb-5">
                  <button
                    type="button"
                    onClick={() => canSend && setConfirmOpen(true)}
                    disabled={!canSend}
                    className="w-full h-14 rounded-2xl font-black text-base text-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:scale-100"
                    style={{ background: `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.color}cc 100%)`, boxShadow: canSend ? `0 4px 24px ${cfg.color}40` : "none" }}
                  >
                    <Zap className="w-5 h-5" /> Start Disbursement
                  </button>

                  <div className="flex items-start gap-2 mt-3">
                    <Info className="w-3.5 h-3.5 text-white/20 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-white/25 leading-relaxed">
                      Processed sequentially. Don't close the tab until complete.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live results */}
              {results && results.length > 0 && (
                <div className="rounded-3xl overflow-hidden border border-white/8" style={{ background: CARD_BG }}>
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Live Results</p>
                    <div className="flex gap-3">
                      {successCount > 0 && <span className="text-[10px] font-black text-emerald-400">{successCount} sent</span>}
                      {failedCount  > 0 && <span className="text-[10px] font-black text-red-400">{failedCount} failed</span>}
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-white/4">
                    {results.map((res, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-2.5">
                        <span className="text-xs font-mono text-white/50">{res.phone}</span>
                        {res.status === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <div className="flex items-center gap-1 text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold">Failed</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {isProcessing && (
                      <div className="flex items-center gap-2 px-5 py-3">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span className="text-[11px] text-white/40">Processing {results.length + 1} of {parsedNumbers.length}…</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── B2B Section ── */}
        <div className="rounded-3xl overflow-hidden border border-amber-400/15" style={{ background: "rgba(251,191,36,0.04)" }}>
          <button
            type="button"
            onClick={() => setShowB2B(v => !v)}
            className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.2)" }}>
                <Building2 className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="font-black text-sm text-white">B2B & Corporate Pricing</p>
                <p className="text-[11px] text-white/40">Volume discounts for businesses, churches & schools</p>
              </div>
            </div>
            {showB2B ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
          </button>

          {showB2B && (
            <div className="px-6 pb-6 space-y-5 border-t border-amber-400/10">
              <p className="text-sm text-white/40 pt-4">Get volume discounts applied automatically. Contact us via WhatsApp to lock in your corporate rate.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Starter",    range: "1 – 9 numbers",  discount: "Standard rate",        highlight: false },
                  { label: "Business",   range: "10 – 49 numbers",discount: "5% off each bundle",   highlight: false },
                  { label: "Enterprise", range: "50+ numbers",    discount: "12% off + priority",   highlight: true  },
                ].map(tier => (
                  <div
                    key={tier.label}
                    className="rounded-2xl border p-4 space-y-1.5"
                    style={tier.highlight
                      ? { background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.30)" }
                      : { background: INPUT_BG, borderColor: "rgba(255,255,255,0.08)" }}
                  >
                    <p className="text-sm font-black" style={{ color: tier.highlight ? "#fbbf24" : "rgba(255,255,255,0.80)" }}>{tier.label}</p>
                    <p className="text-[11px] text-white/35">{tier.range}</p>
                    <p className="text-xs font-bold" style={{ color: tier.highlight ? "#fbbf24" : "rgba(255,255,255,0.40)" }}>{tier.discount}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/8 p-4 space-y-2.5" style={{ background: INPUT_BG }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">What corporate clients get</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {["Volume discount on every bundle","Dedicated WhatsApp support line","Monthly usage report (CSV)","Priority fulfillment queue","Recurring bulk schedule option","Custom invoice on request"].map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs text-white/50">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={`https://wa.me/233${(profile?.support_number || "").replace(/^0/, "")}?text=${encodeURIComponent("Hi, I'm interested in a corporate bulk data plan. Please share pricing details.")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-black text-black transition-all"
                  style={{ background: "#fbbf24" }}
                >
                  <MessageCircle className="w-4 h-4" /> Request Corporate Quote
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm Dialog ── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setConfirmOpen(false)} />
          <div className="relative w-full max-w-sm rounded-3xl border border-white/10 p-6 space-y-5" style={{ background: "#111116" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}20`, border: `1px solid ${cfg.color}40` }}>
                <Zap className="w-5 h-5" style={{ color: cfg.color }} />
              </div>
              <div>
                <p className="font-black text-white">Confirm Disbursement</p>
                <p className="text-[11px] text-white/40">This will charge your wallet</p>
              </div>
            </div>

            <div className="rounded-2xl p-4 space-y-2 border border-white/6" style={{ background: INPUT_BG }}>
              {[
                ["Network",    selectedNetwork],
                ["Package",    selectedSize],
                ["Recipients", `${parsedNumbers.length} numbers`],
                ["Total Cost", `₵${totalCost.toFixed(2)}`],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-white/35">{l}</span>
                  <span className="font-bold text-white/80">{v}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 h-12 rounded-2xl font-bold text-sm transition-all"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.50)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkSend}
                className="flex-[2] h-12 rounded-2xl font-black text-sm text-black flex items-center justify-center gap-2 transition-all"
                style={{ background: `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.color}cc 100%)` }}
              >
                <Send className="w-4 h-4" /> Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Overlay ── */}
      {showSuccessOverlay && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" />
          <div className="relative max-w-sm w-full border border-white/10 rounded-[2.5rem] p-10 text-center space-y-6" style={{ background: "#0f0f17" }}>
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl opacity-30 animate-pulse" />
              <div className="relative w-full h-full rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-white tracking-tight">Done!</h2>
              <p className="text-sm text-white/40">
                {successCount} sent · {failedCount} failed
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-3 border border-emerald-500/20" style={{ background: "rgba(16,185,129,0.08)" }}>
                <p className="text-2xl font-black text-emerald-400">{successCount}</p>
                <p className="text-[10px] text-emerald-400/60 font-bold uppercase">Sent</p>
              </div>
              <div className="rounded-2xl p-3 border border-red-500/20" style={{ background: "rgba(239,68,68,0.08)" }}>
                <p className="text-2xl font-black text-red-400">{failedCount}</p>
                <p className="text-[10px] text-red-400/60 font-bold uppercase">Failed</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setShowSuccessOverlay(false); setResults(null); setInputNumbers(""); setSelectedSize(""); }}
              className="w-full h-12 rounded-2xl font-black text-sm text-black transition-all"
              style={{ background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)" }}
            >
              Start New Batch
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardBulk;
