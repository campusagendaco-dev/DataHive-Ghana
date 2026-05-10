import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Lock, Clock, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Constants for the Ghost Idle Timer
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 Minutes of complete inactivity
const COUNTDOWN_SECONDS = 30; // Final warning duration before ejection

export function SecurityGuard({ children }: { children: React.ReactNode }) {
  const { user, signOut, profile } = useAuth();
  const [isBlurred, setIsBlurred] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  
  // Idle Management State
  const [isWarning, setIsWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
  const idleTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimers();
    setIsWarning(false);
    if (user) {
      await signOut();
    }
  }, [signOut, user, clearTimers]);

  const startCountdown = useCallback(() => {
    setIsWarning(true);
    setTimeLeft(COUNTDOWN_SECONDS);
    
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    
    countdownTimerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [handleLogout]);

  const resetIdleTimer = useCallback(() => {
    // Don't reset timer if already showing warning or if user isn't logged in
    if (!user || isWarning) return;

    clearTimers();
    idleTimerRef.current = window.setTimeout(() => {
      startCountdown();
    }, IDLE_TIMEOUT_MS);
  }, [user, isWarning, clearTimers, startCountdown]);

  // Check config from DB
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const { data } = await supabase.functions.invoke("system-settings", {
          body: { action: "get" }
        });
        if (data) {
          const val = data.enable_privacy_shield !== false;
          setIsEnabled(val);
          if (val) document.body.classList.add("shield-active");
          else document.body.classList.remove("shield-active");
        }
      } catch (e) {
        setIsEnabled(true);
        document.body.classList.add("shield-active");
      }
    };
    checkConfig();
  }, []);

  // Set up Global Listeners for Shield & Idle Detection
  useEffect(() => {
    // 1. Global Activity Listeners for Idle Timer
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    });
    
    // Set initial timer
    resetIdleTimer();

    if (!isEnabled) {
      document.body.classList.remove("shield-active");
      return () => {
        activityEvents.forEach(event => window.removeEventListener(event, resetIdleTimer));
        clearTimers();
      };
    }
    document.body.classList.add("shield-active");

    // 🚫 2. Block Right Click Context Menu
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    // 🚫 3. Intercept Critical Keyboard Combinations
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        navigator.clipboard.writeText(""); // Clean clipboard
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'u')) {
        e.preventDefault();
      }
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
      }
    };

    // 🛡️ 4. Anti-Preview Shield
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);
    const handleVisibilityChange = () => {
      setIsBlurred(document.visibilityState === 'hidden');
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, resetIdleTimer));
      clearTimers();
      
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isEnabled, resetIdleTimer, clearTimers]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden selection:bg-primary selection:text-black">
      {/* Main Application Layer */}
      <div className={`transition-all duration-300 ${isBlurred ? "blur-xl grayscale scale-[0.98]" : "blur-0"}`}>
        {children}
      </div>

      {/* 🛡️ Layer 1: Task Switcher Privacy Overlay */}
      <AnimatePresence>
        {isBlurred && isEnabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-2xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center text-center px-6 max-w-md"
            >
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 relative transform rotate-12">
                <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping opacity-20" />
                <ShieldAlert className="w-10 h-10 text-primary transform -rotate-12" />
              </div>
              <h2 className="text-2xl font-black mb-2 text-foreground tracking-tight flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" /> 
                Secure Protection
              </h2>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                Your wallet and transaction privacy are enforced when you leave the app viewport.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⏳ Layer 2: Auto-Logout Idle Warning Modal */}
      <AnimatePresence>
        {isWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-white/10 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-8 h-8 text-amber-500 animate-pulse" />
              </div>
              <h3 className="text-xl font-black text-foreground mb-2">Session Expiring?</h3>
              <p className="text-muted-foreground text-sm mb-6">
                You've been inactive for a while. We'll log you out for your wallet's safety in <span className="text-amber-500 font-black">{timeLeft}s</span>.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setIsWarning(false);
                    resetIdleTimer(); // Restart the 15m window
                  }}
                  className="w-full py-3 px-4 bg-primary text-black font-black rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                  I'm Still Here
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full py-3 px-4 bg-white/5 text-muted-foreground font-bold rounded-2xl hover:bg-white/10 flex items-center justify-center gap-2 transition-all"
                >
                  <LogOut className="w-4 h-4" /> Log Out Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
