import { useState, useEffect } from "react";
import { CheckCircle2, ShoppingBag, Zap } from "lucide-react";

const NAMES = ["K. Amponsah", "E. Osei", "M. Mensah", "A. Boateng", "D. Appiah", "S. Owusu", "C. Darko", "J. Asare", "F. Addo", "P. Baah"];
const PACKAGES = ["5GB MTN", "10GB MTN", "1GB MTN", "2GB Telecel", "5GB AirtelTigo", "15GB MTN", "30GB Telecel", "20GB MTN"];
const TIMES = ["Just now", "2 mins ago", "5 mins ago", "1 min ago", "Just now"];

export const LiveActivityToast = () => {
  const [visible, setVisible] = useState(false);
  const [currentData, setCurrentData] = useState({ name: "", pkg: "", time: "" });

  useEffect(() => {
    const triggerPopup = () => {
      const randName = NAMES[Math.floor(Math.random() * NAMES.length)];
      const randPkg = PACKAGES[Math.floor(Math.random() * PACKAGES.length)];
      const randTime = TIMES[Math.floor(Math.random() * TIMES.length)];
      
      setCurrentData({ name: randName, pkg: randPkg, time: randTime });
      setVisible(true);
      
      // Hide after 6 seconds
      setTimeout(() => {
        setVisible(false);
      }, 6000);
    };

    // Wait 10s initially
    const initialDelay = setTimeout(triggerPopup, 10000);

    // Repeat every 25 to 40 seconds
    const interval = setInterval(() => {
      triggerPopup();
    }, Math.random() * 15000 + 25000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 sm:right-auto sm:left-6 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500 ease-out fill-mode-both">
      <div className="bg-[#0d140d]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xl max-w-xs sm:max-w-sm">
        <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0 relative">
          <Zap className="w-5 h-5 text-amber-400" />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[#0d140d]">
            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Live Delivery</span>
            <span className="text-[9px] text-emerald-400 font-bold">{currentData.time}</span>
          </div>
          <p className="text-xs text-white font-medium leading-snug">
            <span className="text-white font-bold">{currentData.name}</span> just received <span className="text-amber-400 font-black">{currentData.pkg} Bundle</span>!
          </p>
        </div>
      </div>
    </div>
  );
};
