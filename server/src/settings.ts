import { settings, tests } from "./db.js";
import { subjectPoolKey } from "./ent.js";

export const PRICING_ID = "ent-pricing";

export interface EntPricing {
  singlePriceTenge: number;
  bundlePriceTenge: number;
}

export const DEFAULT_PRICING: EntPricing = {
  singlePriceTenge: 500,
  bundlePriceTenge: 1250,
};

export const SUBJECT_PRICES_ID = "subject-prices";

/** Price in tenge per subject pool key. Missing or 0 means not sold on its own. */
export type SubjectPrices = Record<string, number>;

export async function getSubjectPrices(): Promise<SubjectPrices> {
  const doc = await settings().findOne({ _id: SUBJECT_PRICES_ID });
  return normalizeSubjectPrices(doc?.prices);
}

export function normalizeSubjectPrices(input: unknown): SubjectPrices {
  const out: SubjectPrices = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const name = key.trim().toLowerCase();
    const price = clampPrice(value, 0);
    if (name && price > 0) out[name] = price;
  }
  return out;
}

/** Every subject that has test variants, keyed the way prices and exam pools are. */
export async function subjectPools(): Promise<Array<{ key: string; label: string; testCount: number }>> {
  const rows = await tests().find({}, { projection: { subject: 1, section: 1 } }).toArray();
  const byKey = new Map<string, { key: string; label: string; testCount: number }>();
  for (const row of rows) {
    const key = subjectPoolKey(row.subject);
    const hit = byKey.get(key);
    if (hit) hit.testCount += 1;
    else byKey.set(key, { key, label: row.section || row.subject, testCount: 1 });
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export async function saveSubjectPrices(input: unknown): Promise<SubjectPrices> {
  const prices = normalizeSubjectPrices(input);
  await settings().updateOne(
    { _id: SUBJECT_PRICES_ID },
    { $set: { prices, updatedAt: new Date() } },
    { upsert: true },
  );
  return prices;
}

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
