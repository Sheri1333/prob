import { settings } from "./db.js";

export const PRICING_ID = "ent-pricing";

export interface EntPricing {
  singlePriceTenge: number;
  bundlePriceTenge: number;
}

export const DEFAULT_PRICING: EntPricing = {
  singlePriceTenge: 500,
  bundlePriceTenge: 1250,
};

/** Full ENT sessions each plan adds to the balance. */
export const PLAN_SESSIONS = { single: 1, bundle: 3 } as const;

function clampPrice(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

export function normalizePricing(input: Partial<EntPricing> | null | undefined): EntPricing {
  return {
    singlePriceTenge: clampPrice(input?.singlePriceTenge, DEFAULT_PRICING.singlePriceTenge),
    bundlePriceTenge: clampPrice(input?.bundlePriceTenge, DEFAULT_PRICING.bundlePriceTenge),
  };
}

export async function getPricing(): Promise<EntPricing> {
  const doc = await settings().findOne({ _id: PRICING_ID });
  return normalizePricing(doc ?? undefined);
}

export async function savePricing(input: Partial<EntPricing>): Promise<EntPricing> {
  const next = normalizePricing(input);
  await settings().updateOne(
    { _id: PRICING_ID },
    { $set: { ...next, updatedAt: new Date() }, $unset: { trialEnabled: "" } },
    { upsert: true },
  );
  return next;
}
