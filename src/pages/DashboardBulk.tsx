import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Zap, Loader2, Users, FileText, Send, 
  CheckCircle2, AlertTriangle, ShieldCheck,
  TrendingUp, Download, Info
} from "lucide-react";
import { basePackages } from "@/lib/data";
import { detectNetwork } from "@/lib/utils";

const DashboardBulk = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [inputNumbers, setInputNumbers] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<"MTN" | "Telecel" | "AirtelTigo">("MTN");
  const [selectedSize, setSelectedSize] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ phone: string; status: "success" | "failed"; error?: string }[] | null>(null);

  const packages = useMemo(() => basePackages[selectedNetwork] || [], [selectedNetwork]);
  const selectedPackage = packages.find(p => p.size === selectedSize);

  // Parse numbers from textarea (comma, space, or newline separated)
  const parsedNumbers = useMemo(() => {
    return inputNumbers
      .split(/[\s,]+/)
      .map(n => n.replace(/\D+/g, ""))
      .filter(n => n.length >= 9 && n.length <= 12);
  }, [inputNumbers]);

  const totalCost = (selectedPackage?.price || 0) * parsedNumbers.length;

  const handleBulkSend = async () => {
    if (parsedNumbers.length === 0) {
      toast({ title: "No valid numbers", description: "Please enter at least one valid phone number.", variant: "destructive" });
      return;
    }
    if (!selectedPackage) {
      toast({ title: "Select a package", variant: "destructive" });
      return;
    }

    if (!confirm(`Are you sure you want to send ${selectedPackage.size} to ${parsedNumbers.length} numbers? Total cost: GHS ${totalCost.toFixed(2)}`)) {
      return;
    }

    setIsProcessing(true);
    setResults([]);

    const batchResults: { phone: string; status: "success" | "failed"; error?: string }[] = [];

    // Process in small batches to avoid edge function timeouts
    for (let i = 0; i < parsedNumbers.length; i++) {
      const phone = parsedNumbers[i];
      try {
        const { data, error } = await supabase.functions.invoke("wallet-buy-data", {
          body: {
            network: selectedNetwork,
            package_size: selectedPackage.size,
            customer_phone: phone,
            amount: selectedPackage.price,
            reference: crypto.randomUUID(),
          },
        });

        if (error || data?.error) {
          batchResults.push({ phone, status: "failed", error: data?.error || "Transaction failed" });
        } else {
          batchResults.push({ phone, status: "success" });
        }
      } catch (err) {
        batchResults.push({ phone, status: "failed", error: "System error" });
      }
      // Update UI progressively
      setResults([...batchResults]);
    }

    setIsProcessing(false);
    toast({ 
      title: "Bulk processing complete", 
      description: `Sent to ${batchResults.filter(r => r.status === "success").length} recipients successfully.` 
    });
  };

  const handleDownloadSample = () => {
    const csvContent = "phone\n0240000001\n0240000002\n0240000003";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bulk_numbers_sample.csv";
    link.click();
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-black" />
            </div>
            Bulk Disbursement
          </h1>
          <p className="text-white/35 text-sm mt-1.5 ml-[52px]">
            Send data to hundreds of numbers at once.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadSample}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white/60 hover:text-white transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Sample CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Input Section */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Step 1: Recipients */}
          <div className="rounded-3xl p-6 space-y-4 bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black">1</div>
                <h2 className="text-sm font-black uppercase tracking-wider text-white/50">Recipients</h2>
              </div>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                {parsedNumbers.length} Numbers Detected
              </span>
            </div>
            
            <p className="text-xs text-white/30">Paste phone numbers separated by commas, spaces or new lines.</p>
            
            <textarea
              value={inputNumbers}
              onChange={(e) => setInputNumbers(e.target.value)}
              placeholder="0240000001, 0240000002..."
              className="w-full h-48 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-mono text-white focus:border-amber-400/50 transition-all outline-none"
            />
          </div>

          {/* Step 2: Package */}
          <div className="rounded-3xl p-6 space-y-6 bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black">2</div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white/50">Select Package</h2>
            </div>

            <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5">
              {(["MTN", "Telecel", "AirtelTigo"] as const).map(net => (
                <button
                  key={net}
                  onClick={() => { setSelectedNetwork(net); setSelectedSize(""); }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                    selectedNetwork === net ? "bg-white/10 text-white shadow-xl" : "text-white/30 hover:text-white/50"
                  }`}
                >
                  {net}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {packages.map(p => (
                <button
                  key={p.size}
                  onClick={() => setSelectedSize(p.size)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all ${
                    selectedSize === p.size 
                      ? "border-amber-400 bg-amber-400/10" 
                      : "border-white/5 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <p className="text-[10px] font-bold text-white/40 uppercase">{selectedNetwork}</p>
                  <p className="text-xl font-black text-white">{p.size}</p>
                  <p className="text-xs font-black text-amber-400 mt-1">₵{p.price.toFixed(2)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Summary & Action */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl p-8 space-y-6 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 sticky top-24">
            <h3 className="text-lg font-black text-white">Bulk Summary</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/40">Network</span>
                <span className="font-bold text-white">{selectedNetwork}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/40">Package</span>
                <span className="font-bold text-white">{selectedSize || "—"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/40">Unit Price</span>
                <span className="font-bold text-white">₵{selectedPackage?.price.toFixed(2) || "0.00"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/40">Total Recipients</span>
                <span className="font-bold text-white">{parsedNumbers.length}</span>
              </div>
              
              <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                <span className="text-white/40 font-bold uppercase tracking-widest text-xs">Total Cost</span>
                <span className="text-3xl font-black text-amber-400">₵{totalCost.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleBulkSend}
              disabled={isProcessing || parsedNumbers.length === 0 || !selectedSize}
              className="w-full py-5 rounded-2xl bg-amber-400 text-black font-black text-lg shadow-2xl shadow-amber-400/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <><Loader2 className="w-6 h-6 animate-spin" /> Processing...</>
              ) : (
                <><Send className="w-6 h-6" /> Start Disbursement</>
              )}
            </button>

            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <Info className="w-5 h-5 text-white/30 shrink-0" />
              <p className="text-[10px] text-white/30 leading-relaxed uppercase font-black tracking-widest">
                Transactions are processed sequentially. Please do not close the window until complete.
              </p>
            </div>
          </div>

          {/* Results section */}
          {results && (
            <div className="rounded-3xl p-6 bg-black/40 border border-white/5 space-y-4 max-h-[400px] overflow-y-auto">
              <h4 className="text-xs font-black text-white/40 uppercase tracking-widest">Processing Results</h4>
              <div className="space-y-2">
                {results.map((res, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <span className="text-xs font-mono text-white/60">{res.phone}</span>
                    {res.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-500">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-[10px] font-bold">Failed</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardBulk;
