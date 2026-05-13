import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface UpdatePromptProps {
  needRefresh: boolean;
  onUpdate: () => void;
}

export function UpdatePrompt({ needRefresh, onUpdate }: UpdatePromptProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!loading) { setProgress(0); return; }

    // Simulate realistic download curve: fast start, slow middle, quick finish
    const stages = [
      { target: 30, speed: 18 },
      { target: 60, speed: 8 },
      { target: 85, speed: 4 },
      { target: 95, speed: 1.5 },
    ];

    const interval = setInterval(() => {
      setProgress((p) => {
        const stage = stages.find((s) => p < s.target) ?? stages[stages.length - 1];
        const increment = Math.random() * stage.speed;
        return Math.min(p + increment, 95);
      });
    }, 120);

    return () => clearInterval(interval);
  }, [loading]);

  const handleUpdate = () => {
    setLoading(true);
    setTimeout(() => {
      setProgress(100);
      setTimeout(onUpdate, 400);
    }, 3200);
  };

  const pct = Math.round(progress);

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center sm:p-6"
          style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)" }}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="relative w-full sm:max-w-[390px] overflow-hidden select-none rounded-t-[2.5rem] sm:rounded-[2.5rem]"
            style={{
              background: "linear-gradient(155deg,#12141f 0%,#0c0e18 55%,#090b12 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 -4px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Mobile drag pill */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-9 h-[3px] rounded-full bg-white/20" />
            </div>

            {/* Ambient glow */}
            <motion.div
              animate={{ opacity: [0.35, 0.65, 0.35], scale: [1, 1.1, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-36 rounded-full blur-[70px] pointer-events-none bg-primary/40"
            />

            <div className="relative z-10 px-6 pt-6 pb-8 space-y-5">

              {/* ── Icon + heading ── */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.85, 0.5] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-2xl blur-xl bg-primary/60 pointer-events-none"
                  />
                  <div className="relative w-[58px] h-[58px] rounded-2xl flex items-center justify-center bg-primary/15 border border-primary/30">
                    <motion.div
                      animate={{ rotate: loading ? 360 : 0 }}
                      transition={{ duration: 1.2, repeat: loading ? Infinity : 0, ease: "linear" }}
                      className="absolute inset-[5px] rounded-xl border border-dashed border-primary/40"
                    />
                    <svg className="w-6 h-6 relative z-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-primary/70 text-[10px] font-black uppercase tracking-[0.18em] mb-0.5">New Version</p>
                  <h2 className="text-white font-black text-[1.35rem] leading-tight tracking-tight">Update Ready</h2>
                  <p className="text-white/35 text-[11px] font-medium mt-0.5">SwiftData just got better.</p>
                </div>
              </div>

              {/* ── Feature rows ── */}
              <div className="space-y-2">
                {[
                  { emoji: "⚡", label: "Performance boosts", sub: "Faster loading & smoother UI", accent: "amber" },
                  { emoji: "🛡️", label: "Security upgrades", sub: "Critical patches applied", accent: "emerald" },
                ].map(({ emoji, label, sub, accent }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + i * 0.1 }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${
                      accent === "amber"
                        ? "bg-amber-400/8 border border-amber-400/15"
                        : "bg-emerald-400/8 border border-emerald-400/15"
                    }`}
                  >
                    <span className="text-base leading-none">{emoji}</span>
                    <div>
                      <p className={`text-xs font-bold leading-none ${accent === "amber" ? "text-amber-300" : "text-emerald-300"}`}>{label}</p>
                      <p className="text-white/30 text-[10px] mt-0.5 font-medium">{sub}</p>
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
                      className={`ml-auto w-1.5 h-1.5 rounded-full ${accent === "amber" ? "bg-amber-400" : "bg-emerald-400"}`}
                    />
                  </motion.div>
                ))}
              </div>

              {/* ── Download progress (shown while loading) ── */}
              <AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-1">
                      {/* Track */}
                      <div className="relative h-2.5 rounded-full bg-white/[0.07] overflow-hidden">
                        {/* Fill */}
                        <motion.div
                          className="absolute inset-y-0 left-0 rounded-full bg-primary"
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.15, ease: "linear" }}
                        />
                        {/* Shimmer sweep on fill */}
                        {pct < 100 && (
                          <motion.div
                            animate={{ x: ["-200%", "400%"] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                            style={{ left: 0, width: `${progress}%` }}
                          />
                        )}
                      </div>

                      {/* Labels row */}
                      <div className="flex items-center justify-between">
                        <p className="text-white/40 text-[11px] font-bold">
                          {pct < 100 ? "Downloading update…" : "Installing…"}
                        </p>
                        <motion.p
                          key={pct}
                          initial={{ scale: 1.2, color: "#f59e0b" }}
                          animate={{ scale: 1, color: "#ffffff" }}
                          className="text-white text-[13px] font-black tabular-nums"
                        >
                          {pct}%
                        </motion.p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── CTA Button ── */}
              <div className="pt-1 space-y-3">
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={loading}
                  className="group relative w-full h-[56px] rounded-2xl overflow-hidden font-black text-[0.95rem]
                             tracking-wide text-white transition-transform duration-150
                             active:scale-[0.97] disabled:pointer-events-none"
                >
                  <div className="absolute inset-0 bg-primary transition-opacity duration-300" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/15" />

                  {/* Shimmer when idle */}
                  {!loading && (
                    <motion.div
                      animate={{ x: ["-130%", "230%"] }}
                      transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
                      className="absolute inset-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />
                  )}

                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                          className="inline-block w-4 h-4 border-[2.5px] border-white/30 border-t-white rounded-full"
                        />
                        {pct < 100 ? `Downloading… ${pct}%` : "Installing…"}
                      </>
                    ) : (
                      <>
                        Update Now
                        <motion.span
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                        >
                          →
                        </motion.span>
                      </>
                    )}
                  </span>
                </button>

                <p className="text-center text-[10px] text-white/18 font-bold uppercase tracking-[0.22em]">
                  App reloads instantly
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
