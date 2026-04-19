export const DEFAULT_API_SOURCE = "primary" as const;
export type ApiSource = "primary";

export const getMultiplierFromSource = (_source: ApiSource): number => 1;

export const applyPriceMultiplier = (price: number, multiplier: number): number =>
  Number((price * multiplier).toFixed(2));

export async function fetchApiPricingContext(): Promise<{ source: ApiSource; multiplier: number }> {
  return { source: "primary", multiplier: 1 };
}
