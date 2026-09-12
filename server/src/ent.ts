/** ENT blocks: mandatory + official profile combinations. */
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

/** Official ENT profile subject pairs (as on test.gov.kz style forms). */
export const ENT_PROFILE_COMBOS: Array<{
  id: string;
  subject1: string;
  subject2: string;
  labelKz: string;
  labelRu: string;
}> = [
  {
    id: "creative",
    subject1: "Шығармашылық емтихан",
    subject2: "Шығармашылық емтихан",
    labelKz: "Шығармашылық емтихан - Шығармашылық емтихан",
    labelRu: "Творческий экзамен - Творческий экзамен",
  },
  {
    id: "world-history-law",
    subject1: "Дүние жүзі тарихы",
    subject2: "Құқық негіздері",
    labelKz: "Дүние жүзі тарихы - Құқық негіздері",
    labelRu: "Всемирная история - Основы права",
  },
  {
    id: "math-physics",
    subject1: "Математика",
    subject2: "Физика",
    labelKz: "Математика - Физика",
    labelRu: "Математика - Физика",
  },
  {
    id: "math-geography",
    subject1: "Математика",
    subject2: "География",
    labelKz: "Математика - География",
    labelRu: "Математика - География",
  },
  {
    id: "chem-physics",
    subject1: "Химия",
    subject2: "Физика",
    labelKz: "Химия - Физика",
    labelRu: "Химия - Физика",
  },
  {
    id: "bio-chem",
    subject1: "Биология",
    subject2: "Химия",
    labelKz: "Биология - Химия",
    labelRu: "Биология - Химия",
  },
  {
    id: "bio-geography",
    subject1: "Биология",
    subject2: "География",
    labelKz: "Биология - География",
    labelRu: "Биология - География",
  },
  {
    id: "geo-english",
    subject1: "География",
    subject2: "Ағылшын тілі",
    labelKz: "География - Ағылшын тілі",
    labelRu: "География - Английский язык",
  },
  {
    id: "geo-german",
    subject1: "География",
    subject2: "Неміс тілі",
    labelKz: "География - Неміс тілі",
    labelRu: "География - Немецкий язык",
  },
  {
    id: "geo-french",
    subject1: "География",
    subject2: "Француз тілі",
    labelKz: "География - Француз тілі",
    labelRu: "География - Французский язык",
  },
  {
    id: "world-history-geo",
    subject1: "Дүние жүзі тарихы",
    subject2: "География",
    labelKz: "Дүние жүзі тарихы - География",
    labelRu: "Всемирная история - География",
  },
  {
    id: "english-world-history",
    subject1: "Ағылшын тілі",
    subject2: "Дүние жүзі тарихы",
    labelKz: "Ағылшын тілі - Дүние жүзі тарихы",
    labelRu: "Английский язык - Всемирная история",
  },
  {
    id: "german-world-history",
    subject1: "Неміс тілі",
    subject2: "Дүние жүзі тарихы",
    labelKz: "Неміс тілі - Дүние жүзі тарихы",
    labelRu: "Немецкий язык - Всемирная история",
  },
  {
    id: "french-world-history",
    subject1: "Француз тілі",
    subject2: "Дүние жүзі тарихы",
    labelKz: "Француз тілі - Дүние жүзі тарихы",
    labelRu: "Французский язык - Всемирная история",
  },
  {
    id: "kazakh-lit",
    subject1: "Қазақ тілі",
    subject2: "Қазақ әдебиеті",
    labelKz: "Қазақ тілі - Қазақ әдебиеті",
    labelRu: "Казахский язык - Казахская литература",
  },
  {
    id: "russian-lit",
    subject1: "Орыс тілі",
    subject2: "Орыс әдебиеті",
    labelKz: "Орыс тілі - Орыс әдебиеті",
    labelRu: "Русский язык - Русская литература",
  },
  {
    id: "math-informatics",
    subject1: "Математика",
    subject2: "Информатика",
    labelKz: "Математика - Информатика",
    labelRu: "Математика - Информатика",
  },
];

/** Map various subject labels to a stable pool key. */
const SUBJECT_ALIASES: Array<{ key: string; patterns: RegExp[] }> = [
  { key: "математика", patterns: [/^математика$/, /^математика\s*\(/] },
  { key: "физика", patterns: [/^физика$/, /^физик/] },
  { key: "география", patterns: [/^география$/, /^географи/] },
  { key: "химия", patterns: [/^химия$/, /^хими/] },
  { key: "биология", patterns: [/^биология$/, /^биологи/] },
  {
    key: "ағылшын тілі",
    patterns: [/^ағылшын/, /^английск/, /^english/],
  },
  {
    key: "неміс тілі",
    patterns: [/^неміс/, /^немецк/, /^german/],
  },
  {
    key: "француз тілі",
    patterns: [/^француз/, /^french/],
  },
  {
    key: "дүние жүзі тарихы",
    patterns: [/^дүние\s*жүзі\s*тарих/, /^всемирн.*истор/, /^world\s*history/],
  },
  {
    key: "құқық негіздері",
    patterns: [/^құқық/, /^право/, /^основы\s*права/],
  },
  {
    key: "қазақ тілі",
    patterns: [/^қазақ\s*тілі$/, /^казахский\s*язык$/],
  },
  {
    key: "қазақ әдебиеті",
    patterns: [/^қазақ\s*әдебиет/, /^казахск.*литератур/],
  },
  {
    key: "орыс тілі",
    patterns: [/^орыс\s*тілі$/, /^русский\s*язык$/],
  },
  {
    key: "орыс әдебиеті",
    patterns: [/^орыс\s*әдебиет/, /^русск.*литератур/],
  },
  {
    key: "информатика",
    patterns: [/^информатика$/, /^информатик/],
  },
  {
    key: "шығармашылық емтихан",
    patterns: [/^шығармашылық/, /^творческ/],
  },
];

export function normalizeSubject(subject: string): string {
  return subject.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Canonical pool key for matching combo subjects ↔ tests in DB. */
export function subjectPoolKey(subject: string): string {
  const s = normalizeSubject(subject);
  for (const row of SUBJECT_ALIASES) {
    if (row.patterns.some((re) => re.test(s))) return row.key;
  }
  return s;
}

export function detectEntBlock(
  subject: string,
): Exclude<EntBlockKind, "profile"> | null {
  const s = normalizeSubject(subject);
  if (
    /история\s*казахстана|қазақстан\s*тарихы|^история$|^тарих$|history/.test(s)
  ) {
    return "history";
  }
  if (/грамотность\s*чтения|оқу\s*сауаттылығы|чтение|reading/.test(s)) {
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

export function getProfileCombo(id: string) {
  return ENT_PROFILE_COMBOS.find((c) => c.id === id) ?? null;
}

export const ENT_TOTAL_MINUTES = 240;
export const ENT_PROFILE_COUNT = 2;
/** Official ҰБТ cap: 20 + 10 + 10 + 50 + 50. */
export const ENT_TOTAL_MAX = 140;
export const ENT_PROFILE_ONE_POINT_COUNT = 30;
export const ENT_MAX_BY_BLOCK: Record<EntBlockKind, number> = {
  history: 20,
  reading: 10,
  math_literacy: 10,
  profile: 50,
};

export function blockMaxScore(block: EntBlockKind): number {
  return ENT_MAX_BY_BLOCK[block];
}

/** Profile Q1–30 = 1 point, Q31+ = 2 points. Mandatory blocks = 1 point each. */
export function questionWeight(block: EntBlockKind, index: number): number {
  if (block === "profile" && index >= ENT_PROFILE_ONE_POINT_COUNT) return 2;
  return 1;
}

export function groupTestsByEnt<T extends { subject: string }>(rows: T[]) {
  const byBlock: Record<Exclude<EntBlockKind, "profile">, T[]> = {
    history: [],
    reading: [],
    math_literacy: [],
  };
  const profileByKey = new Map<string, T[]>();

  for (const row of rows) {
    const block = detectEntBlock(row.subject);
    if (block) {
      byBlock[block].push(row);
      continue;
    }
    const key = subjectPoolKey(row.subject);
    if (!key) continue;
    const list = profileByKey.get(key) ?? [];
    list.push(row);
    profileByKey.set(key, list);
  }
  return { byBlock, profileByKey };
}

export interface EntPoolSubject {
  key: string;
  labelKz: string;
  labelRu: string;
  kind: "mandatory" | "profile";
  variantCount: number;
  ready: boolean;
}

export interface EntPoolCombination {
  id: string;
  labelKz: string;
  labelRu: string;
  subject1: string;
  subject2: string;
  ready: boolean;
  missing: string[];
  variantCount1: number;
  variantCount2: number;
}

export function uniqueProfileSubjects(): Array<{
  key: string;
  labelKz: string;
  labelRu: string;
}> {
  const seen = new Set<string>();
  const out: Array<{ key: string; labelKz: string; labelRu: string }> = [];
  for (const combo of ENT_PROFILE_COMBOS) {
    for (const labelKz of [combo.subject1, combo.subject2]) {
      const key = subjectPoolKey(labelKz);
      if (seen.has(key)) continue;
      seen.add(key);
      const ruCombo = ENT_PROFILE_COMBOS.find(
        (c) =>
          subjectPoolKey(c.subject1) === key ||
          subjectPoolKey(c.subject2) === key,
      );
      const labelRu = ruCombo
        ? subjectPoolKey(ruCombo.subject1) === key
          ? ruCombo.labelRu.split(" - ")[0]
          : ruCombo.labelRu.split(" - ")[1]
        : labelKz;
      out.push({ key, labelKz, labelRu: (labelRu ?? labelKz).trim() });
    }
  }
  return out;
}

export function buildEntPoolCoverage<T extends { subject: string }>(rows: T[]) {
  const { byBlock, profileByKey } = groupTestsByEnt(rows);

  const mandatory = (["history", "reading", "math_literacy"] as const).map(
    (key) => ({
      key,
      label: ENT_BLOCK_LABELS[key],
      variantCount: byBlock[key].length,
      ready: byBlock[key].length > 0,
    }),
  );

  const profileSubjects: EntPoolSubject[] = uniqueProfileSubjects().map(
    (row) => {
      const variantCount = (profileByKey.get(row.key) ?? []).length;
      return {
        ...row,
        kind: "profile" as const,
        variantCount,
        ready: variantCount > 0,
      };
    },
  );

  const combinations: EntPoolCombination[] = ENT_PROFILE_COMBOS.map((combo) => {
    const k1 = subjectPoolKey(combo.subject1);
    const k2 = subjectPoolKey(combo.subject2);
    const pool1 = profileByKey.get(k1) ?? [];
    const pool2 = profileByKey.get(k2) ?? [];
    const same = k1 === k2;
    const missing: string[] = [];
    if (pool1.length === 0) missing.push(combo.subject1);
    if (!same && pool2.length === 0) missing.push(combo.subject2);
    return {
      id: combo.id,
      labelKz: combo.labelKz,
      labelRu: combo.labelRu,
      subject1: combo.subject1,
      subject2: combo.subject2,
      ready: missing.length === 0,
      missing,
      variantCount1: pool1.length,
      variantCount2: pool2.length,
    };
  });

  return {
    mandatory,
    profileSubjects,
    combinations,
    missingMandatory: mandatory.filter((m) => !m.ready),
    missingProfile: profileSubjects.filter((s) => !s.ready),
    ready:
      mandatory.every((m) => m.ready) && combinations.some((c) => c.ready),
  };
}
