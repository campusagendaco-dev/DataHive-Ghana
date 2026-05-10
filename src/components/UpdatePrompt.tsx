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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-5 bg-[#030407]/90 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
            className="relative w-full max-w-[340px] bg-[#0b0d13] border border-white/[0.08] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.8)] rounded-[2rem] overflow-hidden flex flex-col select-none"
          >
            {/* Header Gradient & Pattern */}
            <div className="relative w-full pt-8 pb-6 text-center rounded-b-[2.5rem] overflow-hidden z-10 shadow-lg">
              <div 
                className="absolute inset-0 opacity-[0.12] pointer-events-none mix-blend-overlay z-0"
                style={{ 
                  backgroundImage: "url('/assets/adinkra_pattern.png')",
                  backgroundSize: "140px",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-transparent to-[#0b0d13] z-[-1]" />
              
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 opacity-40 blur-3xl z-[-2] scale-150"
                style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent 60%)" }}
              />

              <div className="relative z-20 flex flex-col items-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 shadow-lg shadow-primary/10">
                  <Sparkles className="w-7 h-7 text-primary animate-pulse" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight mb-1">Update Ready</h2>
                <p className="text-white/40 text-[11px] font-medium leading-relaxed">A newer, faster version of SwiftData is ready.</p>
              </div>
            </div>

            {/* Body / Button */}
            <div className="p-6 pt-4 space-y-4 bg-[#0b0d13]">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-white/70 text-xs bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-medium">Includes performance boosts.</span>
                </div>
                <div className="flex items-center gap-2.5 text-white/70 text-xs bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-medium">Critical upgrades & security.</span>
                </div>
              </div>

              <div className="relative group pt-1">
                <div className="absolute -inset-1 opacity-25 rounded-[1.7rem] blur-lg transition-all bg-primary group-hover:opacity-50 pointer-events-none" />
                <button
                  onClick={onUpdate}
                  className="w-full h-[62px] relative overflow-hidden rounded-[1.25rem] bg-primary text-primary-foreground font-black text-lg tracking-tight shadow-xl transition-all active:scale-[0.96] hover:-translate-y-0.5 flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative z-10 flex items-center gap-1.5">
                    UPGRADE NOW
                  </span>
                </button>
              </div>
              
              <p className="text-center text-[8px] text-white/20 font-black uppercase tracking-[0.2em]">
                Instant reload triggered
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
