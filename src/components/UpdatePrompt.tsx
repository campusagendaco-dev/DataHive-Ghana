import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, ShieldCheck, Download } from "lucide-react";

interface UpdatePromptProps {
  needRefresh: boolean;
  onUpdate: () => void;
}

export function UpdatePrompt({ needRefresh, onUpdate }: UpdatePromptProps) {
  const [loading, setLoading] = useState(false);

  const handleUpdate = () => {
    setLoading(true);
    onUpdate();
  };

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6"
          style={{ background: "rgba(3,4,7,0.92)", backdropFilter: "blur(16px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ type: "spring", bounce: 0.28, duration: 0.55 }}
            className="relative w-full max-w-[360px] rounded-[2rem] overflow-hidden select-none"
            style={{
              background: "linear-gradient(170deg, #111520 0%, #0a0c12 100%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 40px 100px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04) inset",
            }}
          >
            {/* Ambient glow background */}
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
              style={{ background: "hsl(var(--primary) / 0.35)" }}
            />

            {/* Adinkra pattern overlay */}
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage: "url('/assets/adinkra_pattern.png')",
                backgroundSize: "120px",
              }}
            />

            {/* Header */}
            <div className="relative z-10 pt-9 pb-5 flex flex-col items-center px-6 text-center">
              {/* Animated icon */}
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="relative mb-4"
              >
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-2xl blur-xl"
                  style={{ background: "hsl(var(--primary) / 0.6)" }}
                />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.08))",
                    border: "1px solid hsl(var(--primary) / 0.3)",
                    boxShadow: "0 8px 32px hsl(var(--primary) / 0.25)",
                  }}>
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
              </motion.div>

              <h2 className="text-[1.65rem] font-black text-white tracking-tight leading-none mb-2">
                Update Ready
              </h2>
              <p className="text-white/40 text-xs font-medium leading-relaxed max-w-[220px]">
                A newer, faster version of SwiftData is ready.
              </p>
            </div>

            {/* Feature pills */}
            <div className="relative z-10 px-5 space-y-2">
              {[
                { icon: Zap, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/15", text: "Includes performance boosts." },
                { icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/15", text: "Critical upgrades & security." },
              ].map(({ icon: Icon, color, bg, text }, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border ${bg}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                  <span className="text-white/75 text-xs font-semibold">{text}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <div className="relative z-10 p-5 pt-4">
              <motion.div
                animate={{ boxShadow: ["0 0 0px hsl(var(--primary)/0.4)", "0 0 28px hsl(var(--primary)/0.65)", "0 0 0px hsl(var(--primary)/0.4)"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="rounded-[1.4rem]"
              >
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={loading}
                  className="relative w-full h-[60px] rounded-[1.4rem] overflow-hidden font-black text-[1.05rem] tracking-tight transition-all duration-200 active:scale-[0.96] disabled:opacity-80"
                  style={{
                    background: loading
                      ? "hsl(var(--primary) / 0.7)"
                      : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))",
                    color: "hsl(var(--primary-foreground))",
                    boxShadow: "0 8px 32px hsl(var(--primary) / 0.45)",
                  }}
                >
                  {/* Shimmer sweep */}
                  {!loading && (
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.8 }}
                      className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg]"
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Reloading…
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        UPGRADE NOW
                      </>
                    )}
                  </span>
                </button>
              </motion.div>

              <p className="text-center text-[9px] text-white/20 font-black uppercase tracking-[0.25em] mt-3">
                Instant reload triggered
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
