import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { invokePublicFunction, invokePublicFunctionAsUser } from "@/lib/public-function-client";
import { getFunctionErrorMessage } from "@/lib/function-errors";
import { fetchApiPricingContext, applyPriceMultiplier } from "@/lib/api-source-pricing";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Loader2, CreditCard, X, RefreshCw, ArrowRight } from "lucide-react";
import { basePackages, getPublicPrice } from "@/lib/data";
import { getNetworkCardColors } from "@/lib/utils";
import OrderStatusBanner from "@/components/OrderStatusBanner";

type NetworkName = "MTN" | "Telecel" | "AirtelTigo";
type PayMethod = "wallet" | "paystack";

const NETWORKS: NetworkName[] = ["MTN", "Telecel", "AirtelTigo"];

const networkRouteMap: Record<NetworkName, string> = {
  MTN: "mtn",
  Telecel: "telecel",
  AirtelTigo: "airteltigo",
};

const networkTabStyles: Record<NetworkName, { active: string; idle: string }> = {
  MTN: { active: "bg-amber-400 text-black border-amber-400", idle: "border-border hover:border-amber-400/50" },
  Telecel: { active: "bg-red-600 text-white border-red-600", idle: "border-border hover:border-red-400/50" },
  AirtelTigo: { active: "bg-blue-600 text-white border-blue-600", idle: "border-border hover:border-blue-400/50" },
};

const PAYSTACK_FEE_RATE = 0.03;
const PAYSTACK_FEE_CAP = 100;
const calcPaystackFee = (amount: number) => Math.min(amount * PAYSTACK_FEE_RATE, PAYSTACK_FEE_CAP);

interface GlobalPackageSetting {
  network: string;
  package_size: string;
  public_price: number | null;
  agent_price: number | null;
  is_unavailable: boolean;
}

const normalizePackageSize = (size: string) => size.replace(/\s+/g, "").toUpperCase();

const getAssignedSubAgentPrice = (
  assignedMap: Record<string, Record<string, string | number>> | undefined,
  network: string,
  size: string,
): number | null => {
  if (!assignedMap || typeof assignedMap !== "object") return null;
  const networkCandidates = [network, network.replace(/\s+/g, ""), network === "AT iShare" ? "AirtelTigo" : network];
  const sizeCandidates = [size, size.replace(/\s+/g, ""), size.toUpperCase()];
  for (const n of networkCandidates) {
    const byNetwork = assignedMap[n];
    if (!byNetwork) continue;
    for (const s of sizeCandidates) {
      const value = Number(byNetwork[s]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
};

interface DashboardBuyDataNetworkProps {
  network: NetworkName;
}

const DashboardBuyDataNetwork = ({ network }: DashboardBuyDataNetworkProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState("");
  const [phone, setPhone] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("wallet");
  const [buying, setBuying] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<GlobalPackageSetting[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [parentAssignedPrices, setParentAssignedPrices] = useState<Record<string, Record<string, string | number>>>({});
  const [priceMultiplier, setPriceMultiplier] = useState(1);
  const [lastOrder, setLastOrder] = useState<{
    id: string; network: string; packageSize: string; phone: string; status: string;
  } | null>(null);

  const isPaidAgent = Boolean(profile?.agent_approved || profile?.sub_agent_approved);

  useEffect(() => {
    const loadPricing = async () => {
      const [settingsRes, pricingContext] = await Promise.all([
        supabase.from("global_package_settings").select("network, package_size, public_price, agent_price, is_unavailable"),
        fetchApiPricingContext(),
      ]);
      setGlobalSettings((settingsRes.data || []) as GlobalPackageSetting[]);
      setPriceMultiplier(pricingContext.multiplier);
      setSettingsLoading(false);

      if (profile?.is_sub_agent && profile?.parent_agent_id) {
        const { data: parentProfile } = await supabase
          .from("profiles")
          .select("sub_agent_prices")
          .eq("user_id", profile.parent_agent_id)
          .maybeSingle();
        setParentAssignedPrices((parentProfile?.sub_agent_prices || {}) as Record<string, Record<string, string | number>>);
      }
    };
    void loadPricing();
  }, [profile?.is_sub_agent, profile?.parent_agent_id]);

  const packages = useMemo(() => {
    return (basePackages[network] || [])
      .map((item) => {
        const setting = globalSettings.find(
          (s) => s.network === network && normalizePackageSize(s.package_size) === normalizePackageSize(item.size),
        );
        const assignedFromParent = getAssignedSubAgentPrice(parentAssignedPrices, network, item.size);
        const assignedFromProfile = getAssignedSubAgentPrice(
          profile?.agent_prices as Record<string, Record<string, string | number>> | undefined,
          network,
          item.size,
        );
        const assignedPrice = assignedFromParent || assignedFromProfile;
        const basePublic = Number(setting?.public_price);
        const baseAgent = Number(setting?.agent_price);

        const resolvedBasePrice = (() => {
          if (assignedPrice && assignedPrice > 0) return assignedPrice;
          if (isPaidAgent) {
            if (Number.isFinite(baseAgent) && baseAgent > 0) return baseAgent;
            return item.price;
          }
          if (Number.isFinite(basePublic) && basePublic > 0) return basePublic;
          return getPublicPrice(item.price);
        })();

        return {
          ...item,
          isUnavailable: Boolean(setting?.is_unavailable),
          price: applyPriceMultiplier(resolvedBasePrice, priceMultiplier),
        };
      })
      .filter((item) => !item.isUnavailable);
  }, [globalSettings, isPaidAgent, network, parentAssignedPrices, priceMultiplier, profile]);

  const refreshBalance = async () => {
    if (!user) return;
    const { data } = await supabase.from("wallets").select("balance").eq("agent_id", user.id).maybeSingle();
    setWalletBalance(Number(data?.balance || 0));
  };

  useEffect(() => { void refreshBalance(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear selection when network changes (via prop)
  useEffect(() => { setSelectedSize(""); setPhone(""); setPayMethod("wallet"); }, [network]);

  const selectedPackage = packages.find((item) => item.size === selectedSize);
  const cardColors = getNetworkCardColors(network);

  const normalizedPhone = phone.replace(/\D+/g, "");
  const isPhoneValid = normalizedPhone.length === 10 || normalizedPhone.length === 12 || normalizedPhone.length === 9;

  const paystackFee = selectedPackage ? calcPaystackFee(selectedPackage.price) : 0;
  const paystackTotal = selectedPackage ? parseFloat((selectedPackage.price + paystackFee).toFixed(2)) : 0;

  const validate = (): boolean => {
    if (!selectedPackage) {
      toast({ title: "Select a package first", variant: "destructive" });
      return false;
    }
    if (!phone.trim() || !isPhoneValid) {
      toast({ title: "Invalid phone number", description: "Use a valid Ghana number.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleWalletBuy = async () => {
    if (!validate()) return;
    setBuying(true);

    const { data, error } = await invokePublicFunctionAsUser("wallet-buy-data", {
      body: {
        network,
        package_size: selectedPackage!.size,
        customer_phone: phone,
        amount: selectedPackage!.price,
      },
    });

    if (error || data?.error) {
      const description = data?.error || await getFunctionErrorMessage(error, "Could not complete purchase.");
      toast({ title: "Purchase failed", description, variant: "destructive" });
      setBuying(false);
      return;
    }

    if (typeof data?.order_id === "string" && data.order_id) {
      setLastOrder({ id: data.order_id, network, packageSize: selectedPackage!.size, phone, status: data?.status || "paid" });
    } else {
      toast({
        title: "Order placed",
        description: data?.status === "fulfilled" ? "Data delivered successfully." : "Your order is being processed.",
      });
    }

    setPhone("");
    setSelectedSize("");
    await refreshBalance();
    setBuying(false);
  };

  const handlePaystackBuy = async () => {
    if (!validate()) return;
    setBuying(true);

    const orderId = crypto.randomUUID();
    const callbackParams = new URLSearchParams({
      reference: orderId,
      network,
      package: selectedPackage!.size,
      phone: normalizedPhone,
    });

    const { data, error } = await invokePublicFunction("initialize-payment", {
      body: {
        email: user?.email || `${normalizedPhone}@customer.swiftdata.gh`,
        amount: paystackTotal,
        reference: orderId,
        callback_url: `${getAppBaseUrl()}/order-status?${callbackParams.toString()}`,
        metadata: {
          order_id: orderId,
          order_type: "data",
          network,
          package_size: selectedPackage!.size,
          customer_phone: normalizedPhone,
          fee: paystackFee,
          agent_id: user?.id,
        },
      },
    });

    if (error || !data?.authorization_url) {
      const description = data?.error || await getFunctionErrorMessage(error, "Could not initialize payment.");
      toast({ title: "Payment failed", description, variant: "destructive" });
      setBuying(false);
      return;
    }

    window.location.href = data.authorization_url;
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Buy Data</h1>
          <p className="text-sm text-muted-foreground">
            {isPaidAgent ? "Agent prices applied." : "Sign up as an agent for cheaper rates."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshBalance}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            title="Refresh balance"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Wallet className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">
              {walletBalance !== null ? `GH₵ ${walletBalance.toFixed(2)}` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Order status banner */}
      {lastOrder && (
        <OrderStatusBanner
          orderId={lastOrder.id}
          network={lastOrder.network}
          packageSize={lastOrder.packageSize}
          customerPhone={lastOrder.phone}
          initialStatus={lastOrder.status}
          onDismiss={() => setLastOrder(null)}
        />
      )}

      {/* Agent upsell */}
      {!isPaidAgent && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 text-sm">
            Activate your agent access for <span className="font-bold">GHS 80</span> to unlock cheaper prices &amp; your own store.
          </div>
          <Button size="sm" onClick={() => navigate("/agent-program")} className="shrink-0 gap-1.5">
            Become an Agent <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Network tabs */}
      <div className="flex gap-2 sm:gap-3">
        {NETWORKS.map((n) => (
          <button
            key={n}
            onClick={() => navigate(`/dashboard/buy-data/${networkRouteMap[n]}`)}
            className={`flex-1 py-2.5 sm:py-3 rounded-xl border-2 text-sm font-bold transition-all ${
              n === network ? networkTabStyles[n].active : networkTabStyles[n].idle
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Package grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{network} Bundles</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {settingsLoading
            ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-2xl" />)
            : packages.map((item) => {
                const isSelected = selectedSize === item.size;
                return (
                  <button
                    key={item.size}
                    type="button"
                    onClick={() => {
                      setSelectedSize(isSelected ? "" : item.size);
                      setPayMethod("wallet");
                    }}
                    className={`${cardColors.card} rounded-2xl p-3.5 sm:p-4 flex flex-col gap-2 border-2 text-left transition-all duration-200 relative ${
                      isSelected
                        ? "border-white/80 shadow-xl scale-[1.03]"
                        : "border-transparent hover:border-white/25 hover:scale-[1.01]"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                        <span className="w-2.5 h-2.5 rounded-full bg-black" />
                      </span>
                    )}
                    <span className={`${cardColors.label} text-[11px] font-bold uppercase tracking-wide`}>{network}</span>
                    <span className={`${cardColors.size} text-2xl sm:text-3xl font-black leading-none`}>{item.size}</span>
                    <div className="flex items-end justify-between mt-auto pt-0.5">
                      <span className={`${cardColors.size} text-sm font-black`}>₵{item.price.toFixed(2)}</span>
                      <span className={`${cardColors.label} text-[10px]`}>No Expiry</span>
                    </div>
                  </button>
                );
              })}
        </div>
      </div>

      {/* ── Inline Purchase Panel ── */}
      {selectedPackage && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-sm">{network} {selectedPackage.size}</span>
              <span className="text-muted-foreground text-xs">— GH₵ {selectedPackage.price.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setSelectedSize("")}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Phone input */}
            <div>
              <Label htmlFor="dash-phone" className="text-sm">Recipient Phone Number</Label>
              <Input
                id="dash-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5"
                placeholder="0241234567"
                maxLength={12}
              />
              {phone.length > 0 && !isPhoneValid && (
                <p className="text-xs text-destructive mt-1">Enter a valid 10-digit Ghana number</p>
              )}
            </div>

            {/* Payment method */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPayMethod("wallet")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    payMethod === "wallet"
                      ? "border-primary bg-primary/8"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Wallet className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold">Wallet</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    Balance: GH₵ {(walletBalance || 0).toFixed(2)}
                  </p>
                </button>

                <button
                  onClick={() => setPayMethod("paystack")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    payMethod === "paystack"
                      ? "border-primary bg-primary/8"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <CreditCard className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold">Card / MoMo</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">
                    +3% Paystack fee
                  </p>
                </button>
              </div>
            </div>

            {/* Price breakdown for Paystack */}
            {payMethod === "paystack" && (
              <div className="rounded-xl bg-secondary/60 border border-border divide-y divide-border text-sm overflow-hidden">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Bundle price</span>
                  <span className="font-medium">GH₵ {selectedPackage.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Paystack fee (3%)</span>
                  <span className="font-medium">GH₵ {paystackFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 bg-secondary/60 font-bold">
                  <span>Total to pay</span>
                  <span>GH₵ {paystackTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Wallet insufficient warning */}
            {payMethod === "wallet" && walletBalance !== null && walletBalance < selectedPackage.price && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 shrink-0" />
                Insufficient wallet balance. Top up or pay with card instead.
                <button
                  onClick={() => navigate("/dashboard/wallet")}
                  className="ml-auto font-semibold underline underline-offset-2 shrink-0"
                >
                  Top Up
                </button>
              </div>
            )}

            {/* Action button */}
            <Button
              className="w-full gap-2 font-bold text-sm py-5"
              onClick={payMethod === "wallet" ? handleWalletBuy : handlePaystackBuy}
              disabled={buying || !selectedPackage}
            >
              {buying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : payMethod === "wallet" ? (
                <><Wallet className="w-4 h-4" /> Buy from Wallet — GH₵ {selectedPackage.price.toFixed(2)}</>
              ) : (
                <><CreditCard className="w-4 h-4" /> Pay GH₵ {paystackTotal.toFixed(2)} with Card</>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardBuyDataNetwork;
