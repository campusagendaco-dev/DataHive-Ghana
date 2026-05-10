import { useState, useEffect } from "react";
import { X, TrendingUp, Zap, ShieldCheck, Store, ArrowRight, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

interface StoreVisitorPopupProps {
  agentSlug?: string;
  showSubAgentLink?: boolean;
}

const StoreVisitorPopup = ({ agentSlug, showSubAgentLink = true }: StoreVisitorPopupProps) => {
  // Force cache flush for hmr sync
  const { profile } = useAuth();
  const [visible, setVisible] = useState(false);

  // Never show to approved agents — they already have a store
  const isAgent = Boolean(profile?.agent_approved || profile?.sub_agent_approved);

  useEffect(() => {
    if (isAgent) return;

    supabase
      .from("public_system_settings")
      .select("store_visitor_popup_enabled")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        const isEnabled = Boolean((data as any)?.store_visitor_popup_enabled);
        if (!isEnabled) return;
        const t = setTimeout(() => setVisible(true), 2800);
        return () => clearTimeout(t);
      });
  }, [isAgent]);

  // Dismiss only hides for this page view — popup returns on every refresh
  const dismiss = () => setVisible(false);

  const ctaHref = showSubAgentLink && agentSlug ? `/store/${agentSlug}/sub-agent` : "/agent-program";

  // Animation variants for children staggering
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.92, y: 40 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0, 
      transition: { 
        type: "spring", 
        damping: 24, 
        stiffness: 280,
        staggerChildren: 0.08,
        delayChildren: 0.05
      } 
    },
    exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15, filter: "blur(4px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 300, damping: 25 } }
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-[6px]" 
            onClick={dismiss} 
          />

          {/* Panel */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed z-[201] inset-x-4 bottom-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[390px]"
          >
            <div
              className="relative overflow-hidden rounded-3xl shadow-2xl shadow-black/80"
              style={{ background: "#080800", border: "1px solid rgba(251,191,36,0.22)" }}
            >
              {/* ── Ambient glow ── */}
              <div className="absolute inset-0 pointer-events-none">
                <motion.div 
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="absolute -top-12 -left-12 w-48 h-48 bg-amber-400/12 rounded-full blur-3xl" 
                />
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-amber-400/8 rounded-full blur-2xl" />
              </div>

              {/* ── Close ── */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={dismiss}
                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5"
              >
                <X className="w-4 h-4" />
              </motion.button>

              {/* ── Hero ── */}
              <motion.div
                variants={itemVariants}
                className="relative overflow-hidden mx-6 mt-6 mb-4 rounded-2xl shadow-lg shadow-black/40"
                style={{ background: "#0d0d00", border: "1px solid rgba(251,191,36,0.18)", minHeight: 200 }}
              >
                {/* Diagonal yellow slash */}
                <div
                  className="absolute inset-0 pointer-events-none overflow-hidden"
                  style={{ borderRadius: "inherit" }}
                >
                  <motion.div
                    initial={{ rotate: -18, x: 50 }}
                    animate={{ rotate: -18, x: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="absolute"
                    style={{
                      top: -40, right: -30,
                      width: 220, height: 340,
                      background: "rgba(245,158,11,0.08)",
                      borderRadius: 40,
                    }}
                  />
                  <motion.div
                    initial={{ rotate: -18, x: 30 }}
                    animate={{ rotate: -18, x: 0 }}
                    transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
                    className="absolute"
                    style={{
                      top: 10, right: -10,
                      width: 130, height: 260,
                      background: "rgba(245,158,11,0.12)",
                      borderRadius: 30,
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      bottom: -20, left: -20,
                      width: 180, height: 160,
                      background: "rgba(0,0,0,0.6)",
                      transform: "rotate(-18deg)",
                      borderRadius: 24,
                    }}
                  />
                </div>

                {/* Brand row */}
                <div className="relative z-10 flex items-center gap-2.5 px-5 pt-5 mb-4">
                  <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.3 }}
                    className="w-10 h-10 rounded-xl overflow-hidden bg-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-400/40"
                  >
                    <img src="/logo.png" alt="SwiftData Ghana" className="w-8 h-8 object-contain" />
                  </motion.div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-white font-black text-base leading-none tracking-tight">SwiftData</span>
                    </div>
                    <p className="text-amber-400 text-[11px] font-black tracking-[0.2em] uppercase">GH</p>
                  </div>
                </div>

                {/* Headline */}
                <div className="relative z-10 px-5 pb-5">
                  <h2 className="font-black leading-[1.0] mb-3" style={{ fontSize: 30 }}>
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-amber-400 inline-block"
                    >Better service,</motion.span>
                    <br />
                    <motion.span 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="text-white inline-block"
                    >zero stress</motion.span>
                  </h2>
                  {/* Decorative lines */}
                  <div className="flex gap-1.5 mb-3">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: 40 }}
                      transition={{ delay: 0.6, duration: 0.4 }}
                      className="h-[3px] bg-amber-400 rounded-full" 
                    />
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: 20 }}
                      transition={{ delay: 0.7, duration: 0.3 }}
                      className="h-[3px] bg-amber-400/30 rounded-full" 
                    />
                  </div>
                  <p className="text-white/40 text-sm font-medium">we handle the rest</p>
                </div>
              </motion.div>

              {/* "Just share your link." strip */}
              <motion.div
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                className="relative z-10 mx-6 mb-4 rounded-2xl flex items-center justify-between px-5 py-3.5 cursor-pointer shadow-md shadow-amber-500/10"
                style={{ background: "#f59e0b" }}
              >
                <span className="font-black text-black text-sm">Just share your link.</span>
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                  <ArrowRight className="w-4 h-4 text-black/70" />
                </motion.div>
              </motion.div>

              {/* ── Feature pills ── */}
              <motion.div variants={itemVariants} className="relative z-10 px-6 pb-2 grid grid-cols-3 gap-2">
                {[
                  { icon: Store,       text: "Your store" },
                  { icon: Zap,         text: "Instant pay" },
                  { icon: ShieldCheck, text: "Auto delivery" },
                ].map(({ icon: Icon, text }, idx) => (
                  <motion.div
                    key={text}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + (idx * 0.1) }}
                    whileHover={{ y: -3, borderColor: "rgba(251,191,36,0.3)", background: "rgba(255,255,255,0.05)" }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-amber-400/10 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold text-white/35 text-center leading-tight">{text}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* ── CTA ── */}
              <motion.div variants={itemVariants} className="relative z-10 p-5 pt-3 space-y-2">
                <Link
                  to={ctaHref}
                  onClick={dismiss}
                >
                  <motion.div
                    whileHover={{ scale: 1.03, boxShadow: "0 15px 30px -5px rgba(245, 158, 11, 0.4)" }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center justify-center gap-2 font-black text-black py-3.5 rounded-2xl text-sm shadow-xl shadow-amber-400/25 cursor-pointer relative overflow-hidden group"
                    style={{ background: "#f59e0b" }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-white/20"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: "100%" }}
                      transition={{ duration: 0.5 }}
                    />
                    <TrendingUp className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    Get Your Own Store Now
                  </motion.div>
                </Link>
                <motion.button
                  whileHover={{ opacity: 0.8 }}
                  onClick={dismiss}
                  className="w-full text-white/25 text-xs font-medium hover:text-white/50 transition-colors py-1"
                >
                  Maybe later
                </motion.button>
              </motion.div>

              {/* ── Footer ── */}
              <motion.div variants={itemVariants} className="relative z-10 px-6 pb-4 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-amber-400/15 border border-amber-400/25 flex items-center justify-center">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-2 h-2 rounded-full bg-amber-400" 
                  />
                </div>
                <span className="text-white/20 text-[10px]">swiftdatagh.shop</span>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StoreVisitorPopup;
