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
const SUBJECT_ALIASES: Array<{ key: string; patterns: RegExp }> = [
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
