/** ENT blocks: mandatory + profile subjects chosen by student. */
export type EntBlockKind = "history" | "reading" | "math_literacy" | "profile";

export const ENT_BLOCK_LABELS: Record<
  Exclude<EntBlockKind, "profile">,
  { kz: string; ru: string }
> = {
  history: { kz: "Қазақстан тарихы", ru: "История Казахстана" },
  reading: { kz: "Оқу сауаттылығы", ru: "Грамотность чтения" },
  math_literacy: {
    kz: "Математикалық сауаттылық",
    ru: "Математическая грамотность",
  },
};

/** Normalize subject string for grouping variants. */
export function normalizeSubject(subject: string): string {
  return subject.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map free-text subject to a mandatory ENT block, or null if profile. */
export function detectEntBlock(subject: string): Exclude<EntBlockKind, "profile"> | null {
  const s = normalizeSubject(subject);
  if (
    /история\s*казахстана|қазақстан\s*тарихы|^история$|^тарих$|history/.test(s)
  ) {
    return "history";
  }
  if (
    /грамотность\s*чтения|оқу\s*сауаттылығы|чтение|reading/.test(s)
  ) {
    return "reading";
  }
  if (
    /математическ(ая|ой)\s*грамотност|математикалық\s*сауаттылық|math\s*literacy/.test(
      s,
    )
  ) {
    return "math_literacy";
  }
  return null;
}

export const ENT_TOTAL_MINUTES = 240;
export const ENT_PROFILE_COUNT = 2;
