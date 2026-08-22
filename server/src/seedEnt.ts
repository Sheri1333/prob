/**
 * Seed one full ENT variant into MongoDB.
 * Run: npx tsx src/seedEnt.ts  (from server/)
 */
import { connectDb, closeDb, tests, type TestDoc } from "./db.js";
import { newTestId } from "./ids.js";
import type { Question } from "./scoring.js";

function single(
  id: number,
  text: string,
  options: [string, string, string, string],
  correct: "A" | "B" | "C" | "D",
): Question {
  return {
    id,
    type: "single_choice",
    text,
    options: [
      { id: "A", label: options[0] },
      { id: "B", label: options[1] },
      { id: "C", label: options[2] },
      { id: "D", label: options[3] },
    ],
    correctAnswer: correct,
  };
}

function padQuestions(
  base: Question[],
  count: number,
  prefix: string,
): Question[] {
  const out = [...base];
  let i = out.length;
  while (out.length < count) {
    i += 1;
    const letter = (["A", "B", "C", "D"] as const)[i % 4];
    out.push(
      single(
        i,
        `${prefix} — сұрақ ${i}`,
        [
          `Нұсқа A (${i})`,
          `Нұсқа B (${i})`,
          `Нұсқа C (${i})`,
          `Нұсқа D (${i})`,
        ],
        letter,
      ),
    );
  }
  return out.slice(0, count);
}

const historyQs = padQuestions(
  [
    single(
      1,
      "Қазақ хандығы қай жылы құрылды?",
      ["1465", "1456", "1511", "1718"],
      "A",
    ),
    single(
      2,
      "Абылай хан қай ғасырда өмір сүрді?",
      ["XV", "XVI", "XVIII", "XIX"],
      "C",
    ),
    single(
      3,
      "Қазақстан тәуелсіздігін қашан жариялады?",
      ["16 желтоқсан 1991", "25 қазан 1990", "30 тамыз 1995", "1 наурыз 1995"],
      "A",
    ),
    single(
      4,
      "Алтын Орданың негізін қалаған кім?",
      ["Шыңғыс хан", "Бату хан", "Тоқтамыс", "Едіге"],
      "B",
    ),
    single(
      5,
      "«Ақтабан шұбырынды» қай кезеңге жатады?",
      ["XVIII ғ.", "XVII ғ.", "XIX ғ.", "XVI ғ."],
      "A",
    ),
  ],
  20,
  "Қазақстан тарихы",
);

const readingQs = padQuestions(
  [
    single(
      1,
      "Мәтіннің негізгі идеясын анықтаңыз: автор оқудың пайдасын айтады.",
      ["Оқу зиянды", "Оқу дамытады", "Оқу қажетсіз", "Оқу тек балаларға"],
      "B",
    ),
    single(
      2,
      "«Синоним» дегеніміз не?",
      ["Қарама-қарсы сөз", "Мағынасы жақын сөз", "Бір түбірлі сөз", "Көп мағыналы сөз"],
      "B",
    ),
    single(
      3,
      "Мәтін стилі қандай болуы мүмкін?",
      ["Ғылыми", "Көркем", "Ресми", "Барлығы дұрыс"],
      "D",
    ),
    single(
      4,
      "Абзацтың қызметі?",
      ["Бір ойды топтастыру", "Сурет салу", "Сан жазу", "Түс қою"],
      "A",
    ),
    single(
      5,
      "Қорытынды сөйлем әдетте қайда тұрады?",
      ["Басында", "Ортасында", "Соңында", "Тақырыпта"],
      "C",
    ),
  ],
  20,
  "Оқу сауаттылығы",
);

const mathLitQs = padQuestions(
  [
    single(1, "15% от 200 равна:", ["20", "30", "15", "25"], "B"),
    single(1, "2/5 + 1/5 =", ["3/5", "3/10", "1/5", "2/10"], "A"),
    single(1, "Среднее арифметическое 4, 6, 8:", ["6", "5", "7", "18"], "A"),
    single(1, "Площадь квадрата со стороной 5:", ["20", "25", "10", "15"], "B"),
    single(1, "3² × 2 =", ["12", "18", "9", "6"], "B"),
  ].map((q, idx) => ({ ...q, id: idx + 1 })),
  20,
  "Математикалық сауаттылық",
);

const geographyQs = padQuestions(
  [
    single(
      1,
      "Қазақстанның астанасы",
      ["Алматы", "Астана", "Шымкент", "Атырау"],
      "B",
    ),
    single(
      2,
      "Ең үлкен көл (ішінара Қазақстанда)",
      ["Балқаш", "Каспий", "Алакөл", "Зайсан"],
      "B",
    ),
    single(
      3,
      "Қазақстанның климаты негізінен",
      ["Теңіздік", "Континенттік", "Экваторлық", "Муссондық"],
      "B",
    ),
    single(
      4,
      "Ең биік шың",
      ["Хан Тәңірі", "Белуха", "Эльбрус", "Алатау"],
      "A",
    ),
    single(
      5,
      "Қазақстан қанша облыстан тұрады (қазіргі әкімшілік)?",
      ["14", "16", "17", "20"],
      "C",
    ),
  ],
  40,
  "География",
);

const physicsQs = padQuestions(
  [
    single(1, "SI единица силы:", ["Ньютон", "Джоуль", "Ватт", "Паскаль"], "A"),
    single(1, "Скорость света ≈", ["3·10⁸ м/с", "3·10⁶ м/с", "340 м/с", "1500 м/с"], "A"),
    single(1, "Закон Ома: I =", ["U/R", "U·R", "R/U", "U²/R"], "A"),
    single(1, "Ускорение свободного падения ≈", ["9.8 м/с²", "10 км/с", "6.7", "1 м/с²"], "A"),
    single(1, "Единица мощности:", ["Вт", "Н", "Кл", "Ом"], "A"),
  ].map((q, idx) => ({ ...q, id: idx + 1 })),
  40,
  "Физика",
);

const mathQs = padQuestions(
  [
    single(1, "log₂ 8 =", ["2", "3", "4", "8"], "B"),
    single(1, "Производная x²:", ["x", "2x", "2", "x²"], "B"),
    single(1, "sin 90° =", ["0", "1", "0.5", "−1"], "B"),
    single(1, "Корни x² − 5x + 6 = 0:", ["2 и 3", "1 и 6", "−2 и −3", "0 и 5"], "A"),
    single(1, "Площадь круга радиуса r:", ["πr", "2πr", "πr²", "πd"], "C"),
  ].map((q, idx) => ({ ...q, id: idx + 1 })),
  40,
  "Математика",
);

type SeedSpec = {
  subject: string;
  title: string;
  titleKz: string;
  durationMinutes: number;
  questions: Question[];
};

const SPECS: SeedSpec[] = [
  {
    subject: "История Казахстана",
    title: "ЕНТ — История Казахстана (вариант 1)",
    titleKz: "ҰБТ — Қазақстан тарихы (1-нұсқа)",
    durationMinutes: 35,
    questions: historyQs,
  },
  {
    subject: "Грамотность чтения",
    title: "ЕНТ — Грамотность чтения (вариант 1)",
    titleKz: "ҰБТ — Оқу сауаттылығы (1-нұсқа)",
    durationMinutes: 35,
    questions: readingQs,
  },
  {
    subject: "Математическая грамотность",
    title: "ЕНТ — Математическая грамотность (вариант 1)",
    titleKz: "ҰБТ — Математикалық сауаттылық (1-нұсқа)",
    durationMinutes: 40,
    questions: mathLitQs,
  },
  {
    subject: "География",
    title: "ЕНТ — География (вариант 1)",
    titleKz: "ҰБТ — География (1-нұсқа)",
    durationMinutes: 50,
    questions: geographyQs,
  },
  {
    subject: "Физика",
    title: "ЕНТ — Физика (вариант 1)",
    titleKz: "ҰБТ — Физика (1-нұсқа)",
    durationMinutes: 50,
    questions: physicsQs,
  },
  {
    subject: "Математика",
    title: "ЕНТ — Математика (вариант 1)",
    titleKz: "ҰБТ — Математика (1-нұсқа)",
    durationMinutes: 50,
    questions: mathQs,
  },
];

async function upsertBySubject(spec: SeedSpec): Promise<string> {
  const existing = await tests().findOne({
    subject: spec.subject,
    title: spec.title,
  });
  const now = new Date();
  const id = existing?._id ?? newTestId();
  const doc: TestDoc = {
    _id: id,
    title: spec.title,
    titleKz: spec.titleKz,
    section: spec.subject,
    examType: "ENT",
    subject: spec.subject,
    durationMinutes: spec.durationMinutes,
    questionCount: spec.questions.length,
    isFree: true,
    priceTenge: null,
    description: "Тестовый вариант для пробного полного ЕНТ",
    coverImage: "",
    questions: spec.questions,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await tests().replaceOne({ _id: id }, doc, { upsert: true });
  return id;
}

async function main() {
  await connectDb();
  console.log("Seeding ENT variant 1...");
  for (const spec of SPECS) {
    const id = await upsertBySubject(spec);
    console.log(
      `✓ ${spec.subject}: ${spec.questions.length} Q → ${id}`,
    );
  }
  console.log("Done. Выберите «Математика - Физика» или «Математика - География».");
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
