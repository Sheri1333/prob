import type { Lang } from "./strings";

/**
 * Standard ENT/ҰБТ subject names. Admin-entered test data stores a single
 * (usually Russian) subject string, so we map the fixed, known set of
 * official subjects to their Kazakh names for display when lang="kz".
 * Unknown/custom subject strings pass through unchanged.
 */
const SUBJECT_KZ: Record<string, string> = {
  "история казахстана": "Қазақстан тарихы",
  "грамотность чтения": "Оқу сауаттылығы",
  "математическая грамотность": "Математикалық сауаттылық",
  математика: "Математика",
  физика: "Физика",
  химия: "Химия",
  биология: "Биология",
  география: "География",
  геометрия: "Геометрия",
  "всемирная история": "Дүниежүзі тарихы",
  "английский язык": "Ағылшын тілі",
  "казахский язык": "Қазақ тілі",
  "казахская литература": "Қазақ әдебиеті",
  "русский язык": "Орыс тілі",
  "русская литература": "Орыс әдебиеті",
  информатика: "Информатика",
  "основы права": "Құқық негіздері",
  "основы предпринимательства и бизнеса": "Кәсіпкерлік және бизнес негіздері",
};

const SUBJECT_RU: Record<string, string> = Object.fromEntries(
  Object.entries(SUBJECT_KZ).map(([ru, kz]) => [
    kz.toLowerCase(),
    ru.charAt(0).toUpperCase() + ru.slice(1),
  ]),
);
// Spelling used in the ENT combo list.
SUBJECT_RU["дүние жүзі тарихы"] = "Всемирная история";

/** Subject name in the UI language; works for Russian or Kazakh input. */
export function translateSubject(subject: string, lang: Lang): string {
  const key = subject.trim().toLowerCase();
  if (lang === "kz") return SUBJECT_KZ[key] ?? subject;
  return SUBJECT_RU[key] ?? subject;
}
