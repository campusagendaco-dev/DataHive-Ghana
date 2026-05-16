import React, { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { invokePublicFunctionAsUser } from "@/lib/public-function-client";
import { detectNetwork } from "@/lib/utils";
import { fetchApiPricingContext, applyPriceMultiplier } from "@/lib/api-source-pricing";
import { supabase } from "@/integrations/supabase/client";
import { basePackages, getPublicPrice } from "@/lib/data";

interface OrderRow {
  phone: string;
  network: string;
  package_size: string;
  amount: number;
}

const BulkDispatchUploader = ({ onComplete }: { onComplete?: () => void }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<OrderRow[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      toast({ title: "Invalid File", description: "Please upload a CSV file.", variant: "destructive" });
      return;
    }
    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").filter(line => line.trim().length > 0);
    
    // Check header
    const hasHeader = lines[0].toLowerCase().includes("phone");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    if (dataLines.length > 500) {
      setErrors(["Maximum 500 numbers allowed per batch."]);
      return;
    }

    setProcessing(true);
    setErrors([]);

    try {
      // Fetch pricing context
      const [{ data: userRes }, pricingCtx, { data: settingsRes }] = await Promise.all([
        supabase.auth.getUser(),
        fetchApiPricingContext(),
        supabase.from("global_package_settings").select("network, package_size, public_price, agent_price, sub_agent_price")
      ]);

      const user = userRes.user;
      if (!user) throw new Error("Not logged in");

      const { data: profile } = await supabase.from("profiles").select("is_sub_agent, agent_prices, parent_agent_id").eq("user_id", user.id).single();
      
      let parentAssignedPrices = {};
      if (profile?.is_sub_agent && profile.parent_agent_id) {
        const { data: pProfile } = await supabase.from("profiles").select("sub_agent_prices").eq("user_id", profile.parent_agent_id).single();
        if (pProfile?.sub_agent_prices) parentAssignedPrices = pProfile.sub_agent_prices;
      }

      const rows: OrderRow[] = [];
      let calculatedTotal = 0;
      const parseErrors: string[] = [];

      dataLines.forEach((line, index) => {
        const cols = line.split(",").map(c => c.trim());
        if (cols.length < 2) {
          parseErrors.push(`Row ${index + 1}: Missing columns. Expected Phone, Package [Network]`);
          return;
        }

        const phone = cols[0].replace(/\D+/g, "");
        if (phone.length !== 10) {
          parseErrors.push(`Row ${index + 1}: Invalid phone number ${cols[0]}`);
          return;
        }

        const pkgSize = cols[1];
        let network = cols.length > 2 ? cols[2] : detectNetwork(phone);

        if (!network) {
          parseErrors.push(`Row ${index + 1}: Could not detect network for ${phone}`);
          return;
        }
        
        network = network === "AT" ? "AirtelTigo" : network;
        network = network === "Vodafone" ? "Telecel" : network;

        // Find package base price
        const bPkg = basePackages[network]?.find(p => p.size.replace(/\s+/g, "").toUpperCase() === pkgSize.replace(/\s+/g, "").toUpperCase());
        if (!bPkg) {
          parseErrors.push(`Row ${index + 1}: Unknown package ${pkgSize} for ${network}`);
          return;
        }

        // Apply pricing logic similar to DashboardBuyDataNetwork
        const setting = settingsRes?.find(s => s.network === network && s.package_size.replace(/\s+/g, "").toUpperCase() === pkgSize.replace(/\s+/g, "").toUpperCase());
        
        const getAssigned = (map: any) => {
          if (!map) return null;
          const byNet = map[network] || map[network.toUpperCase()];
          if (!byNet) return null;
          const val = Number(byNet[pkgSize] || byNet[pkgSize.toUpperCase()]);
          return val > 0 ? val : null;
        };

        const assignedPrice = getAssigned(parentAssignedPrices) || getAssigned(profile?.agent_prices);
        
        let resolvedBasePrice = bPkg.price;
        if (assignedPrice && assignedPrice > 0) {
           resolvedBasePrice = assignedPrice;
        } else if (profile?.is_sub_agent && Number(setting?.sub_agent_price) > 0) {
           resolvedBasePrice = Number(setting?.sub_agent_price);
        } else if (Number(setting?.agent_price) > 0) {
           resolvedBasePrice = Number(setting?.agent_price);
        }

        const finalPrice = applyPriceMultiplier(resolvedBasePrice, pricingCtx.multipliers[network] || 1);
        calculatedTotal += finalPrice;

        rows.push({
          phone,
          network,
          package_size: pkgSize,
          amount: finalPrice
        });
      });

      if (parseErrors.length > 0) {
        setErrors(parseErrors);
        setParsedRows([]);
        setTotalCost(0);
      } else {
        setParsedRows(rows);
        setTotalCost(calculatedTotal);
      }
    } catch (err: any) {
      setErrors([err.message || "Failed to parse CSV"]);
    } finally {
      setProcessing(false);
    }
  };

  const submitBatch = async () => {
    if (parsedRows.length === 0) return;
    setProcessing(true);
    
    try {
      const payload = {
        orders: parsedRows.map(r => ({
          customer_phone: r.phone,
          network: r.network,
          package_size: r.package_size,
          amount: r.amount
        }))
      };

      const { data, error } = await invokePublicFunctionAsUser("agent-bulk-orders", { body: payload });
      
      if (error || data?.error) {
        throw new Error(data?.error || "Failed to dispatch orders.");
      }

      toast({ title: "Bulk Dispatch Successful", description: `${parsedRows.length} orders queued for delivery.` });
      setFile(null);
      setParsedRows([]);
      setTotalCost(0);
      if (onComplete) onComplete();
      
    } catch (err: any) {
      toast({ title: "Bulk Dispatch Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <div 
          onDragOver={e => e.preventDefault()} 
          onDrop={handleFileDrop}
          className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/20 hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadCloud className="w-10 h-10 text-muted-foreground mb-3" />
          <h3 className="font-bold text-foreground mb-1">Upload CSV File</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Drag & drop or click to select. Format: Phone, Package (e.g. 0241234567, 1GB)
          </p>
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
              <div>
                <p className="font-bold text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={() => { setFile(null); setParsedRows([]); setErrors([]); }} className="p-2 hover:bg-muted rounded-full">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-4">
            {processing && parsedRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm font-medium">Validating numbers...</p>
              </div>
            ) : errors.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive font-bold text-sm mb-3">
                  <AlertCircle className="w-4 h-4" /> Validation Errors Found
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                  {errors.map((e, i) => (
                    <p key={i} className="text-xs text-destructive">{e}</p>
                  ))}
                </div>
              </div>
            ) : parsedRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Ready to Dispatch
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Cost</p>
                    <p className="font-black text-lg text-foreground">GH₵ {totalCost.toFixed(2)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Found {parsedRows.length} valid numbers. Clicking Dispatch will instantly debit your wallet and begin processing all orders.
                </p>
                <Button onClick={submitBatch} disabled={processing} className="w-full font-bold">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : `Dispatch ${parsedRows.length} Orders`}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkDispatchUploader;
