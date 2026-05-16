import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, ArrowRightLeft, Wallet, Phone, Landmark, 
  Search, Loader2, CheckCircle2, AlertCircle, Info,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, Globe,
  Eye, EyeOff, Share2, UserPlus, Users, TrendingUp, AlertTriangle, Lock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { SecurityGateway } from "@/components/SecurityGateway";

const GHANA_BANKS = [
  { code: "GCB", name: "GCB Bank" },
  { code: "ADB", name: "Agricultural Development Bank" },
  { code: "BAR", name: "Absa Bank (Barclays)" },
  { code: "STA", name: "Stanbic Bank" },
  { code: "SCB", name: "Standard Chartered" },
  { code: "ECO", name: "Ecobank" },
  { code: "FDL", name: "Fidelity Bank" },
  { code: "GTB", name: "GTBank" },
  { code: "ZEN", name: "Zenith Bank" },
  { code: "UBA", name: "United Bank for Africa" },
  { code: "CAL", name: "CalBank" },
  { code: "UMB", name: "Universal Merchant Bank" },
  { code: "NIB", name: "National Investment Bank" },
  { code: "PRU", name: "Prudential Bank" },
  { code: "BOG", name: "Bank of Ghana" },
];

const AFRICA_COUNTRIES = [
  { code: "GH", name: "Ghana (GHS)", currency: "GHS" },
  { code: "NG", name: "Nigeria (NGN)", currency: "NGN" },
  { code: "KE", name: "Kenya (KES)", currency: "KES" },
  { code: "ZA", name: "South Africa (ZAR)", currency: "ZAR" },
];

const DashboardSwiftVendor = () => {
  const { user } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [todayStats, setTodayStats] = useState({ 
    sales: 0, 
    profit: 0, 
    count: 0,
    cashIn: 0,
    cashOut: 0,
    bankTransfers: 0
  });
  const [networkStatus, setNetworkStatus] = useState({
    MTN: "Stable",
    VOD: "Stable",
    ATL: "Stable",
    BANK: "Stable"
  });
  
  // MoMo State
  const [momoAction, setMomoAction] = useState<"cash-in" | "cash-out">("cash-out");
  const [momoPhone, setMomoPhone] = useState("");
  const [momoAmount, setMomoAmount] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("MTN");
  const [momoAccountName, setMomoAccountName] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  // Bank State
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankAmount, setBankAmount] = useState("");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("GH");
  const [africaBanks, setAfricaBanks] = useState<{code: string, name: string}[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ NGN: 0, KES: 0, ZAR: 0 });
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [balanceThreshold] = useState(500); // threshold
  const [savedRecipients, setSavedRecipients] = useState<{name: string, phone: string, network: string, type: string}[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("swift_recipients");
    if (saved) setSavedRecipients(JSON.parse(saved));
  }, []);

  const saveRecipient = (name: string, phone: string, network: string, type: string) => {
    const newRecipients = [...savedRecipients, { name, phone, network, type }].slice(-10); // Keep last 10
    setSavedRecipients(newRecipients);
    localStorage.setItem("swift_recipients", JSON.stringify(newRecipients));
    toast.success("Recipient saved to directory");
  };

  const handleShareReceipt = (order: any) => {
    const isDisbursement = order.order_type === "vendor_cash_in" || order.order_type === "vendor_bank_transfer";
    const text = `*Swift Vendor Transaction Receipt*%0A%0A` +
                 `*Type:* ${isDisbursement ? "Disbursement" : "Collection"}%0A` +
                 `*Amount:* GHS ${order.amount.toFixed(2)}%0A` +
                 `*Recipient:* ${order.customer_phone}%0A` +
                 `*Status:* SUCCESSFUL%0A` +
                 `*Date:* ${new Date(order.created_at).toLocaleString()}%0A%0A` +
                 `_Thank you for choosing Swift Vendor!_`;
    window.open(`https://wa.me/${order.customer_phone}?text=${text}`, "_blank");
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  // Auto Network Detection
  useEffect(() => {
    const prefix = momoPhone.substring(0, 3);
    if (["024", "054", "055", "059", "025"].includes(prefix)) {
      setMomoNetwork("MTN");
    } else if (["020", "050"].includes(prefix)) {
      setMomoNetwork("VOD");
    } else if (["027", "057", "026", "056"].includes(prefix)) {
      setMomoNetwork("ATL");
    }
    // Reset name verification when phone changes
    setMomoAccountName(null);
  }, [momoPhone]);

  useEffect(() => {
    if (selectedCountry !== "GH") {
      fetchAfricaBanks();
      fetchExchangeRates();
    }
  }, [selectedCountry]);

  const fetchExchangeRates = async () => {
    try {
      const resp = await fetch("https://open.er-api.com/v6/latest/GHS");
      const data = await resp.json();
      if (data && data.rates) {
        setExchangeRates({
          NGN: data.rates.NGN,
          KES: data.rates.KES,
          ZAR: data.rates.ZAR
        });
      }
    } catch (err) {
      console.error("Failed to fetch rates", err);
    }
  };

  const fetchAfricaBanks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("theteller-vendor", {
        body: {
          action: "list-banks",
          country: selectedCountry.toLowerCase() === "ng" ? "nigeria" : selectedCountry.toLowerCase() === "ke" ? "kenya" : "south africa"
        }
      });
      if (data && data.data) {
        setAfricaBanks(data.data.map((b: any) => ({ code: b.code, name: b.name })));
      }
    } catch (err) {
      console.error("Failed to fetch banks", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    if (!user) return;
    const { data } = await supabase.from("wallets").select("balance").eq("agent_id", user.id).single();
    if (data) setWalletBalance(Number(data.balance));

    // Fetch Today's Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: stats } = await supabase
      .from("orders")
      .select("amount, profit, parent_profit")
      .eq("agent_id", user.id)
      .gte("created_at", today.toISOString())
      .eq("status", "fulfilled");

    if (stats) {
      const totals = stats.reduce((acc, curr) => {
        const isCashIn = curr.order_type === "vendor_cash_in";
        const isCashOut = curr.order_type === "vendor_cash_out";
        const isBank = curr.order_type === "vendor_bank_transfer";
        
        return {
          sales: acc.sales + Number(curr.amount),
          profit: acc.profit + (Number(curr.profit) + Number(curr.parent_profit || 0)),
          count: acc.count + 1,
          cashIn: acc.cashIn + (isCashIn ? Number(curr.amount) : 0),
          cashOut: acc.cashOut + (isCashOut ? Number(curr.amount) : 0),
          bankTransfers: acc.bankTransfers + (isBank ? Number(curr.amount) : 0)
        };
      }, { sales: 0, profit: 0, count: 0, cashIn: 0, cashOut: 0, bankTransfers: 0 });
      setTodayStats(totals);
    }

    // Fetch Recent Vendor Orders
    const { data: recent } = await supabase
      .from("orders")
      .select("*")
      .eq("agent_id", user.id)
      .ilike("order_type", "vendor_%")
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (recent) setRecentOrders(recent);
  };

  const handleMomoAction = async () => {
    if (!momoPhone || !momoAmount) {
      toast.error("Please fill in all fields");
      return;
    }

    const amount = parseFloat(momoAmount);
    if (momoAction === "cash-in" && amount > walletBalance) {
      toast.error("Insufficient wallet balance for Cash-In");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("theteller-vendor", {
        body: {
          action: momoAction === "cash-in" ? "momo-disbursement" : "momo-collection",
          amount,
          phone: momoPhone,
          network: momoNetwork,
          description: `Swift Vendor ${momoAction === "cash-in" ? "Cash-In" : "Cash-Out"}`
        }
      });

      if (error) throw error;

      if (data.status === "successful" || data.code === "000") {
        toast.success("Transaction Successful!");
        setMomoAmount("");
        setMomoPhone("");
        setMomoAccountName(null);
        fetchBalance();
      } else if (data.status === "pending" || data.code === "100") {
        toast.info("Transaction Pending", { description: "Wait for customer authorization on their phone." });
        setMomoAmount("");
        setMomoPhone("");
        setMomoAccountName(null);
      } else {
        toast.error("Transaction Failed", { description: data.reason || data.message });
      }
    } catch (err: any) {
      toast.error("Request Failed", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleMomoEnquiry = async () => {
    if (!momoPhone || momoPhone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("theteller-vendor", {
        body: {
          action: "momo-enquiry",
          phone: momoPhone,
          network: momoNetwork
        }
      });

      if (error) throw error;

      if (data.status === "successful" || data.code === "000") {
        setMomoAccountName(data.account_name || "Name Verified");
        toast.success("Account Verified!");
      } else {
        toast.error("Verification Failed", { description: data.reason || data.message });
      }
    } catch (err: any) {
      toast.error("Verification Failed", { description: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleBankEnquiry = async () => {
    if (!bankCode || !accountNumber || !bankAmount) {
      toast.error("Please fill in all fields");
      return;
    }

    const amount = parseFloat(bankAmount);
    if (amount > walletBalance) {
      toast.error("Insufficient wallet balance");
      return;
    }

    setVerifying(true);
    setAccountName(null);
    setReferenceId(null);

    try {
      const { data, error } = await supabase.functions.invoke("theteller-vendor", {
        body: {
          action: selectedCountry === "GH" ? "bank-transfer-init" : "momo-enquiry", // reuse momo-enquiry for general paystack resolution
          amount,
          bank_code: bankCode,
          account_number: accountNumber,
          network: bankCode, // for paystack resolution
          phone: accountNumber, // for paystack resolution
          description: `Swift Vendor Africa Payout (${selectedCountry})`
        }
      });

      if (error) throw error;

      if (data.status === "successful" || data.code === "000") {
        setAccountName(data.account_name);
        setReferenceId(data.reference_id || "paystack_verified");
        toast.success("Account Verified!");
      } else {
        toast.error("Verification Failed", { description: data.reason || data.message });
      }
    } catch (err: any) {
      toast.error("Enquiry Failed", { description: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleBankTransferComplete = async () => {
    if (!referenceId) return;

    setLoading(true);
    try {
      const isAfrica = selectedCountry !== "GH";
      const { data, error } = await supabase.functions.invoke("theteller-vendor", {
        body: {
          action: isAfrica ? "africa-transfer" : "bank-transfer-complete",
          reference_id: referenceId,
          amount: parseFloat(bankAmount),
          account_number: accountNumber,
          bank_code: bankCode,
          account_name: accountName,
          country: selectedCountry,
          currency: AFRICA_COUNTRIES.find(c => c.code === selectedCountry)?.currency,
          description: `Swift Vendor Payout to ${selectedCountry}`
        }
      });

      if (error) throw error;

      if (data.status === "successful" || data.code === "000" || data.status === true) {
        toast.success(isAfrica ? "International Transfer Initiated!" : "Bank Transfer Completed!");
        setBankAmount("");
        setAccountNumber("");
        setAccountName(null);
        setReferenceId(null);
        fetchBalance();
      } else {
        toast.error("Transfer Failed", { description: data.reason || data.message || data.error });
      }
    } catch (err: any) {
      toast.error("Transfer Failed", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SecurityGateway>
      <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-700">
      {walletBalance < balanceThreshold && !isPrivateMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-500">Low Balance Warning</p>
              <p className="text-xs font-bold text-muted-foreground leading-relaxed">Your float is below GHS {balanceThreshold}. Top up soon to avoid missing transactions.</p>
            </div>
          </div>
          <Button size="sm" className="bg-amber-500 hover:bg-amber-600 font-black rounded-lg h-9">Top Up Now</Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Zap className="w-8 h-8 text-amber-400" />
            Swift Vendor
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Flagship Agency Banking POS by theTeller</p>
        </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3 flex flex-col justify-center gap-1">
          <p className="text-[8px] font-black uppercase tracking-widest text-primary/70">Float</p>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <p className={cn("text-sm font-black text-primary truncate", isPrivateMode && "blur-md")}>
              GHS {walletBalance.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex flex-col justify-center gap-1">
          <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70">Profit</p>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-500" />
            <p className={cn("text-sm font-black text-emerald-500 truncate", isPrivateMode && "blur-md")}>
              GHS {todayStats.profit.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="bg-muted/30 border border-white/5 rounded-2xl p-3 flex flex-col justify-center gap-1 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Security</p>
             <Button 
              variant="ghost" 
              size="icon" 
              className="h-4 w-4 rounded-full text-muted-foreground hover:text-primary"
              onClick={() => window.location.reload()} // Force reload to trigger lock
            >
              <Lock className="w-3 h-3" />
            </Button>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn("h-7 w-full rounded-lg justify-start p-0 hover:bg-transparent", isPrivateMode ? "text-amber-500" : "text-muted-foreground")}
            onClick={() => setIsPrivateMode(!isPrivateMode)}
          >
            {isPrivateMode ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            <span className="text-[10px] font-bold">{isPrivateMode ? "Hidden" : "Public"}</span>
          </Button>
        </div>
      </div>
    </div>

      <Tabs defaultValue="momo" className="space-y-6">
        <div className="overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
          <TabsList className="bg-muted/50 p-1 rounded-2xl h-14 w-max sm:w-auto inline-flex whitespace-nowrap">
            <TabsTrigger value="momo" className="rounded-xl h-12 px-4 sm:px-8 font-black gap-2">
              <Phone className="w-4 h-4" />
              MoMo Agency
            </TabsTrigger>
            <TabsTrigger value="bank" className="rounded-xl h-12 px-4 sm:px-8 font-black gap-2">
              <Landmark className="w-4 h-4" />
              Bank Transfer
            </TabsTrigger>
            <TabsTrigger value="africa" className="rounded-xl h-12 px-4 sm:px-8 font-black gap-2 text-indigo-500">
              <Zap className="w-4 h-4" />
              Africa Hub
            </TabsTrigger>
            <TabsTrigger value="insights" className="rounded-xl h-12 px-4 sm:px-8 font-black gap-2">
              <Search className="w-4 h-4" />
              Insights
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="momo" className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-none bg-card/50 shadow-xl shadow-black/5 overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/5">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-primary" />
                  Initiate MoMo Transaction
                </CardTitle>
                <CardDescription>Perform Cash-In (Deposit) or Cash-Out (Withdrawal)</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl h-12">
                  <button 
                    onClick={() => setMomoAction("cash-out")}
                    className={cn(
                      "rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2",
                      momoAction === "cash-out" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:bg-white/10"
                    )}
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    Cash-Out
                  </button>
                  <button 
                    onClick={() => setMomoAction("cash-in")}
                    className={cn(
                      "rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2",
                      momoAction === "cash-in" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:bg-white/10"
                    )}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    Cash-In
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Network</Label>
                    <Select value={momoNetwork} onValueChange={setMomoNetwork}>
                      <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                        <SelectItem value="VOD">Telecel Cash</SelectItem>
                        <SelectItem value="ATL">AirtelTigo Money</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                    <Input 
                      placeholder="e.g. 0244000000" 
                      className="h-12 rounded-xl bg-muted/30 border-none font-bold text-lg"
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount (GHS)</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      className="h-12 rounded-xl bg-muted/30 border-none font-bold text-2xl text-primary"
                      value={momoAmount}
                      onChange={(e) => setMomoAmount(e.target.value)}
                    />
                  </div>

                  {momoAction === "cash-in" && (
                    <>
                      {momoAccountName ? (
                        <div className="p-4 rounded-2xl bg-emerald-400/5 border border-emerald-400/20 flex items-center justify-between animate-in zoom-in-95 duration-300">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">Recipient Name</p>
                            <p className="text-lg font-black text-emerald-400">{momoAccountName}</p>
                          </div>
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                      ) : (
                        <Button 
                          variant="outline"
                          className="w-full h-12 rounded-xl text-sm font-bold border-2 border-primary/20 hover:bg-primary/5 transition-all"
                          disabled={verifying || momoPhone.length < 10}
                          onClick={handleMomoEnquiry}
                        >
                          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Customer Name"}
                        </Button>
                      )}
                    </>
                  )}

                  <Button 
                    className="w-full h-14 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                    disabled={loading || (momoAction === "cash-in" && !momoAccountName)}
                    onClick={() => {
                      handleMomoAction();
                      if (momoAccountName) saveRecipient(momoAccountName, momoPhone, momoNetwork, "momo");
                    }}
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      momoAction === "cash-out" ? "Request Money (Collect)" : "Send Money (Disburse)"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none bg-amber-400/5 shadow-xl shadow-black/5">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-400/10 flex items-center justify-center shrink-0">
                      <Info className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-black text-amber-400 uppercase tracking-widest text-[10px]">How it works</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        {momoAction === "cash-out" 
                          ? "Enter the customer's number and amount. They will receive a prompt on their phone to enter their PIN. Once approved, funds are added to your floating balance instantly."
                          : "Funds will be deducted from your floating balance and sent directly to the customer's wallet. Ensure you have collected physical cash before confirming."
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none bg-card/50 shadow-xl shadow-black/5 overflow-hidden">
                 <CardHeader className="py-4 border-b border-white/5 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Recent Activity</CardTitle>
                    <Button variant="ghost" size="sm" className="h-8 rounded-lg text-primary hover:bg-primary/5">
                      View All
                    </Button>
                 </CardHeader>
                 <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                      {recentOrders.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-xs font-bold">
                          No recent transactions
                        </div>
                      ) : (
                        recentOrders.map((order) => {
                          const isCashIn = order.order_type === "vendor_cash_in" || order.order_type === "vendor_bank_transfer";
                          return (
                            <div key={order.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isCashIn ? "bg-red-400/10" : "bg-emerald-400/10")}>
                                    {isCashIn ? <ArrowUpCircle className="w-5 h-5 text-red-400" /> : <ArrowDownCircle className="w-5 h-5 text-emerald-400" />}
                                </div>
                                <div>
                                   <p className="text-sm font-black">{order.customer_phone || (order.order_type === "vendor_bank_transfer" ? "Bank Transfer" : "Vendor")}</p>
                                   <p className="text-[10px] font-bold text-muted-foreground">
                                     {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShareReceipt(order);
                                  }}
                                >
                                  <Share2 className="w-4 h-4" />
                                </Button>
                                <div className="text-right">
                                   <p className={cn("text-sm font-black", isCashIn ? "text-red-400" : "text-emerald-400")}>
                                      {isCashIn ? "-" : "+"}GHS {Number(order.amount).toFixed(2)}
                                   </p>
                                   <Badge className={cn(
                                     "border-none h-4 text-[8px] px-1 font-black",
                                     order.status === "fulfilled" ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
                                   )}>
                                     {order.status.toUpperCase()}
                                   </Badge>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                 </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bank" className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-none bg-card/50 shadow-xl shadow-black/5 overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-primary/5">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-primary" />
                  Bank Disbursement
                </CardTitle>
                <CardDescription>Send funds to any local bank account in Ghana</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Destination Bank</Label>
                    <Select value={bankCode} onValueChange={setBankCode}>
                      <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold">
                        <SelectValue placeholder="Select Bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {GHANA_BANKS.map((bank, idx) => (
                          <SelectItem key={`${bank.code}-${idx}`} value={bank.code}>{bank.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Number</Label>
                    <Input 
                      placeholder="Enter account number" 
                      className="h-12 rounded-xl bg-muted/30 border-none font-bold text-lg"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount (GHS)</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      className="h-12 rounded-xl bg-muted/30 border-none font-bold text-2xl text-primary"
                      value={bankAmount}
                      onChange={(e) => setBankAmount(e.target.value)}
                    />
                  </div>

                  {accountName ? (
                    <div className="p-4 rounded-2xl bg-emerald-400/5 border border-emerald-400/20 flex items-center justify-between animate-in zoom-in-95 duration-300">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">Account Name Verified</p>
                        <p className="text-lg font-black text-emerald-400">{accountName}</p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                  ) : (
                    <Button 
                      variant="outline"
                      className="w-full h-14 rounded-2xl text-lg font-black border-2 border-primary/20 hover:bg-primary/5 active:scale-[0.98] transition-all"
                      disabled={verifying}
                      onClick={handleBankEnquiry}
                    >
                      {verifying ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify Account Details"}
                    </Button>
                  )}

                  <Button 
                    className="w-full h-14 rounded-2xl text-lg font-black shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
                    disabled={loading || !accountName}
                    onClick={handleBankTransferComplete}
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Complete Bank Transfer"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none bg-indigo-400/5 shadow-xl shadow-black/5">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-400/10 flex items-center justify-center shrink-0">
                      <Search className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-black text-indigo-400 uppercase tracking-widest text-[10px]">Verification First</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        Always use the **Verify Account Details** button before completing a transfer. This ensures your funds are sent to the correct recipient. Bank transfers are processed instantly via the GIP network.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none bg-red-400/5 shadow-xl shadow-black/5">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-400/10 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-black text-red-400 uppercase tracking-widest text-[10px]">Security Notice</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        Bank transfers are final and irreversible. Ensure the account name returned by the system matches the person you intend to pay.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                variant="ghost" 
                className="w-full h-14 rounded-2xl text-muted-foreground hover:text-primary gap-2 font-bold"
                onClick={fetchBalance}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Floating Balance
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="africa" className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-none bg-card/50 shadow-xl shadow-black/5 overflow-hidden">
               <CardHeader className="bg-indigo-500/5 border-b border-indigo-500/5">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-500" />
                  Pan-African Payouts
                </CardTitle>
                <CardDescription>Send money to any bank or MoMo across Africa via Paystack</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {savedRecipients.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Quick-Pay Directory</Label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {savedRecipients.filter(r => r.type === "momo").map((r, i) => (
                        <Button 
                          key={i} 
                          variant="outline" 
                          size="sm" 
                          className="rounded-full h-8 px-4 font-bold bg-primary/5 hover:bg-primary/10 border-primary/20 shrink-0"
                          onClick={() => {
                            setMomoPhone(r.phone);
                            setMomoNetwork(r.network);
                          }}
                        >
                          {r.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                 <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Destination Country</Label>
                    <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                      <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AFRICA_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Destination Bank/Provider</Label>
                    <Select value={bankCode} onValueChange={setBankCode}>
                      <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold">
                        <SelectValue placeholder="Select Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {africaBanks.map((bank, idx) => (
                          <SelectItem key={`${bank.code}-${idx}`} value={bank.code}>{bank.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Account Number / Phone</Label>
                    <Input 
                      placeholder="Enter details" 
                      className="h-12 rounded-xl bg-muted/30 border-none font-bold text-lg"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Amount ({AFRICA_COUNTRIES.find(c => c.code === selectedCountry)?.currency})</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      className="h-12 rounded-xl bg-muted/30 border-none font-bold text-2xl text-indigo-500"
                      value={bankAmount}
                      onChange={(e) => setBankAmount(e.target.value)}
                    />
                  </div>

                  {accountName ? (
                    <div className="p-4 rounded-2xl bg-emerald-400/5 border border-emerald-400/20 flex items-center justify-between animate-in zoom-in-95 duration-300">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/70">Verified Recipient</p>
                        <p className="text-lg font-black text-emerald-400">{accountName}</p>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                  ) : (
                    <Button 
                      variant="outline"
                      className="w-full h-14 rounded-2xl text-lg font-black border-2 border-indigo-500/20 hover:bg-indigo-500/5 active:scale-[0.98] transition-all"
                      disabled={verifying || !bankCode || !accountNumber}
                      onClick={handleBankEnquiry}
                    >
                      {verifying ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify Account Name"}
                    </Button>
                  )}

                  <Button 
                    className="w-full h-14 rounded-2xl text-lg font-black bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all"
                    disabled={loading || !accountName}
                    onClick={handleBankTransferComplete}
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : `Send to ${selectedCountry}`}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
               <Card className="border-none bg-indigo-500/5 shadow-xl shadow-black/5 overflow-hidden">
                <div className="bg-indigo-500/10 p-4 border-b border-indigo-500/10">
                   <h4 className="font-black text-indigo-500 uppercase tracking-widest text-[10px] flex items-center gap-2">
                     <Globe className="w-3 h-3" />
                     Live Market Rates (1 GHS)
                   </h4>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y divide-indigo-500/5">
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-sm font-bold flex items-center gap-2">
                         <span className="w-6 h-4 bg-green-600/20 rounded-sm flex items-center justify-center text-[8px] font-bold">NG</span>
                         Nigeria (NGN)
                      </span>
                      <span className="font-black text-indigo-500">₦{exchangeRates.NGN.toFixed(2)}</span>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-sm font-bold flex items-center gap-2">
                         <span className="w-6 h-4 bg-red-600/20 rounded-sm flex items-center justify-center text-[8px] font-bold">KE</span>
                         Kenya (KES)
                      </span>
                      <span className="font-black text-indigo-500">KSh{exchangeRates.KES.toFixed(2)}</span>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-sm font-bold flex items-center gap-2">
                         <span className="w-6 h-4 bg-blue-600/20 rounded-sm flex items-center justify-center text-[8px] font-bold">ZA</span>
                         South Africa (ZAR)
                      </span>
                      <span className="font-black text-indigo-500">R{exchangeRates.ZAR.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

               <Card className="border-none bg-indigo-500/5 shadow-xl shadow-black/5">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6 text-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-black text-indigo-500 uppercase tracking-widest text-[10px]">Currency Exchange</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        Paystack handles the currency conversion automatically. Your GHS balance will be deducted based on the real-time exchange rate plus a small processing fee.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

               <Card className="border-none bg-amber-400/5 shadow-xl shadow-black/5">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-400/10 flex items-center justify-center shrink-0">
                      <Info className="w-6 h-6 text-amber-400" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-black text-amber-400 uppercase tracking-widest text-[10px]">Processing Times</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        Transfers to Nigeria and Kenya are typically instant. South African bank transfers may take up to 24 hours depending on the receiving bank.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="insights" className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="border-none bg-card/50 shadow-xl shadow-black/5 lg:col-span-2">
               <CardHeader className="bg-primary/5 border-b border-primary/5">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Daily Reconciliation Report
                </CardTitle>
                <CardDescription>Summary of physical cash vs digital float movements</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Cash Inflow (From Customers)</h4>
                      <div className="flex items-center justify-between p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                        <span className="font-bold text-sm">MoMo Cash-Outs</span>
                        <span className="font-black text-emerald-500">GHS {todayStats.cashOut.toFixed(2)}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Cash Outflow (To Customers)</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                          <span className="font-bold text-sm">MoMo Cash-Ins</span>
                          <span className="font-black text-red-500">GHS {todayStats.cashIn.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                          <span className="font-bold text-sm">Bank Transfers</span>
                          <span className="font-black text-red-500">GHS {todayStats.bankTransfers.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                      <Wallet className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Expected Physical Cash</h3>
                      <p className="text-4xl font-black text-primary">GHS {(todayStats.cashOut - (todayStats.cashIn + todayStats.bankTransfers)).toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground mt-2 px-4 leading-relaxed">
                        This is the net physical cash you should have collected from customers today.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
               <Card className="border-none bg-emerald-500/5 shadow-xl shadow-black/5">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-black text-emerald-500 uppercase tracking-widest text-[10px]">Total Revenue</h4>
                      <p className="text-2xl font-black">GHS {todayStats.profit.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground font-medium">Earned from {todayStats.count} transactions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full h-14 rounded-2xl font-black gap-2" variant="outline" onClick={() => window.print()}>
                 Print Daily Summary
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </SecurityGateway>
  );
};

export default DashboardSwiftVendor;
