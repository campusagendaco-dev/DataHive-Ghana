import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, useAnimation } from "framer-motion";
import { Gift, Zap, Star, Trophy } from "lucide-react";
import { useAppTheme } from "@/contexts/ThemeContext";

const PRIZES = [
  { points: 5, color: "#94a3b8", label: "5 pts" },
  { points: 50, color: "#f59e0b", label: "50 pts" },
  { points: 10, color: "#3b82f6", label: "10 pts" },
  { points: 20, color: "#10b981", label: "20 pts" },
  { points: 5, color: "#94a3b8", label: "5 pts" },
  { points: 100, color: "#ef4444", label: "JACKPOT" },
  { points: 10, color: "#3b82f6", label: "10 pts" },
  { points: 20, color: "#10b981", label: "20 pts" },
];

const SpinTheWheel = () => {
  const { user, profile } = useAuth();
  const { isDark } = useAppTheme();
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const controls = useAnimation();
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (profile?.last_spin_at) {
      const lastSpin = new Date(profile.last_spin_at);
      const today = new Date();
      if (lastSpin.toDateString() === today.toDateString()) {
        setHasSpun(true);
      }
    }
  }, [profile]);

  const spin = async () => {
    if (!user || isSpinning || hasSpun) return;

    setIsSpinning(true);
    try {
      const { data, error } = await supabase.rpc("spin_the_wheel", {
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data.success) {
        // Find the index of the prize to land on
        const prizeIndex = PRIZES.findIndex(p => p.points === data.points_awarded);
        const segmentAngle = 360 / PRIZES.length;
        
        // Calculate new rotation: 
        // 5 full spins (1800 deg) + target segment offset
        // We subtract the angle because the wheel spins clockwise but the indicator is at the top (0 deg)
        const newRotation = rotation + 1800 + (360 - (prizeIndex * segmentAngle)) - (segmentAngle / 2);
        
        setRotation(newRotation);
        await controls.start({
          rotate: newRotation,
          transition: { duration: 4, ease: [0.13, 0, 0, 1] }
        });

        toast.success(`Congratulations! You won ${data.points_awarded} SwiftPoints!`);
        setHasSpun(true);
      } else {
        toast.error(data.error || "Failed to spin");
      }
    } catch (err: any) {
      console.error("Spin error:", err);
      toast.error(err.message || "Failed to spin");
    } finally {
      setIsSpinning(false);
    }
  };

  if (!user) return null;

  return (
    <div className={`rounded-2xl border ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white shadow-sm'} p-6 flex flex-col items-center gap-6 overflow-hidden relative`}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />
      
      <div className="text-center">
        <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'} flex items-center justify-center gap-2 italic tracking-tight`}>
          <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
          LUCKY SPIN
          <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
        </h3>
        <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'} mt-1 uppercase tracking-widest font-bold`}>Spin daily & win up to 100 points</p>
      </div>

      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* The Indicator */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20">
          <div className="w-6 h-8 bg-white rounded-b-full shadow-lg border-x-4 border-b-4 border-amber-500 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
          </div>
        </div>

        {/* The Wheel */}
        <motion.div
          animate={controls}
          className={`w-full h-full rounded-full border-8 ${isDark ? 'border-white/10 shadow-2xl bg-[#1a1a1a]' : 'border-gray-100 shadow-xl bg-gray-50'} relative overflow-hidden`}
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {PRIZES.map((prize, i) => {
            const angle = 360 / PRIZES.length;
            return (
              <div
                key={i}
                className="absolute top-0 left-1/2 w-1/2 h-full origin-left"
                style={{
                  transform: `rotate(${i * angle}deg)`,
                  backgroundColor: prize.color,
                  clipPath: "polygon(0 0, 100% 0, 100% 45%, 0 50%)",
                  opacity: 0.85
                }}
              >
                <div 
                  className="absolute top-12 left-12 text-[10px] font-black text-white -rotate-90 origin-left whitespace-nowrap"
                  style={{ transform: `rotate(22.5deg) translate(20px, 0)` }}
                >
                  {prize.label}
                </div>
              </div>
            );
          })}
          
          {/* Center piece */}
          <div className={`absolute inset-0 m-auto w-12 h-12 ${isDark ? 'bg-[#0f0f12] border-white/10' : 'bg-white border-gray-100'} rounded-full border-4 flex items-center justify-center z-10 shadow-xl`}>
             <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
        </motion.div>
      </div>

      <button
        onClick={spin}
        disabled={isSpinning || hasSpun}
        className={`
          w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all
          ${hasSpun 
            ? (isDark ? 'bg-white/5 border border-white/10 text-white/30' : 'bg-gray-100 border border-gray-200 text-gray-400') + ' cursor-not-allowed'
            : 'bg-amber-400 hover:bg-amber-300 text-black shadow-lg shadow-amber-400/20 hover:scale-[1.02] active:scale-95 animate-pulse'
          }
        `}
      >
        {isSpinning ? "Spinning..." : hasSpun ? "Come back tomorrow" : "Spin for Free"}
      </button>


      {hasSpun && (
        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
          <Trophy className="w-3 h-3" />
          Next spin available in 24h
        </div>
      )}
    </div>
  );
};

export default SpinTheWheel;
