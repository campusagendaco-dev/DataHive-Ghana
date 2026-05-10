import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function SecurityGuard({ children }: { children: React.ReactNode }) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true); // Optimistic default

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

  useEffect(() => {
    if (!isEnabled) {
      document.body.classList.remove("shield-active");
      return; 
    }
    document.body.classList.add("shield-active");

    // 🚫 1. Block Right Click Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 🚫 2. Intercept Critical Keyboard Combinations
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Print Screen attempt cleaning (Doesn't stop OS but can interfere slightly)
      if (e.key === "PrintScreen") {
        navigator.clipboard.writeText(""); // Wipe potential clipboard grabs
      }

      // Block Ctrl/Cmd + P (Print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
      }
      // Block Ctrl/Cmd + S (Save Page)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
      }
      // Block Ctrl/Cmd + U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
      }
      // Block F12 / Cmd+Option+I (Dev Tools)
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
      }
    };

    // 🛡️ 3. Anti-Preview Shield (Android Task Switcher & Tab Changes)
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
      }
    };

    // Attach Global Listeners
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Main Application Layer */}
      <div className={`transition-all duration-300 ${isBlurred ? "blur-xl grayscale scale-[0.98]" : "blur-0"}`}>
        {children}
      </div>

      {/* 🛡️ Privacy Shield Overlay */}
      <AnimatePresence>
        {isBlurred && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background/90 backdrop-blur-2xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center text-center px-6 max-w-md"
            >
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-20" />
                <ShieldAlert className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-black mb-2 text-foreground tracking-tight flex items-center gap-2">
                <Lock className="w-5 h-5" /> 
                Privacy Mode
              </h2>
              <p className="text-muted-foreground text-sm font-medium leading-relaxed mb-6">
                SwiftData automatically protects your dashboard contents when you switch tabs or applications.
              </p>
              <div className="h-1 w-24 bg-primary/20 rounded-full overflow-hidden relative">
                <motion.div 
                  animate={{ x: [-96, 96] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="absolute inset-y-0 w-12 bg-primary"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
