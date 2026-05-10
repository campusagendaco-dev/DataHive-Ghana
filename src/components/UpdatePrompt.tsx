import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, ShieldCheck } from "lucide-react";

interface UpdatePromptProps {
  needRefresh: boolean;
  onUpdate: () => void;
}

export function UpdatePrompt({ needRefresh, onUpdate }: UpdatePromptProps) {
  return (
    <AnimatePresence>
      {needRefresh && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-[#030407]/95 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
            className="relative w-full max-w-[400px] bg-[#0b0d13] border border-white/[0.06] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8)] rounded-[2.5rem] overflow-hidden flex flex-col select-none"
          >
            {/* Header Gradient & Pattern */}
            <div className="relative w-full pt-12 pb-8 text-center rounded-b-[3rem] overflow-hidden z-10">
              <div 
                className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-overlay z-0"
                style={{ 
                  backgroundImage: "url('/assets/adinkra_pattern.png')",
                  backgroundSize: "160px",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-[#0b0d13] z-[-1]" />
              
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 opacity-40 blur-3xl z-[-2] scale-150"
                style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 60%)" }}
              />

              <div className="relative z-20 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                  <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-1">Update Available</h2>
                <p className="text-white/50 text-sm px-8">A newer, faster version of SwiftData is ready for deployment.</p>
              </div>
            </div>

            {/* Body / Button */}
            <div className="p-8 pt-6 space-y-6 bg-[#0b0d13]">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-white/80 text-sm bg-white/5 border border-white/5 rounded-xl p-3">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Includes new performance boosts.</span>
                </div>
                <div className="flex items-center gap-3 text-white/80 text-sm bg-white/5 border border-white/5 rounded-xl p-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Critical security & visual upgrades.</span>
                </div>
              </div>

              <div className="relative group pt-2">
                <div className="absolute -inset-2 opacity-20 rounded-[2.2rem] blur-xl transition-all bg-primary group-hover:opacity-50 pointer-events-none" />
                <button
                  onClick={onUpdate}
                  className="w-full h-[72px] relative overflow-hidden rounded-2xl bg-primary text-primary-foreground font-black text-xl tracking-tight shadow-2xl transition-all active:scale-[0.96] hover:-translate-y-1 flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative z-10 flex items-center gap-2">
                    UPGRADE NOW
                  </span>
                </button>
              </div>
              
              <p className="text-center text-[9px] text-white/25 font-black uppercase tracking-widest flex items-center justify-center gap-2">
                Instant reload required
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
