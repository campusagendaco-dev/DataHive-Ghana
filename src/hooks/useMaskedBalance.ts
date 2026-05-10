import { useState, useEffect, useCallback } from "react";

export function useMaskedBalance() {
  const [isMasked, setIsMasked] = useState(() => {
    // Restore from local storage, default to TRUE (more secure)
    const stored = localStorage.getItem("swiftdata_balance_masked");
    return stored !== "false";
  });

  const toggleMask = useCallback(() => {
    setIsMasked(prev => {
      const next = !prev;
      localStorage.setItem("swiftdata_balance_masked", String(next));
      // Dispatch custom event to notify other components listening on same page
      window.dispatchEvent(new Event("balance_mask_changed"));
      return next;
    });
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem("swiftdata_balance_masked");
      setIsMasked(stored !== "false");
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("balance_mask_changed", handleStorage);
    
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("balance_mask_changed", handleStorage);
    };
  }, []);

  const maskValue = useCallback((val: number | string | undefined | null) => {
    if (isMasked) {
      return "****";
    }
    if (val === undefined || val === null) return "0.00";
    if (typeof val === "number") {
      return val.toFixed(2);
    }
    return val;
  }, [isMasked]);

  return { isMasked, toggleMask, maskValue };
}
