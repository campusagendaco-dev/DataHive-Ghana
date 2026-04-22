import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokePublicFunction } from "@/lib/public-function-client";
import PhoneOrderTracker from "@/components/PhoneOrderTracker";

type OrderStatus = "pending" | "paid" | "processing" | "fulfilled" | "fulfillment_failed";

const STEPS = [
  {
    key: "confirmed",
    label: "Payment Confirmed",
    sub: "Paystack verified your payment",
    icon: ShieldCheck,
  },
  {
    key: "delivering",
    label: "Delivering Data",
    sub: "Sending bundle to your number",
    icon: Zap,
  },
  {
    key: "done",
    label: "Data Delivered",
    sub: "Bundle successfully activated",
    icon: CheckCircle2,
  },
] as const;

function statusToStep(status: OrderStatus): number {
  if (status === "fulfilled") return 3;
  if (status === "paid" || status === "processing") return 1;
  return 0;
}

const OrderStatus = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("trxref") || "";
  const network = searchParams.get("network") || "";
  const packageSize = searchParams.get("package") || "";
  const phone = searchParams.get("phone") || "";

  const [orderStatus, setOrderStatus] = useState<OrderStatus>("pending");
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(!reference);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const redirectedRef = useRef(false);

  const handleStatusUpdate = (status: OrderStatus) => {
    setOrderStatus(status);
    const s = statusToStep(status);
    setStep(s);

    if (status === "fulfillment_failed") {
      setFailed(true);
      return;
    }

    if (status === "fulfilled" && !redirectedRef.current) {
      redirectedRef.current = true;
      const params = new URLSearchParams({ reference, network, package: packageSize, phone, source: "checkout" });
      setTimeout(() => navigate(`/purchase-success?${params.toString()}`, { replace: true }), 900);
    }
  };

  useEffect(() => {
    if (!reference) return;

    // Realtime subscription — fires the moment the webhook updates the order
    const ch = supabase
      .channel(`order-status-${reference}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${reference}` },
        (payload: any) => {
          if (payload.new?.status) handleStatusUpdate(payload.new.status as OrderStatus);
        }
      )
      .subscribe();

    channelRef.current = ch;

    // Also poll verify-payment as a fallback (in case realtime misses the event)
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      const { data } = await invokePublicFunction("verify-payment", { body: { reference } });
      if (cancelled) return;

      if (data?.status) {
        handleStatusUpdate(data.status as OrderStatus);
        setInitialCheckDone(true);
        if (data.status === "fulfilled" || data.status === "fulfillment_failed") {
          clearInterval(timer);
        }
      } else {
        setInitialCheckDone(true);
      }

      if (attempts >= 20) clearInterval(timer);
    };

    void poll();
    const timer = setInterval(poll, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const hasOrder = Boolean(reference);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="container mx-auto max-w-2xl space-y-6">

        {/* ── Live order status (only when coming from checkout) ── */}
        {hasOrder && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Card header */}
            <div
              className="px-5 pt-5 pb-4 flex items-center gap-3"
              style={{ background: "linear-gradient(135deg,#1a1a2e,#0f0f1e)" }}
            >
              <div className="relative shrink-0">
                <img
                  src="/logo.png"
                  alt="SwiftData Ghana"
                  className="w-11 h-11 rounded-full"
                  style={{ animation: step < 3 ? "logo-breathe 2.4s ease-in-out infinite" : "none" }}
                />
                {step < 3 && !failed && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-[#1a1a2e] flex items-center justify-center">
                    <Loader2 className="w-2 h-2 text-white animate-spin" />
                  </span>
                )}
                {step >= 3 && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[#1a1a2e]" />
                )}
              </div>
              <div>
                <p className="text-white font-bold text-sm">
                  {network && packageSize ? `${network} ${packageSize}` : "Your Order"}
                </p>
                <p className="text-white/50 text-xs">{phone || "Processing your purchase"}</p>
              </div>
              <div className="ml-auto text-right">
                {failed ? (
                  <span className="text-xs font-semibold text-red-400">Failed</span>
                ) : step >= 3 ? (
                  <span className="text-xs font-semibold text-green-400">Complete ✓</span>
                ) : (
                  <span className="text-xs font-semibold text-blue-400 animate-pulse">Live</span>
                )}
              </div>
            </div>

            {/* Steps */}
            <div className="px-5 py-5">
              {failed ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-600 dark:text-red-400">
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Delivery Failed</p>
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      Payment was received but data delivery failed. Contact support with reference:{" "}
                      <span className="font-mono">{reference.slice(0, 8)}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  {STEPS.map((s, i) => {
                    const done = step > i;
                    const active = step === i && initialCheckDone;
                    const upcoming = step < i;

                    return (
                      <div key={s.key} className="flex gap-4">
                        {/* Icon + connector line */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500 ${
                              done
                                ? "border-green-500 bg-green-500"
                                : active
                                ? "border-primary bg-primary/15 animate-pulse"
                                : "border-border bg-secondary/50"
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            ) : active ? (
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            ) : (
                              <s.icon className="w-4 h-4 text-muted-foreground/40" />
                            )}
                          </div>
                          {i < STEPS.length - 1 && (
                            <div
                              className={`w-0.5 flex-1 my-1 min-h-[24px] transition-all duration-700 ${
                                done ? "bg-green-500" : "bg-border"
                              }`}
                            />
                          )}
                        </div>

                        {/* Text */}
                        <div className={`pb-4 pt-1 ${i === STEPS.length - 1 ? "pb-0" : ""}`}>
                          <p
                            className={`text-sm font-bold leading-tight transition-colors ${
                              done
                                ? "text-green-600 dark:text-green-400"
                                : active
                                ? "text-foreground"
                                : "text-muted-foreground/50"
                            }`}
                          >
                            {s.label}
                          </p>
                          <p
                            className={`text-xs mt-0.5 ${
                              upcoming ? "text-muted-foreground/35" : "text-muted-foreground"
                            }`}
                          >
                            {s.sub}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Loading initial state */}
              {!initialCheckDone && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Confirming payment with Paystack...
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Phone tracker — all orders ── */}
        <PhoneOrderTracker
          title={hasOrder ? "All Orders for This Number" : "Track Order by Phone"}
          subtitle={
            hasOrder
              ? "View the full delivery history for the recipient's number."
              : "Enter the recipient phone number to see all delivery statuses."
          }
          defaultPhone={phone || undefined}
        />
      </div>
    </div>
  );
};

export default OrderStatus;
