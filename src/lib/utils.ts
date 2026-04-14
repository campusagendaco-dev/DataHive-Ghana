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
