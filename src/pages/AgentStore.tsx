import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { basePackages } from "@/lib/data";
import { getNetworkCardColors } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getFunctionErrorMessage } from "@/lib/function-errors";
import { getAppBaseUrl } from "@/lib/app-base-url";
import { fetchApiPricingContext, applyPriceMultiplier } from "@/lib/api-source-pricing";
import { invokePublicFunction } from "@/lib/public-function-client";
import PhoneOrderTracker from "@/components/PhoneOrderTracker";
import StoreNavbar from "@/components/StoreNavbar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap, Loader2, TrendingUp, ChevronRight,
  ShieldCheck, Phone, X, CreditCard, Star,
} from "lucide-react";

type NetworkName = "MTN" | "Telecel" | "AirtelTigo";
const NETWORKS: NetworkName[] = ["MTN", "Telecel", "AirtelTigo"];
const PAYSTACK_FEE_RATE = 0.03;
const calcFee = (amount: number) => Math.min(amount * PAYSTACK_FEE_RATE, 100);

const networkTabStyles: Record<NetworkName, { active: string; idle: string; accent: string }> = {
  MTN:        { active: "bg-amber-400 text-black border-amber-400", idle: "border-white/15 text-white/60 hover:border-amber-400/50 hover:text-white", accent: "#f59e0b" },
  Telecel:    { active: "bg-red-600 text-white border-red-600",     idle: "border-white/15 text-white/60 hover:border-red-400/50 hover:text-white",   accent: "#dc2626" },
  AirtelTigo: { active: "bg-blue-600 text-white border-blue-600",   idle: "border-white/15 text-white/60 hover:border-blue-400/50 hover:text-white",  accent: "#2563eb" },
};

interface AgentProfile {
  user_id: string;
  store_name: string;
  full_name: string;
  whatsapp_number: string;
  support_number: string;
  email: string;
  whatsapp_group_link: string | null;
  agent_prices: Record<string, Record<string, string | number>>;
  disabled_packages: Record<string, string[]>;
  is_sub_agent: boolean;
  parent_agent_id: string | null;
  sub_agent_activation_markup: number | null;
}

interface GlobalPkgSetting {
  network: string;
  package_size: string;
  agent_price: number | null;
  public_price: number | null;
  is_unavailable: boolean;
}

const AgentStore = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedNetwork, setSelectedNetwork] = useState<NetworkName>("MTN");
  const [selectedPkg, setSelectedPkg] = useState<{ size: string; price: number } | null>(null);
  const [phone, setPhone] = useState("");
  const [buying, setBuying] = useState(false);

  const [globalSettings, setGlobalSettings] = useState<Record<string, GlobalPkgSetting>>({});
  const [parentAssignedPrices, setParentAssignedPrices] = useState<Record<string, Record<string, string | number>>>({});
  const [subAgentBaseFee, setSubAgentBaseFee] = useState<number | null>(null);
  const [priceMultiplier, setPriceMultiplier] = useState(1);

  const phoneInputRef = useRef<HTMLInputElement>(null);
  const phoneDigits = phone.replace(/\D+/g, "");
  const isPhoneValid = phoneDigits.length === 10 || phoneDigits.length === 12 || phoneDigits.length === 9;

  useEffect(() => {
    const fetchStore = async () => {
      const [agentRes, pkgRes, pricingCtx] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, store_name, full_name, whatsapp_number, support_number, email, whatsapp_group_link, agent_prices, disabled_packages, is_sub_agent, parent_agent_id, sub_agent_activation_markup")
          .eq("slug", slug)
          .eq("is_agent", true)
          .eq("onboarding_complete", true)
          .eq("agent_approved", true)
          .maybeSingle(),
        supabase.from("global_package_settings").select("network, package_size, agent_price, public_price, is_unavailable"),
        fetchApiPricingContext(),
      ]);

      const gsMap: Record<string, GlobalPkgSetting> = {};
      (pkgRes.data || []).forEach((r: any) => { gsMap[`${r.network}-${r.package_size}`] = r; });
      setGlobalSettings(gsMap);
      setPriceMultiplier(pricingCtx.multiplier);

      if (!agentRes.data) { setNotFound(true); setLoading(false); return; }

      const profile = agentRes.data as unknown as AgentProfile;
      setAgent(profile);

      if (profile.is_sub_agent && profile.parent_agent_id) {
        const { data: parentProfile } = await supabase
          .from("profiles").select("sub_agent_prices").eq("user_id", profile.parent_agent_id).maybeSingle();
        const pp = parentProfile as unknown as { sub_agent_prices?: Record<string, Record<string, string | number>> } | null;
        if (pp?.sub_agent_prices) {
          setParentAssignedPrices(pp.sub_agent_prices);
        }
      }

      const fee = Number(profile.sub_agent_activation_markup ?? 0);
      if (Number.isFinite(fee) && fee > 0) setSubAgentBaseFee(fee);
      setLoading(false);
    };
    fetchStore();
  }, [slug]);

  const resolveDisplayPrice = useCallback((network: string, size: string, fallbackPrice: number): number => {
    if (!agent) return fallbackPrice;
    const agentOwn = Number(agent.agent_prices?.[network]?.[size]);
    if (Number.isFinite(agentOwn) && agentOwn > 0) return applyPriceMultiplier(agentOwn, priceMultiplier);
    const parentAssigned = Number(parentAssignedPrices?.[network]?.[size]);
    if (Number.isFinite(parentAssigned) && parentAssigned > 0) return applyPriceMultiplier(parentAssigned, priceMultiplier);
    const gs = globalSettings[`${network}-${size}`];
    const gsBase = Number(gs?.agent_price) > 0 ? Number(gs!.agent_price) : Number(gs?.public_price);
    if (Number.isFinite(gsBase) && gsBase > 0) return applyPriceMultiplier(gsBase, priceMultiplier);
    return applyPriceMultiplier(fallbackPrice, priceMultiplier);
  }, [agent, globalSettings, parentAssignedPrices, priceMultiplier]);

  const packages = (basePackages[selectedNetwork] || [])
    .map((pkg) => {
      const gs = globalSettings[`${selectedNetwork}-${pkg.size}`];
      if (gs?.is_unavailable) return null;
      if (agent?.disabled_packages?.[selectedNetwork]?.includes(pkg.size)) return null;
      return { ...pkg, price: resolveDisplayPrice(selectedNetwork, pkg.size, pkg.price) };
    })
    .filter(Boolean) as { size: string; price: number; validity: string; popular?: boolean }[];

  const fee = selectedPkg ? calcFee(selectedPkg.price) : 0;
  const total = selectedPkg ? parseFloat((selectedPkg.price + fee).toFixed(2)) : 0;

  const handleCardClick = useCallback((size: string, price: number) => {
    setSelectedPkg((prev) => (prev?.size === size ? null : { size, price }));
    setTimeout(() => phoneInputRef.current?.focus(), 140);
  }, []);

  const handlePay = async () => {
    if (!selectedPkg || !agent) return;
    if (!isPhoneValid) {
      toast({ title: "Enter a valid phone number first", variant: "destructive" });
      phoneInputRef.current?.focus();
      return;
    }
    setBuying(true);
    const orderId = crypto.randomUUID();
    const callbackParams = new URLSearchParams({
      reference: orderId, network: selectedNetwork, package: selectedPkg.size, phone: phoneDigits,
    });

    const { data: paymentData, error: paymentError } = await invokePublicFunction("initialize-payment", {
      body: {
        email: `${phoneDigits}@customer.swiftdata.gh`,
        amount: total,
        reference: orderId,
        callback_url: `${getAppBaseUrl()}/order-status?${callbackParams.toString()}`,
        metadata: {
          order_id: orderId,
          order_type: "data",
          network: selectedNetwork,
          package_size: selectedPkg.size,
          customer_phone: phoneDigits,
          fee,
          agent_id: agent.user_id,
          payment_source: "agent_store",
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

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#0d0d18" }}>
        <div className="h-16 border-b border-white/10 flex items-center px-4">
          <Skeleton className="h-9 w-9 rounded-full mr-2.5 bg-white/10" />
          <Skeleton className="h-4 w-32 bg-white/10" />
        </div>
        <div className="py-10 px-4 text-center">
          <Skeleton className="h-7 w-48 mx-auto mb-2 bg-white/10" />
          <Skeleton className="h-4 w-64 mx-auto bg-white/10" />
        </div>
        <div className="px-4 max-w-3xl mx-auto w-full">
          <div className="flex gap-2 mb-6">
            {[1,2,3].map(i => <Skeleton key={i} className="flex-1 h-12 rounded-xl bg-white/10" />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({length:6}).map((_,i) => <Skeleton key={i} className="h-36 rounded-2xl bg-white/10" />)}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !agent) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0d0d18" }}>
        <div className="text-center text-white">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-white/20" />
          </div>
          <h1 className="font-display text-2xl font-black mb-2">Store Not Found</h1>
          <p className="text-white/40 text-sm mb-5">This store doesn't exist or isn't active yet.</p>
          <Link to="/buy-data" className="inline-flex items-center gap-2 bg-amber-400 text-black font-bold px-5 py-2.5 rounded-xl text-sm">
            Buy data directly <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const colors = getNetworkCardColors(selectedNetwork);
  const networkAccent = networkTabStyles[selectedNetwork].accent;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d0d18" }}>

      <StoreNavbar
        storeName={agent.store_name}
        agentSlug={slug}
        networkAccent={networkAccent}
        whatsappNumber={agent.whatsapp_number}
        whatsappGroupLink={agent.whatsapp_group_link ?? undefined}
        supportNumber={agent.support_number}
        email={agent.email}
        showSubAgentLink={!agent.is_sub_agent}
      />

      {/* ── Hero ── */}
      <div className="relative overflow-hidden py-10 px-4 text-center" style={{ background: "linear-gradient(180deg, #111124 0%, #0d0d18 100%)" }}>
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${networkAccent}18 0%, transparent 70%)`,
        }} />
        <div className="relative container mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 mb-4 text-xs font-semibold"
            style={{ borderColor: `${networkAccent}40`, color: networkAccent, background: `${networkAccent}10` }}>
            <Zap className="w-3.5 h-3.5" /> Instant Non-Expiry Data
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-white mb-2">{agent.store_name}</h1>
          <p className="text-white/45 text-sm max-w-sm mx-auto">
            Tap a bundle, enter your number, pay securely. Data arrives in seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-5 text-xs text-white/35">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-green-400" /> Secured by Paystack</span>
            <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-400" /> No Expiry bundles</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-blue-400" /> Instant delivery</span>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className={`flex-1 px-4 py-6 container mx-auto max-w-3xl space-y-8 ${selectedPkg ? "pb-44" : "pb-10"}`}>

        {/* Network tabs */}
        <div className="flex gap-2">
          {NETWORKS.map((n) => (
            <button
              key={n}
              onClick={() => { setSelectedNetwork(n); setSelectedPkg(null); setPhone(""); }}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all duration-200 ${
                selectedNetwork === n ? networkTabStyles[n].active : networkTabStyles[n].idle
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Package grid */}
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">
            {selectedNetwork} Bundles — tap to select
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {packages.map((pkg) => {
              const isSelected = selectedPkg?.size === pkg.size;
              return (
                <button
                  key={pkg.size}
                  onClick={() => handleCardClick(pkg.size, pkg.price)}
                  className={`${colors.card} rounded-2xl p-4 sm:p-5 flex flex-col gap-2.5 border-2 text-left transition-all duration-200 relative ${
                    isSelected
                      ? "border-white/80 shadow-2xl scale-[1.04]"
                      : "border-transparent hover:border-white/25 hover:scale-[1.02]"
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                      <span className="w-2.5 h-2.5 rounded-full bg-black" />
                    </span>
                  )}
                  {pkg.popular && !isSelected && (
                    <span className="absolute top-2 right-2 text-[9px] font-black bg-black/25 text-white px-1.5 py-0.5 rounded">HOT</span>
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
        </div>

        {/* Order tracker */}
        <PhoneOrderTracker
          title="Track Your Order"
          subtitle="Enter the recipient number to get live delivery updates."
        />

        {/* Sub-agent CTA */}
        {!agent.is_sub_agent && (
          <div className="rounded-2xl border border-amber-400/25 p-6" style={{ background: "rgba(251,191,36,0.04)" }}>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(251,191,36,0.12)" }}>
                <TrendingUp className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold text-white mb-1">Become a Sub Agent</h3>
                <p className="text-sm text-white/50 mb-4">
                  Get your own store under <strong className="text-white/80">{agent.store_name}</strong> and start earning by reselling data bundles.
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: "🏪", label: "Own Store" },
                    { icon: "📊", label: "Dashboard" },
                    { icon: "💰", label: "Earn Income" },
                  ].map((b) => (
                    <div key={b.label} className="rounded-xl border border-white/8 p-2.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <span className="text-lg">{b.icon}</span>
                      <p className="text-white/70 text-xs font-semibold mt-1">{b.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {subAgentBaseFee !== null
                    ? <p className="text-sm text-white/60">Fee: <span className="font-bold text-amber-400">GH₵ {subAgentBaseFee.toFixed(2)}</span></p>
                    : <p className="text-sm text-white/40">Contact agent for activation fee.</p>}
                  <a
                    href={`/store/${slug}/sub-agent`}
                    className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    Join Now <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-5 px-4">
        <div className="container mx-auto max-w-3xl flex flex-col items-center gap-3 text-sm text-white/35">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {agent.support_number && (
              <a href={`tel:${agent.support_number.replace(/\D+/g, "")}`} className="flex items-center gap-1.5 hover:text-white/70 transition-colors">
                <Phone className="w-3.5 h-3.5" /> {agent.support_number}
              </a>
            )}
            {agent.email && (
              <a href={`mailto:${agent.email}`} className="flex items-center gap-1.5 hover:text-white/70 transition-colors">
                ✉️ {agent.email}
              </a>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/20">
            Powered by <Zap className="w-3 h-3 text-amber-400" /> SwiftData Ghana
          </div>
        </div>
      </footer>

      {/* ── Sticky purchase bar (slides up when package selected) ── */}
      {selectedPkg && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10"
          style={{ background: "rgba(8,8,20,0.97)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)" }}
        >
          <div className="container mx-auto max-w-3xl px-4 pt-3 pb-4 sm:pb-5">
            {/* Summary row */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-black text-base">{selectedNetwork} {selectedPkg.size}</span>
                <span className="text-white/25">·</span>
                <span className="text-white/45 text-xs">
                  GH₵ {selectedPkg.price.toFixed(2)} + GH₵ {fee.toFixed(2)} fee
                </span>
                <span className="text-white/25">·</span>
                <span className="font-bold text-sm" style={{ color: networkAccent }}>
                  Total GH₵ {total.toFixed(2)}
                </span>
              </div>
              <button
                onClick={() => { setSelectedPkg(null); setPhone(""); }}
                className="text-white/30 hover:text-white/70 transition-colors p-1.5 rounded-lg hover:bg-white/8 ml-2 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Phone + Pay */}
            <div className="flex gap-2 sm:gap-3">
              <input
                ref={phoneInputRef}
                type="tel"
                inputMode="numeric"
                placeholder="Recipient number (0XXXXXXXXX)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={12}
                className="flex-1 min-w-0 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/40 transition-colors"
                style={{ background: "rgba(255,255,255,0.07)" }}
              />
              <button
                onClick={handlePay}
                disabled={buying}
                className="shrink-0 font-black px-5 py-3 rounded-xl text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-1.5 whitespace-nowrap text-black"
                style={{ background: networkAccent }}
              >
                {buying
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                  : <><CreditCard className="w-3.5 h-3.5" /> Pay GH₵ {total.toFixed(2)}</>
                }
              </button>
            </div>

            {phone.length > 0 && !isPhoneValid
              ? <p className="text-xs text-red-400 mt-1.5">Enter a valid 10-digit Ghana number</p>
              : phone.length === 0
              ? <p className="text-[11px] text-white/30 mt-1.5">Enter the recipient's number then tap Pay</p>
              : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentStore;
