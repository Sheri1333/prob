import { parseDocxBuffer } from "./docxParser.js";
import { parsePdfBuffer, toTestQuestions } from "./pdfParser.js";
import { isAnswerKeyComplete, type Question } from "./scoring.js";
import { buildTests, fromDocLine } from "./testBuilder.js";
import { countQuestionMarkers, importPdfAsImages, mathSymbolCount } from "./pdfQuestionImages.js";

export interface ImportedVariant {
  label: string;
  questions: Question[];
  keyed: number;
}

export interface ImportedFile {
  kind: "pdf" | "docx";
  pages: number;
  title: string;
  subject: string;
  steps: { step: number; name: string; detail: string }[];
  variants: ImportedVariant[];
}

/** Official ENT subject names (Kazakh), recognised from a title or file name. */
const SUBJECTS: Array<[RegExp, string]> = [
  [/қазақстан\s*тарих|история\s*казахстана|қаз\.?\s*тарих/i, "Қазақстан тарихы"],
  [/оқу\s*сауат|грамотность\s*чтения/i, "Оқу сауаттылығы"],
  [/математикалық\s*сауат|мат\w*\s*грамотн/i, "Математикалық сауаттылық"],
  [/дүние\s*жүзі|дүниежүзі|\bджт\b|всемирн/i, "Дүниежүзі тарихы"],
  [/биолог/i, "Биология"],
  [/информатик/i, "Информатика"],
  [/географ/i, "География"],
  [/хими/i, "Химия"],
  [/физик/i, "Физика"],
  [/математик/i, "Математика"],
  [/құқық|право/i, "Құқық негіздері"],
  [/ағылшын|англ/i, "Ағылшын тілі"],
  [/неміс|немец/i, "Неміс тілі"],
  [/француз/i, "Француз тілі"],
  [/орыс\s*әдебиет|русск\w*\s*литератур/i, "Орыс әдебиеті"],
  [/әдебиет|литератур/i, "Қазақ әдебиеті"],
  [/орыс\s*тіл|русск\w*\s*язык/i, "Орыс тілі"],
  [/тіл|язык/i, "Қазақ тілі"],
];

export function guessSubject(...sources: string[]): string {
  for (const source of sources) {
    // "ДЖТ_ҰБТжауаптарымен" — underscores are word breaks in file names.
    const text = source.replace(/[_]+/g, " ");
    for (const [re, name] of SUBJECTS) if (re.test(text)) return name;
  }
  return "";
}

function keyedCount(questions: Question[]): number {
  return questions.filter((q) => isAnswerKeyComplete(q)).length;
}

export async function importTestFile(buffer: Buffer, filename: string): Promise<ImportedFile> {
  const base = filename.replace(/\.(pdf|docx)$/i, "");
  if (/\.docx$/i.test(filename) || buffer.subarray(0, 2).toString() === "PK") {
    const doc = parseDocxBuffer(buffer);
    const built = buildTests(doc.lines.map(fromDocLine), { pdf: false });
    const variants = built.variants.map((v, i) => {
      const questions = toTestQuestions(v.questions);
      return {
        label: v.title || (built.variants.length > 1 ? `${i + 1}-нұсқа` : ""),
        questions,
        keyed: keyedCount(questions),
      };
    });
    const total = variants.reduce((n, v) => n + v.questions.length, 0);
    const keyed = variants.reduce((n, v) => n + v.keyed, 0);
    const marks = built.variants.reduce((n, v) => n + v.keys.fromMarks, 0);
    const list = built.variants.reduce((n, v) => n + v.keys.fromKeyList, 0);
    return {
      kind: "docx",
      pages: 0,
      title: built.title,
      subject: guessSubject(built.title, base),
      steps: [
        { step: 1, name: "Word", detail: `${doc.lines.length} абзацев и таблиц` },
        { step: 2, name: "Варианты", detail: String(variants.length) },
        { step: 3, name: "Вопросы", detail: `${total} распознано` },
        {
          step: 4,
          name: "Ключи",
          detail: `${keyed} из ${total}: по выделению ${marks}, из списка ответов ${list}`,
        },
        ...(doc.skippedImages
          ? [{ step: 5, name: "Картинки", detail: `${doc.skippedImages} в формате EMF/WMF — добавьте вручную` }]
          : []),
      ],
      variants,
    };
  }

  const parsed = await parsePdfBuffer(buffer);
  // Formula-heavy PDFs (maths) are unreadable as text: fractions fall apart
  // and fonts may be broken. Import each question as a picture instead.
  const numbered = countQuestionMarkers(parsed.text);
  const formulaHeavy = mathSymbolCount(parsed.text) > 30;
  if (numbered >= 5 && (formulaHeavy || parsed.questions.length < numbered * 0.8)) {
    const pictures = await importPdfAsImages(buffer);
    if (pictures.questions.length >= parsed.questions.length) {
      return {
        kind: "pdf",
        pages: pictures.pages,
        title: "",
        subject: guessSubject(base) || (formulaHeavy ? "Математика" : ""),
        steps: [
          { step: 1, name: "Режим", detail: "вопросы картинками (формулы сохраняются как в PDF)" },
          { step: 2, name: "Вопросы", detail: `${pictures.questions.length} из ${numbered}` },
          { step: 3, name: "Ключи", detail: "не размечены в PDF — вставьте списком (1-A 2-C … 31-A3,B4 36-ADF)" },
          ...pictures.warnings.map((w, i) => ({ step: 4 + i, name: "Внимание", detail: w })),
        ],
        variants: [{ label: "", questions: pictures.questions, keyed: 0 }],
      };
    }
  }
  const questions = toTestQuestions(parsed.questions);
  return {
    kind: "pdf",
    pages: parsed.pages,
    title: parsed.title,
    subject: guessSubject(parsed.title, base),
    steps: parsed.steps,
    variants: [{ label: "", questions, keyed: keyedCount(questions) }],
  };
}
