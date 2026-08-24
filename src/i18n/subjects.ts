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

export function translateSubject(subject: string, lang: Lang): string {
  if (lang !== "kz") return subject;
  const found = SUBJECT_KZ[subject.trim().toLowerCase()];
  return found ?? subject;
}
