import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ShieldCheck, Zap, Loader2, AlertTriangle, X, CreditCard, Gift, Tag, CheckCircle2 } from "lucide-react";
import { basePackages, getPublicPrice } from "@/lib/data";
import { getNetworkCardColors } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getFunctionErrorMessage } from "@/lib/function-errors";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { fetchApiPricingContext, applyPriceMultiplier } from "@/lib/api-source-pricing";
import { invokePublicFunction } from "@/lib/public-function-client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppTheme } from "@/contexts/ThemeContext";
import SEO from "@/components/SEO";

const NETWORK_GLASS_ACTIVE: Record<string, Record<string, string>> = {
  MTN: {
    background: "linear-gradient(135deg, rgba(251,191,36,0.92) 0%, rgba(245,158,11,0.88) 100%)",
    boxShadow: "0 4px 18px rgba(251,191,36,0.38), inset 0 1px 0 rgba(255,255,255,0.35)",
    color: "#000",
  },
  Telecel: {
    background: "linear-gradient(135deg, rgba(220,38,38,0.9) 0%, rgba(185,28,28,0.86) 100%)",
    boxShadow: "0 4px 18px rgba(220,38,38,0.32), inset 0 1px 0 rgba(255,255,255,0.18)",
    color: "#fff",
  },
  AirtelTigo: {
    background: "linear-gradient(135deg, rgba(37,99,235,0.9) 0%, rgba(29,78,216,0.86) 100%)",
    boxShadow: "0 4px 18px rgba(37,99,235,0.32), inset 0 1px 0 rgba(255,255,255,0.18)",
    color: "#fff",
  },
};

interface PromoResult {
  valid: boolean;
  promo_id?: string;
  code?: string;
  discount_percentage?: number;
  is_free?: boolean;
  error?: string;
}

type NetworkName = "MTN" | "Telecel" | "AirtelTigo";
const NETWORKS: NetworkName[] = ["MTN", "Telecel", "AirtelTigo"];
const PAYSTACK_FEE_RATE = 0.03;
const PAYSTACK_FEE_CAP = 100;
const calcFee = (amount: number) => Math.min(amount * PAYSTACK_FEE_RATE, PAYSTACK_FEE_CAP);

interface GlobalPkgSetting {
  network: string;
  package_size: string;
  public_price: number | null;
  is_unavailable: boolean;
}

const networkTabStyles: Record<NetworkName, { active: string; idle: string }> = {
  MTN: { active: "bg-amber-400 text-black border-amber-400", idle: "border-border hover:border-amber-400/50" },
  Telecel: { active: "bg-red-600 text-white border-red-600", idle: "border-border hover:border-red-400/50" },
  AirtelTigo: { active: "bg-blue-600 text-white border-blue-600", idle: "border-border hover:border-blue-400/50" },
};

const BuyData = () => {
  const { toast } = useToast();
  const { theme, isDark } = useAppTheme();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkName>("MTN");
  const [selectedPkg, setSelectedPkg] = useState<{ size: string; price: number } | null>(null);
  const [phone, setPhone] = useState("");
  const [buying, setBuying] = useState(false);
  const [email, setEmail] = useState("");
  const [globalSettings, setGlobalSettings] = useState<Record<string, GlobalPkgSetting>>({});
  const [pkgLoading, setPkgLoading] = useState(true);
  const [holidayMode, setHolidayMode] = useState(false);
  const [holidayMessage, setHolidayMessage] = useState("");
  const [orderingDisabled, setOrderingDisabled] = useState(false);
  const [priceMultipliers, setPriceMultipliers] = useState<Record<string, number>>({ MTN: 1, Telecel: 1, AirtelTigo: 1 });
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const promoInputRef = useRef<HTMLInputElement>(null);

  // Promo code state
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolvingName, setResolvingName] = useState(false);

  const phoneDigits = phone.replace(/\D+/g, "");
  const isPhoneValid = phoneDigits.length === 10 || phoneDigits.length === 12 || phoneDigits.length === 9;

  useEffect(() => {
    const load = async () => {
      setPkgLoading(true);
      const [{ data }, { data: sys }, pricingCtx] = await Promise.all([
        supabase.from("global_package_settings").select("network, package_size, public_price, is_unavailable"),
        supabase.functions.invoke("system-settings", { body: { action: "get" } }),
        fetchApiPricingContext(),
      ]);
      const map: Record<string, GlobalPkgSetting> = {};
      (data || []).forEach((r: any) => { map[`${r.network}-${r.package_size}`] = r; });
      setGlobalSettings(map);
      if (sys) {
        setHolidayMode(Boolean(sys.holiday_mode_enabled));
        setHolidayMessage(String(sys.holiday_message || "Holiday mode active. Orders will resume soon."));
        setOrderingDisabled(Boolean(sys.disable_ordering));
      }
      setPriceMultipliers(pricingCtx.multipliers);
      setPkgLoading(false);
    };
    load();
  }, []);

  useEffect(() => { 
    setSelectedPkg(null); 
    setPhone(""); 
    setEmail(""); 
    setResolvedName(null);
  }, [selectedNetwork]);

  useEffect(() => {
    setResolvedName(null);
  }, [phone]);

  // Auto-focus phone input on modal open for blazing fast speeds
  useEffect(() => {
    if (selectedPkg) {
      setTimeout(() => phoneInputRef.current?.focus(), 100);
    }
  }, [selectedPkg]);

  // Auto-resolve recipient name
  useEffect(() => {
    if (!isPhoneValid || resolvedName || resolvingName) return;

    const timer = setTimeout(async () => {
      setResolvingName(true);
      try {
        let bankCode = "MTN";
        const net = selectedNetwork.toUpperCase();
        if (net.includes("VODA") || net.includes("TELECEL")) bankCode = "VOD";
        if (net.includes("AIRTEL") || net.includes("TIGO") || net.includes("AT")) bankCode = "ATL";

        const { data, error } = await supabase.functions.invoke("paystack-resolve", {
          body: { account_number: phoneDigits, bank_code: bankCode }
        });
        if (!error && data?.success) {
          setResolvedName(data.account_name);
        }
      } catch (e) {
        console.error("Auto-resolution failed:", e);
      } finally {
        setResolvingName(false);
      }
    }, 300); // 300ms debounce for faster response

    return () => clearTimeout(timer);
  }, [phone, selectedNetwork, isPhoneValid, resolvedName, resolvingName, phoneDigits]);

  const packages = (basePackages[selectedNetwork] || [])
    .map((pkg) => {
      const gs = globalSettings[`${selectedNetwork}-${pkg.size}`];
      if (gs?.is_unavailable) return null;
      const base = gs?.public_price ?? getPublicPrice(pkg.price);
      const multiplier = priceMultipliers[selectedNetwork] || 1;
      return { ...pkg, price: applyPriceMultiplier(base, multiplier) };
    })
    .filter(Boolean) as { size: string; price: number; validity: string; popular?: boolean }[];

  // Apply promo discount to price
  const validPromo = promoResult?.valid ? promoResult : null;
  const discountPct = validPromo?.discount_percentage ?? 0;
  const isFreePromo = validPromo?.is_free === true;
  const discountedPkgPrice = selectedPkg
    ? isFreePromo ? 0 : parseFloat((selectedPkg.price * (1 - discountPct / 100)).toFixed(2))
    : 0;
  const fee = isFreePromo ? 0 : (selectedPkg ? calcFee(discountedPkgPrice) : 0);
  const total = selectedPkg ? parseFloat((discountedPkgPrice + fee).toFixed(2)) : 0;

  const handleCardClick = useCallback((size: string, price: number) => {
    setSelectedPkg((prev) => (prev?.size === size ? null : { size, price }));
    setPromoResult(null); setPromoCode(""); setPromoOpen(false);
    setTimeout(() => phoneInputRef.current?.focus(), 120);
  }, []);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    if (!isPhoneValid) {
      toast({ title: "Enter your phone number first", description: "We need it to check if you've already used this code.", variant: "destructive" });
      phoneInputRef.current?.focus();
      return;
    }
    setPromoValidating(true);
    setPromoResult(null);
    const { data, error } = await invokePublicFunction("validate-promo", {
      body: { code: promoCode.trim(), phone: phoneDigits },
    });
    setPromoValidating(false);
    if (error || !data) {
      setPromoResult({ valid: false, error: "Could not validate code. Try again." });
      return;
    }
    setPromoResult(data as PromoResult);
    if (data.valid && data.is_free) {
      toast({ title: "Free data code applied!", description: `${promoCode.trim().toUpperCase()} — your bundle is FREE. Tap Claim!` });
    } else if (data.valid) {
      toast({ title: `${data.discount_percentage}% discount applied!`, description: `Code: ${promoCode.trim().toUpperCase()}` });
    }
  };

  const handleClaimFree = async () => {
    if (!selectedPkg || !validPromo?.is_free) return;
    if (!isPhoneValid) {
      toast({ title: "Enter a valid phone number first", variant: "destructive" });
      phoneInputRef.current?.focus();
      return;
    }
    if (orderingDisabled) {
      toast({ title: "Ordering disabled", description: holidayMessage, variant: "destructive" });
      return;
    }
    setClaiming(true);
    const { data, error } = await invokePublicFunction("claim-free-data", {
      body: {
        promo_code: promoCode.trim(),
        phone: phoneDigits,
        network: selectedNetwork,
        package_size: selectedPkg.size,
      },
    });
    setClaiming(false);
    if (error || !data) {
      toast({ title: "Claim failed", description: "Could not process your free data claim. Try again.", variant: "destructive" });
      return;
    }
    if (data.success) {
      toast({ title: "Free data sent!", description: `Your ${selectedPkg.size} ${selectedNetwork} bundle is on its way!` });
      setSelectedPkg(null); setPhone(""); setPromoCode(""); setPromoResult(null); setPromoOpen(false);
    } else {
      toast({ title: "Claim failed", description: data.error || "Delivery failed. Contact support with ref: " + (data.order_id || "unknown"), variant: "destructive" });
      setPromoResult(null); setPromoCode(""); // reset so they can try another code
    }
  };

  const handlePay = async () => {
    if (!selectedPkg) return;
    if (!isPhoneValid) {
      toast({ title: "Enter a valid phone number first", variant: "destructive" });
      phoneInputRef.current?.focus();
      return;
    }
    if (orderingDisabled) {
      toast({ title: "Ordering disabled", description: holidayMessage, variant: "destructive" });
      return;
    }
    setBuying(true);
    const orderId = crypto.randomUUID();
    const callbackParams = new URLSearchParams({
      reference: orderId,
      network: selectedNetwork,
      package: selectedPkg.size,
      phone: phoneDigits,
    });

    const { data: paymentData, error: paymentError } = await invokePublicFunction("initialize-payment", {
      body: {
        email: email.trim() || `${phoneDigits}@swiftdata-anon.gh`,
        amount: total,
        reference: orderId,
        callback_url: `${getAppBaseUrl()}/order-status?${callbackParams.toString()}`,
        metadata: {
          order_id: orderId,
          order_type: "data",
          network: selectedNetwork,
          package_size: selectedPkg.size,
          customer_phone: phoneDigits,
          customer_name: resolvedName,
          fee,
          payment_source: "direct",
          ...(validPromo && !validPromo.is_free ? {
            promo_code: promoCode.trim(),
            promo_id: validPromo.promo_id,
            discount_percentage: validPromo.discount_percentage,
          } : {}),
        },
      },
    });

    if (paymentError || !paymentData?.authorization_url) {
      const description = paymentData?.error || await getFunctionErrorMessage(paymentError, "Could not initialize payment.");
      toast({ title: "Payment failed", description, variant: "destructive" });
      setBuying(false);
      return;
    }
    window.location.href = paymentData.authorization_url;
  };

  const colors = getNetworkCardColors(selectedNetwork);

  return (
    <div className={`min-h-screen pt-20 transition-all duration-300 ${selectedPkg ? "pb-44" : "pb-24 sm:pb-20"}`}>
      <SEO 
        title="Buy Cheap Data Bundles — MTN, Telecel & AirtelTigo"
        description="Select your network and buy cheap non-expiry data bundles in Ghana. We support MTN, Telecel and AirtelTigo with instant delivery."
        keywords="buy MTN data Ghana, buy Telecel data, buy AirtelTigo data, cheap data bundles, non-expiry data"
        canonical="https://swiftdatagh.shop/buy-data"

      />
      {/* Hero header */}
      <div className="text-white py-10 px-4 mb-6" style={{ background: theme.heroHex }}>
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">No Account Needed</span>
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-black mb-2">Buy Data Bundles</h1>
          <p className="text-white/60 text-sm md:text-base max-w-lg">
            Pick a network, tap a bundle &amp; pay instantly with card or mobile money.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-xs text-white/45">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-400" /> Secured by Paystack</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Instant delivery</span>
            <span className="flex items-center gap-1.5">📦 Non-expiry bundles</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4">
        {/* Warning bar */}
        <div
          className="mb-5 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs font-medium"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "rgb(252,165,165)" }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Delivery times vary &bull; No refunds for wrong numbers &bull;{" "}
          <Link to="/order-status" className="underline underline-offset-2">Track order</Link>
        </div>

        {holidayMode && (
          <div className="mb-5 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-300">
            {holidayMessage}
          </div>
        )}

        {/* ── Glassmorphic network tab bar ── */}
        <div
          className="flex gap-1.5 p-1.5 mb-5 sm:mb-6 rounded-2xl"
          style={{
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
            backdropFilter: "blur(14px) saturate(1.5)",
            WebkitBackdropFilter: "blur(14px) saturate(1.5)",
            border: isDark
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(0,0,0,0.07)",
            boxShadow: isDark
              ? "0 2px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)"
              : "0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
          }}
        >
          {NETWORKS.map((n) => {
            const active = selectedNetwork === n;
            return (
              <button
                key={n}
                onClick={() => setSelectedNetwork(n)}
                className="flex-1 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all duration-200 relative overflow-hidden"
                style={
                  active
                    ? NETWORK_GLASS_ACTIVE[n]
                    : {
                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                        background: "transparent",
                      }
                }
              >
                {/* Hover shimmer (idle only) */}
                {!active && (
                  <span
                    className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-150"
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                    }}
                    aria-hidden
                  />
                )}
                <span className="relative z-10">{n}</span>
              </button>
            );
          })}
        </div>

        {/* Package grid */}
        {pkgLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[140px] rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {packages.map((pkg) => {
              const isSelected = selectedPkg?.size === pkg.size;
              return (
                <button
                  key={pkg.size}
                  onClick={() => handleCardClick(pkg.size, pkg.price)}
                  className={`${colors.card} rounded-2xl p-4 sm:p-5 flex flex-col gap-2.5 border-2 text-left transition-all duration-200 relative ${
                    isSelected
                      ? "border-white/80 shadow-2xl scale-[1.04]"
                      : "border-transparent hover:border-white/30 hover:scale-[1.02]"
                  }`}
                >
                  {/* Selected indicator */}
                  {isSelected && (
                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                      <span className="w-2.5 h-2.5 rounded-full bg-black" />
                    </span>
                  )}
                  {pkg.popular && !isSelected && (
                    <span className="absolute top-2 right-2 text-[9px] font-black bg-black/25 text-white px-1.5 py-0.5 rounded">
                      HOT
                    </span>
                  )}
                  <span className={`${colors.label} text-[11px] font-bold uppercase tracking-wide`}>{selectedNetwork}</span>
                  <p className={`${colors.size} text-3xl sm:text-4xl font-black leading-none`}>{pkg.size}</p>
                  <div className="flex items-end justify-between mt-auto pt-1">
                    <p className={`${colors.size} text-sm sm:text-base font-black`}>₵{pkg.price.toFixed(2)}</p>
                    <p className={`${colors.label} text-[10px] font-medium`}>No Expiry</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer promo */}
        <div className="mt-10 rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold text-sm mb-0.5">Want agent prices?</p>
            <p className="text-muted-foreground text-xs">Agents unlock wholesale rates + their own Paystack-powered store.</p>
          </div>
          <Link
            to="/login"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Sign in or create account
          </Link>
        </div>
      </div>

      {/* ── Pro Level Transaction Modal ── */}
      <AnimatePresence>
        {selectedPkg && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* High Definition Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedPkg(null); setPhone(""); setEmail(""); setPromoCode(""); setPromoResult(null); setPromoOpen(false); }}
              className="absolute inset-0 bg-[#030407]/90 backdrop-blur-[6px] cursor-pointer"
            />
            
            {/* Premium Modal Enclosure */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 20 }}
              transition={{ 
                type: "spring", 
                damping: 25, 
                stiffness: 300,
                mass: 0.8 
              }}
              className="relative w-full max-w-[400px] bg-[#0b0d13] border border-white/[0.06] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8)] rounded-[2.5rem] overflow-hidden flex flex-col my-auto select-none"
            >
              {/* Dynamic Header Section */}
              <div className="relative w-full pt-10 pb-8 text-center rounded-b-[3rem] overflow-hidden z-10">
                {/* Thematic Ambient Glow Vector */}
                <div 
                  className="absolute inset-0 opacity-40 blur-2xl"
                  style={{ 
                    background: `radial-gradient(circle at 50% 20%, hsl(${theme.primary}), transparent 70%)`
                  }} 
                />
                
                {/* Absolute Background Shell */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent z-0" />

                {/* Close Vector */}
                <button 
                  onClick={() => { setSelectedPkg(null); setPhone(""); setEmail(""); setPromoCode(""); setPromoResult(null); setPromoOpen(false); }}
                  className="absolute top-4 right-4 z-30 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-white/40 hover:text-white transition-all active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Content Group */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="relative z-20 flex flex-col items-center px-6"
                >
                  {/* Network Indicator Pill */}
                  <div 
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] shadow-[0_4px_12px_rgba(0,0,0,0.2)] border border-white/10 mb-4"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: `hsl(${theme.primary})`,
                      backdropFilter: "blur(10px)"
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: `hsl(${theme.primary})` }} />
                    {selectedNetwork} Network
                  </div>

                  {/* Magnitude Display */}
                  <h3 className="text-4xl sm:text-5xl font-black tracking-tighter text-white mb-2 drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
                    {selectedPkg.size}
                  </h3>

                  {/* Pricing Metrics */}
                  {isFreePromo ? (
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500 text-black text-xs font-black uppercase tracking-wider shadow-lg shadow-green-500/30 animate-bounce-subtle">
                      <Gift className="w-3.5 h-3.5" /> Free Reward
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-white/70 text-sm font-bold bg-white/5 border border-white/5 rounded-full px-4 py-1 backdrop-blur-sm">
                      {validPromo ? (
                        <>
                          <span className="opacity-40 line-through font-medium">GH₵{selectedPkg.price.toFixed(2)}</span> 
                          <span style={{ color: `hsl(${theme.primary})` }} className="font-black">GH₵{discountedPkgPrice.toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="font-black">GH₵{selectedPkg.price.toFixed(2)}</span>
                      )}
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="text-[11px] opacity-60 font-medium">+GH₵{fee.toFixed(2)} fee</span>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Interactive Surface */}
              <div className="p-6 pb-8 space-y-6 bg-[#0b0d13] relative z-20">
                
                {/* Sequential Entrance Group */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-4"
                >
                  {/* Field Header */}
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                      Direct Delivery To
                    </label>
                  </div>

                  {/* High Fidelity Input Nest */}
                  <div className="relative group">
                    <input
                      ref={phoneInputRef}
                      type="tel" inputMode="numeric"
                      placeholder="Enter Phone (0XX XXXXXXX)"
                      value={phone} onChange={(e) => setPhone(e.target.value)}
                      maxLength={12}
                      className="w-full h-[60px] bg-white/[0.02] border border-white/[0.08] rounded-2xl pl-5 pr-14 text-white placeholder-white/15 text-xl font-bold tracking-wide focus:outline-none focus:border-white/20 focus:bg-white/[0.04] focus:shadow-[0_0_0_4px_rgba(255,255,255,0.02)] transition-all duration-300 selection:bg-primary/30"
                      style={resolvedName ? { 
                        borderColor: "rgba(52, 211, 153, 0.4)",
                        background: "rgba(16, 185, 129, 0.04)",
                        boxShadow: "0 0 20px -5px rgba(16, 185, 129, 0.15)"
                      } : undefined}
                    />
                    
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8">
                      <AnimatePresence mode="wait">
                        {resolvingName ? (
                          <motion.div key="loading" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                            <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                          </motion.div>
                        ) : resolvedName ? (
                          <motion.div key="done" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1, rotate: [0, -10, 10, 0] }} transition={{ type: "spring" }}>
                            <div className="bg-emerald-500 rounded-full p-1 shadow-lg shadow-emerald-500/30">
                              <CheckCircle2 className="w-4 h-4 text-black" />
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <ShieldCheck className="w-5 h-5 text-white/10 group-hover:text-white/20 transition-colors" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Reactive Identity Banner */}
                  <AnimatePresence>
                    {resolvedName && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 shadow-sm">
                          <div className="shrink-0 w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                            {resolvedName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/60 leading-none mb-1">Verified Owner</p>
                            <p className="text-xs font-black text-emerald-300 uppercase truncate leading-tight">
                              {resolvedName}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {phone.length > 0 && !isPhoneValid && (
                      <motion.p 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="text-xs text-red-400/90 font-bold px-2 flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Must be a valid network number
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Tertiary Settings Nest */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-3"
                >
                  {/* Animated Email Collapse */}
                  <AnimatePresence>
                    {isPhoneValid && !isFreePromo && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2 overflow-hidden border-t border-white/[0.04] pt-3"
                      >
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-1 block">
                          Email Receipt <span className="text-white/15 normal-case font-medium">(Optional)</span>
                        </label>
                        <input
                          type="email" inputMode="email"
                          placeholder="Drop your email for safe storage"
                          value={email} onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          className="w-full h-[44px] bg-white/[0.01] border border-white/[0.06] rounded-xl px-4 text-white placeholder-white/10 text-sm focus:outline-none focus:border-white/10 focus:bg-white/[0.02] transition-all"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Dynamic Promo Component */}
                  <div className="pt-1">
                    {!promoOpen && !validPromo ? (
                      <button 
                        onClick={() => { setPromoOpen(true); setTimeout(() => promoInputRef.current?.focus(), 80); }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white/30 hover:text-amber-400 hover:bg-white/[0.03] px-3 py-1.5 rounded-lg transition-all group"
                      >
                        <Tag className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" /> Enter Promo Code
                      </button>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-2"
                      >
                        {validPromo ? (
                          <div className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-black border ${validPromo.is_free ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"} shadow-sm`}>
                            <div className="flex items-center gap-2 truncate uppercase tracking-wide">
                              <Tag className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{validPromo.is_free ? "100% OFF ACTIVATED" : `${validPromo.discount_percentage}% SAVINGS APPLIED`}</span>
                            </div>
                            <button onClick={() => { setPromoResult(null); setPromoCode(""); setPromoOpen(true); }} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-current opacity-60 hover:opacity-100">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              ref={promoInputRef}
                              type="text" placeholder="TYPE CODE"
                              value={promoCode} onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                              className="flex-1 h-10 bg-white/[0.02] border border-white/[0.08] rounded-xl px-3 text-white placeholder-white/10 text-xs font-mono font-black tracking-widest uppercase focus:outline-none focus:border-amber-400/30 transition-colors"
                            />
                            <button 
                              onClick={handleApplyPromo} disabled={promoValidating || !promoCode.trim()}
                              className="h-10 px-4 rounded-xl text-[11px] font-black bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/10 active:scale-95"
                            >
                              {promoValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "APPLY"}
                            </button>
                            <button onClick={() => { setPromoOpen(false); setPromoCode(""); setPromoResult(null); }} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {promoResult && !promoResult.valid && (
                          <p className="text-xs font-bold text-red-400/80 px-2 tracking-tight">{promoResult.error || "Code not recognized"}</p>
                        )}
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                {/* Prime Execution Node */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, type: "spring", bounce: 0.3 }}
                  className="pt-2 relative"
                >
                  {isFreePromo ? (
                    <button 
                      onClick={handleClaimFree} 
                      disabled={claiming || !isPhoneValid || !resolvedName}
                      className="w-full h-[68px] font-black text-base tracking-wider rounded-2xl bg-green-500 hover:bg-green-400 text-black shadow-[0_12px_24px_-8px_rgba(34,197,94,0.5)] transition-all active:scale-[0.97] hover:-translate-y-0.5 disabled:opacity-30 disabled:grayscale disabled:transform-none flex items-center justify-center gap-2.5"
                    >
                      {claiming ? (
                        <><Loader2 className="w-6 h-6 animate-spin" /> UNLOCKING...</>
                      ) : (
                        <><Gift className="w-6 h-6" /> UNLOCK FREE DATA</>
                      )}
                    </button>
                  ) : (
                    <div className="relative group">
                      {/* Kinetic Dynamic Pulsating Ring behind button */}
                      <div 
                        className="absolute -inset-1 opacity-20 rounded-2xl blur-xl transition-all duration-500 group-hover:opacity-40 group-hover:blur-2xl pointer-events-none"
                        style={{ background: `hsl(${theme.primary})` }}
                      />
                      
                      <button 
                        onClick={handlePay} 
                        disabled={buying || !resolvedName}
                        className="w-full h-[76px] relative overflow-hidden rounded-2xl shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] transition-all active:scale-[0.97] hover:-translate-y-0.5 disabled:opacity-30 disabled:grayscale disabled:transform-none flex items-center justify-center"
                        style={{ 
                          background: `linear-gradient(135deg, hsl(${theme.primary}) 0%, #F59E0B 100%)`,
                          color: "#000"
                        }}
                      >
                        {/* Internal Light Shimmer */}
                        <div className="absolute inset-0 bg-white/10 transform -translate-x-full group-hover:animate-shimmer pointer-events-none" style={{ width: '50%', skewX: '-20deg' }} />

                        <div className="relative z-10 flex flex-col items-center justify-center leading-none">
                          {buying ? (
                            <div className="flex items-center gap-3 font-black text-base uppercase tracking-widest">
                              <Loader2 className="w-6 h-6 animate-spin" />
                              <span>Establishing Secure Tunnel...</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.25em] mb-1.5 opacity-75">
                                <CreditCard className="w-3.5 h-3.5" />
                                Secure Deposit
                              </div>
                              <div className="flex items-baseline gap-1 font-black text-3xl tracking-tight">
                                <span className="text-lg font-black align-top opacity-70">GH₵</span>
                                {total.toFixed(2)}
                              </div>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  )}
                  
                  {/* Final Verification Anchor */}
                  <div className="flex items-center justify-center gap-1.5 mt-5 opacity-25 group-hover:opacity-40 transition-opacity duration-500">
                    <ShieldCheck className="w-3 h-3 text-white" />
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white">
                      Tier 1 Bank Encryption
                    </p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-20deg); }
          100% { transform: translateX(300%) skewX(-20deg); }
        }
        .group-hover\\:animate-shimmer {
          animation: shimmer 1.5s ease-out infinite;
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default BuyData;
