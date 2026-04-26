import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns Tailwind classes for data-package cards based on network name */
export function getNetworkCardColors(network: string): {
  card: string;
  label: string;
  price: string;
  size: string;
  btn: string;
} {
  switch (network) {
    case "Telecel":
      return {
        card: "bg-red-600",
        label: "text-white/70",
        price: "text-white/70",
        size: "text-white",
        btn: "bg-red-800 hover:bg-red-900 text-white",
      };
    case "AirtelTigo":
      return {
        card: "bg-blue-600",
        label: "text-white/70",
        price: "text-white/70",
        size: "text-white",
        btn: "bg-blue-800 hover:bg-blue-900 text-white",
      };
    default: // MTN
      return {
        card: "bg-amber-400",
        label: "text-black/70",
        price: "text-black/70",
        size: "text-black",
        btn: "bg-amber-100 hover:bg-white text-black",
      };
  }
}

/**
 * Detects the network provider based on Ghanaian phone number prefixes.
 */
export function detectNetwork(phone: string): "MTN" | "Telecel" | "AirtelTigo" | null {
  const digits = phone.replace(/\D+/g, "");
  if (digits.length < 3) return null;
  
  // Normalize to 10 digits if possible (e.g. 23324... -> 024...)
  let prefix = "";
  if (digits.startsWith("233") && digits.length >= 6) {
    prefix = digits.slice(3, 6);
  } else if (digits.startsWith("0") && digits.length >= 3) {
    prefix = digits.slice(1, 3);
  } else if (digits.length >= 2) {
    prefix = digits.slice(0, 2);
  }

  // Prepend 0 if it's just 2 digits
  if (prefix.length === 2) prefix = "0" + prefix;
  else if (prefix.length === 3 && !prefix.startsWith("0")) prefix = "0" + prefix.slice(1);

  const mtn = ["024", "054", "055", "059", "025", "053"];
  const telecel = ["020", "050"];
  const at = ["027", "057", "026", "056"];

  if (mtn.some(p => prefix.startsWith(p))) return "MTN";
  if (telecel.some(p => prefix.startsWith(p))) return "Telecel";
  if (at.some(p => prefix.startsWith(p))) return "AirtelTigo";

  return null;
}
