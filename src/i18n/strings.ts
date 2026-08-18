export type Lang = "kz" | "ru";

const strings = {
  section: { kz: "Бөлім", ru: "Раздел" },
  prevQuestion: { kz: "Артқа", ru: "Назад" },
  nextQuestion: { kz: "Келесі", ru: "Далее" },
  finishTest: { kz: "Аяқтау", ru: "Завершить" },
  exitTest: { kz: "Шығу", ru: "Выход" },
  questionMap: { kz: "Сұрақтар картасы", ru: "Карта вопросов" },
  zoomImage: { kz: "Үлкейту", ru: "Увеличить" },
  confirmExit: {
    kz: "Тесттен шығу керек пе? Жауаптар осы құрылғыда сақталады.",
    ru: "Выйти из теста? Ответы сохранятся на этом устройстве.",
  },
  chooseAnswer: { kz: "Жауапты таңдаңыз", ru: "Выберите ответ" },
  catalog: { kz: "", ru: "" },
  startTest: { kz: "Тестті бастау", ru: "Начать тест" },
  free: { kz: "Тегін", ru: "Бесплатно" },
  minutes: { kz: "мин", ru: "мин" },
  questions: { kz: "сұрақ", ru: "вопросов" },
  timer: { kz: "Уақыт", ru: "Время" },
  results: { kz: "Нәтижелер", ru: "Результаты" },
  score: { kz: "Балл", ru: "Балл" },
  correct: { kz: "Дұрыс", ru: "Верно" },
  incorrect: { kz: "Қате", ru: "Неверно" },
  unanswered: { kz: "Жауапсыз", ru: "Без ответа" },
  backToCatalog: { kz: "Кatalogқа оралу", ru: "В каталог" },
  history: { kz: "Тарих", ru: "История" },
  yourAnswer: { kz: "Сіздің жауабыңыз", ru: "Ваш ответ" },
  correctAnswer: { kz: "Дұрыс жауап", ru: "Правильный ответ" },
  entGrade: { kz: "ҰБТ баллы", ru: "Балл ЕНТ" },
  answered: { kz: "Жауап берілді", ru: "Отвечено" },
  of: { kz: "дан", ru: "из" },
  heroTitle: {
    kz: "Пробное тестирование ЕНТ",
    ru: "Пробное тестирование ЕНТ",
  },
  heroSubtitle: {
    kz: "Дайындық, таймер, автоматты бағалау және нәтиже тарихы",
    ru: "Подготовка, таймер, автоматическая оценка и история результатов",
  },
  watermark: { kz: "ПРОБНОЕ ТЕСТИРОВАНИЕ", ru: "ПРОБНОЕ ТЕСТИРОВАНИЕ" },
  timeUp: { kz: "Уақыт аяқталды!", ru: "Время вышло!" },
  confirmFinish: {
    kz: "Тестті аяқтау керек пе?",
    ru: "Завершить тест?",
  },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, lang: Lang): string {
  return strings[key][lang];
}
