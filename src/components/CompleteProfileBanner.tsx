import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Phone, ChevronRight, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CompleteProfileBanner = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if profile is loaded, but the phone number is empty/missing
    if (user && profile && (!profile.phone || profile.phone.trim() === "")) {
      const isDismissed = sessionStorage.getItem("dismissed_profile_banner");
      if (!isDismissed) {
        setIsVisible(true);
      }
    } else {
      setIsVisible(false);
    }
  }, [user, profile]);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem("dismissed_profile_banner", "true");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 mb-4 group backdrop-blur-md">
            {/* Dynamic background mesh */}
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
            
            <div className="flex-1 relative flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-indigo-400 animate-pulse" />
              </div>
              
              <div>
                <p className="font-black text-sm text-foreground flex items-center gap-2 mb-0.5">
                  Complete Your Profile
                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                    <AlertCircle className="w-2.5 h-2.5" /> Highly Recommended
                  </span>
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed max-w-xl">
                  Link your phone number to unlock **one-click checkouts**, receive **instant SMS delivery receipts**, and claim exclusive **free data bundles**!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 relative shrink-0">
              <button
                type="button"
                onClick={() => navigate("/dashboard/settings")}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all"
              >
                Add Phone Now <ChevronRight className="w-3.5 h-3.5" />
              </button>
              
              <button
                type="button"
                onClick={handleDismiss}
                className="w-9 h-9 rounded-xl border border-border bg-card/50 hover:bg-card hover:text-foreground text-muted-foreground flex items-center justify-center transition-all active:scale-90"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompleteProfileBanner;
