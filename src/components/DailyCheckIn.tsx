import { useState, useEffect } from "react";
import { Gift, Sparkles, Calendar, CheckCircle2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAppTheme } from "@/contexts/ThemeContext";

const DailyCheckIn = () => {
  const { user, profile } = useAuth();
  const { isDark } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (profile?.last_check_in) {
      const lastCheckIn = new Date(profile.last_check_in);
      const today = new Date();
      if (lastCheckIn.toDateString() === today.toDateString()) {
        setHasCheckedIn(true);
      }
    }
    setStreak(profile?.check_in_streak || 0);
  }, [profile]);

  const handleCheckIn = async () => {
    if (!user || hasCheckedIn) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("claim_daily_check_in", {
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Bonus! +${data.points_awarded} SwiftPoints added to your wallet.`);
        setHasCheckedIn(true);
        setStreak(data.streak);
      } else {
        toast.error(data.error || "Check-in failed");
      }
    } catch (err: any) {
      console.error("Check-in error:", err);
      toast.error(err.message || "Failed to check in");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      className={`relative overflow-hidden rounded-3xl border ${isDark ? 'border-amber-400/20 bg-white/5' : 'border-amber-100 bg-amber-50/50'} p-4 mb-4 group shadow-sm transition-all`}
    >
      {/* Tiny decorative sparkle */}
      <div className="absolute -top-1 -right-1 p-2 opacity-20">
        <Sparkles className="w-8 h-8 text-amber-500" />
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl ${isDark ? 'bg-amber-400/20' : 'bg-amber-400/10'} flex items-center justify-center shrink-0`}>
            <Gift className="w-5 h-5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Daily Reward</h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-black text-[9px] font-black uppercase tracking-tighter">
                Day {streak}
              </span>
            </div>
            <p className={`text-[11px] ${isDark ? 'text-white/40' : 'text-gray-500'} truncate`}>
              Claim <span className="text-amber-500 font-bold">SwiftPoints</span> every day!
            </p>
          </div>
        </div>

        <button
          onClick={handleCheckIn}
          disabled={loading || hasCheckedIn}
          className={`
            relative inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-black transition-all duration-300 shrink-0
            ${hasCheckedIn 
              ? (isDark ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-600') + ' cursor-default' 
              : 'bg-amber-400 hover:bg-amber-300 text-black shadow-md shadow-amber-400/10'
            }
          `}
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : hasCheckedIn ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Claimed
            </>
          ) : (
            <>
              <Calendar className="w-3.5 h-3.5" />
              Claim
            </>
          )}
        </button>
      </div>

      {/* Mini Streak Tracker */}
      <div className="mt-3 pt-3 border-t border-amber-400/10 flex items-center justify-between">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <div 
              key={day}
              className={`w-1 h-1 rounded-full ${day <= (streak % 8) ? 'bg-amber-400' : (isDark ? 'bg-white/10' : 'bg-gray-200')}`}
            />
          ))}
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-white/20' : 'text-gray-400'}`}>
          {hasCheckedIn ? 'See you tomorrow! ✨' : `Streak Bonus: +${(streak-1)*5} pts`}
        </span>
      </div>
    </motion.div>
  );
};

export default DailyCheckIn;
