import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  GraduationCap, Loader2, ShieldCheck,
  CreditCard, Wallet, ChevronRight, RotateCcw,
  CheckCircle2, Hash, Smartphone, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectivity } from "@/hooks/useConnectivity";
import { WifiOff } from "lucide-react";
import { playSuccessSound } from "@/lib/sound";

type VoucherType = "WASSCE" | "BECE";

const DEFAULT_VOUCHERS = [
  { id: "WASSCE" as VoucherType, label: "WAEC / WASSCE", price: 18.00, description: "Valid for checking WASSCE Results" },
  { id: "BECE" as VoucherType,   label: "BECE Result",    price: 15.00, description: "Valid for checking BECE Results" },
];

const DashboardResultCheckers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isOnline } = useConnectivity();

  const [vouchers, setVouchers] = useState(DEFAULT_VOUCHERS);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [voucherType, setVoucherType] = useState<VoucherType | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);

  // Fetch live prices from system settings
  React.useEffect(() => {
    supabase
      .from("public_system_settings")
      .select("wassce_price, bece_price")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setVouchers([
            { id: "WASSCE", label: "WAEC / WASSCE", price: Number(data.wassce_price || 18.00), description: "Valid for checking WASSCE Results" },
            { id: "BECE",   label: "BECE Result",    price: Number(data.bece_price || 15.00), description: "Valid for checking BECE Results" },
          ]);
        }
      })
      .finally(() => setPricesLoading(false));
  }, []);

  const reset = () => {
    setVoucherType(null);
    setQuantity("1");
    setRecipient("");
    setSuccessData(null);
  };

  const handlePurchase = async () => {

    if (!voucherType) {
      toast({ title: "Select a checker type", variant: "destructive" });
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      toast({ title: "Invalid Quantity", description: "Enter a value between 1 and 100", variant: "destructive" });
      return;
    }

    const digits = recipient.replace(/\D/g, "");
    if (digits.length !== 10 || !digits.startsWith("0")) {
      toast({ title: "Invalid Recipient", description: "Please enter a valid 10-digit number starting with 0", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("voucher-purchase", {
        body: {
          VoucherType: voucherType,
          Recipient: digits,
          Quantity: qty,
        }
      });

      if (error || !data?.success) {
        toast({ 
          title: "Purchase Failed", 
          description: data?.error || error?.message || "Insufficient balance or provider error.", 
          variant: "destructive" 
        });
      } else {
        playSuccessSound();
        toast({ title: "Purchase Successful!", description: `Vouchers delivered to ${digits}` });
        setSuccessData(data);
      }
    } catch (err: any) {
      toast({ title: "Network Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const activePrice = voucherType ? vouchers.find(v => v.id === voucherType)?.price || 0 : 0;
  const qtyNum = parseInt(quantity, 10) || 0;
  const totalCost = activePrice * qtyNum;
  const canSubmit = voucherType && qtyNum > 0 && recipient.replace(/\D/g, "").length === 10 && isOnline;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to Clipboard" });
  };

  // SUCCESS STATE SCREEN
  if (successData) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8 animate-in zoom-in-95 duration-300">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="font-black text-3xl tracking-tight text-foreground">Order Completed!</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Your result checker pins have been generated successfully and delivered to the recipient.
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xl">
          <div className="bg-emerald-500/10 border-b border-border p-5 flex justify-between items-center">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500/70">Voucher Type</p>
              <p className="font-black text-foreground">{voucherType} Checker (x{qtyNum})</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500/70">Total Deducted</p>
              <p className="font-black text-foreground text-lg">₵{totalCost.toFixed(2)}</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <h3 className="font-black text-sm uppercase tracking-wider text-muted-foreground/60">Generated Pins</h3>
            {Array.isArray(successData.vouchers) && successData.vouchers.length > 0 ? (
              <div className="grid gap-3">
                {successData.vouchers.map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-secondary/40 border border-border group hover:border-emerald-500/30 transition-all">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">SERIAL / PIN</p>
                      <p className="font-mono font-black text-foreground tracking-wider text-sm md:text-base">
                        {v.serial} <span className="text-muted-foreground mx-1.5">|</span> {v.pin}
                      </p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(`${v.serial} | ${v.pin}`)}
                      className="p-2 rounded-lg bg-card border border-border opacity-60 group-hover:opacity-100 hover:bg-secondary transition-all"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-amber-600 font-bold text-sm">Vouchers were generated successfully and will be accessible via text shortly.</p>
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={reset}
          className="w-full h-14 bg-primary text-primary-foreground font-black rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          Buy More Pins
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 bg-amber-400/15 text-amber-500 px-3 py-1 rounded-full text-xs font-black mb-2 uppercase tracking-widest border border-amber-400/20">
          <GraduationCap className="w-3.5 h-3.5" />
          Instant Delivery
        </div>
        <h1 className="font-black text-3xl tracking-tight text-foreground mb-1">Result Checkers</h1>
        <p className="text-muted-foreground text-sm">Buy WAEC and BECE Result Checker pins directly from your wallet.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Procurement Card */}
        <div className="rounded-3xl border border-border bg-card/60 backdrop-blur-sm p-6 md:p-8 space-y-7">
          
          {/* 1. Select Type */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/60 mb-3 flex items-center">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black mr-2">1</span>
              Select Checker Type
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {vouchers.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVoucherType(v.id)}
                  className={cn(
                    "relative flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all hover:scale-[1.01]",
                    voucherType === v.id
                      ? "border-primary/50 bg-primary/10 text-foreground shadow-md shadow-primary/10"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground hover:border-border/80"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", voucherType === v.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-sm leading-tight mb-0.5">{v.label}</p>
                    <p className="text-[10px] font-medium opacity-70 mb-1.5">{v.description}</p>
                    <span className="inline-flex items-center bg-card border px-2 py-0.5 rounded-md font-black text-xs text-foreground">₵{v.price.toFixed(2)}</span>
                  </div>
                  {voucherType === v.id && (
                    <CheckCircle2 className="w-4 h-4 text-primary absolute top-3 right-3" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* 2. Recipient */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/60 mb-3 flex items-center">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black mr-2">2</span>
                Recipient Number
              </p>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                <input
                  type="tel"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="e.g. 0541234567"
                  className="w-full h-12 pl-11 pr-4 bg-secondary/60 border border-border rounded-2xl text-sm font-black focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* 3. Quantity */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/60 mb-3 flex items-center">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black mr-2">3</span>
                Quantity
              </p>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 bg-secondary/60 border border-border rounded-2xl text-sm font-black focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handlePurchase}
            disabled={loading || !canSubmit}
            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground font-black text-base transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Authorizing Purchase...
              </>
            ) : !isOnline ? (
              <>
                <WifiOff className="w-5 h-5" />
                Waiting for Internet...
              </>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Pay From Wallet
              </>
            )}
          </button>

        </div>

        {/* Summary Panel */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-border bg-card/60 backdrop-blur-sm p-6 space-y-4 shadow-sm">
            <h3 className="font-black text-foreground text-base">Payment Summary</h3>
            
            <div className="space-y-3.5 text-sm">
              <SummaryRow label="Service" value="Result Checker" />
              <SummaryRow label="Type" value={voucherType || "—"} />
              <SummaryRow label="Unit Price" value={voucherType ? `₵${activePrice.toFixed(2)}` : "—"} />
              <SummaryRow label="Quantity" value={`x${qtyNum}`} />
              
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Total Cost</span>
                <span className="font-black text-foreground text-xl">
                  ₵{totalCost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Trust Banner */}
          <div className="bg-card/40 border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-foreground">Secured Purchase</p>
              <p className="text-[10px] text-muted-foreground">Deducted directly from your main balance.</p>
            </div>
          </div>

          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 text-muted-foreground text-xs font-bold hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Fields
          </button>
        </div>
      </div>
    </div>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-bold text-foreground text-right">{value}</span>
  </div>
);

export default DashboardResultCheckers;
