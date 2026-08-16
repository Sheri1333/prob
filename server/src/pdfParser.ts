import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import type { Question } from "./scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, "..", "data", "uploads");

const LETTER_MAP: Record<string, string> = {
  А: "A",
  В: "B",
  С: "C",
  Е: "E",
  Н: "H",
  К: "K",
  М: "M",
  О: "O",
  Р: "P",
  Т: "T",
  Х: "X",
};

export interface ParsedQuestion {
  id: number;
  type: "single_choice" | "multiple_choice" | "matching";
  text: string;
  options: { id: string; label: string }[];
  rows?: { id: string; label: string }[];
  hasImageHint: boolean;
  /** data: URLs for preview, or /uploads/... after persist */
  images?: string[];
}

export interface ParsePdfResult {
  pages: number;
  chars: number;
  steps: { step: number; name: string; detail: string }[];
  sections: { key: string; label: string; chars: number }[];
  contexts: { title: string; text: string }[];
  questions: ParsedQuestion[];
  byType: {
    single_choice: number;
    matching: number;
    multiple_choice: number;
  };
  withImages: number;
  imagesAttached: number;
}

function normalizeLetter(raw: string): string {
  const u = raw.toUpperCase();
  return LETTER_MAP[u] || u;
}

function cleanText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim();
}

function stripPageMarkers(text: string): string {
  return text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "\n");
}

function detectSections(text: string) {
  const markers = [
    { key: "single", re: /Біржауапты\s+сұрақтар/i },
    { key: "matching", re: /Сәйкестендіру/i },
    { key: "multi", re: /Көпжауапты\s+сұрақтар/i },
  ];
  const hits: { key: string; index: number; label: string }[] = [];
  for (const m of markers) {
    const match = m.re.exec(text);
    if (match) hits.push({ key: m.key, index: match.index, label: match[0] });
  }
  hits.sort((a, b) => a.index - b.index);
  return hits.map((h, i) => ({
    key: h.key,
    label: h.label,
    text: text.slice(h.index, i + 1 < hits.length ? hits[i + 1].index : text.length),
  }));
}

function extractContextBlocks(sectionText: string) {
  const blocks: { title: string; text: string }[] = [];
  const re = /КОНТЕКСТ\s+[“"]([^”"]+)[”"]([\s\S]*?)(?=\n\d+\.\s|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sectionText))) {
    blocks.push({ title: m[1].trim(), text: cleanText(m[2]) });
  }
  return blocks;
}

function splitQuestions(
  sectionText: string,
  { minId = 1, idPattern = null as string | null } = {},
) {
  const withoutHeader = sectionText.replace(
    /^(Біржауапты\s+сұрақтар|Сәйкестендіру|Көпжауапты\s+сұрақтар)\s*/i,
    "",
  );
  const boundary = idPattern
    ? new RegExp(`(?=^${idPattern}\\.\\s)`, "m")
    : /(?=^\d+\.\s)/m;
  return withoutHeader
    .split(boundary)
    .filter((p) => p.trim())
    .map((chunk) => {
      const idMatch = chunk.match(/^(\d+)\.\s*/);
      const id = idMatch ? Number(idMatch[1]) : 0;
      return { id, raw: chunk.replace(/^\d+\.\s*/, "") };
    })
    .filter((q) => q.id >= minId);
}

function parseOptions(body: string) {
  const optionRe = /(?:^|\n)\s*([A-Fa-fА-Фа-ф])\)\s*/g;
  const indices: { letter: string; index: number; matchLen: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = optionRe.exec(body))) {
    indices.push({
      letter: normalizeLetter(m[1]),
      index: m.index,
      matchLen: m[0].length,
    });
  }
  if (indices.length === 0) {
    return { prompt: cleanText(body), options: [] as { id: string; label: string }[] };
  }

  const prompt = cleanText(body.slice(0, indices[0].index));
  const options = indices.map((item, i) => {
    const start = item.index + item.matchLen;
    const end = i + 1 < indices.length ? indices[i + 1].index : body.length;
    let label = cleanText(body.slice(start, end));
    label = label.replace(/КОНТЕКСТ[\s\S]*$/i, "").trim();
    return { id: item.letter, label };
  });
  return { prompt, options };
}

/** Left column is 1. 2. …, right column is A) B) C) D). Parser never guesses pairs. */
function parseMatching(body: string) {
  const firstOpt = body.search(/(?:^|\n)\s*[A-Fa-fА-Фа-ф]\)/);
  const head = firstOpt >= 0 ? body.slice(0, firstOpt) : body;
  const optPart = firstOpt >= 0 ? body.slice(firstOpt) : "";

  const hits: { n: number; index: number; matchLen: number }[] = [];
  const rowRe = /(\d+)[.)]\s+/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(head))) {
    const n = Number(rm[1]);
    if (n >= 1 && n <= 6) {
      hits.push({ n, index: rm.index, matchLen: rm[0].length });
    }
  }

  const startIdx = hits.findIndex((h) => h.n === 1);
  const run: typeof hits = [];
  if (startIdx >= 0) {
    run.push(hits[startIdx]);
    for (let i = startIdx + 1; i < hits.length; i++) {
      if (hits[i].n === run[run.length - 1].n + 1) run.push(hits[i]);
      else break;
    }
  }

  const prompt = cleanText(
    run.length > 0 ? head.slice(0, run[0].index) : head,
  );
  const rows = run.map((item, i) => {
    const start = item.index + item.matchLen;
    const end = i + 1 < run.length ? run[i + 1].index : head.length;
    return { id: String(item.n), label: cleanText(head.slice(start, end)) };
  });

  const { options } = parseOptions(optPart || body);
  return { text: prompt || "Сәйкестендіру", rows, options };
}

function buildQuestionsFromText(rawText: string) {
  const text = stripPageMarkers(rawText);
  const sections = detectSections(text);
  const questions: ParsedQuestion[] = [];
  const contexts: { title: string; text: string }[] = [];

  for (const section of sections) {
    if (section.key === "single") {
      contexts.push(...extractContextBlocks(section.text));
      for (const chunk of splitQuestions(section.text, { minId: 1 })) {
        const { prompt, options } = parseOptions(chunk.raw);
        if (options.length < 2) continue;
        questions.push({
          id: chunk.id,
          type: "single_choice",
          text: prompt,
          options,
          hasImageHint: /сурет|карта|кесте/i.test(prompt),
        });
      }
    } else if (section.key === "matching") {
      for (const chunk of splitQuestions(section.text, {
        minId: 31,
        idPattern: "\\d{2,}",
      })) {
        const parsed = parseMatching(chunk.raw);
        if (parsed.options.length < 2) continue;
        questions.push({
          id: chunk.id,
          type: "matching",
          text: parsed.text || `Сәйкестендіру №${chunk.id}`,
          rows: parsed.rows,
          options: parsed.options,
          hasImageHint: false,
        });
      }
    } else if (section.key === "multi") {
      for (const chunk of splitQuestions(section.text, { minId: 36 })) {
        const { prompt, options } = parseOptions(chunk.raw);
        if (options.length < 2) continue;
        questions.push({
          id: chunk.id,
          type: "multiple_choice",
          text: prompt,
          options,
          hasImageHint: /сурет|карта|кесте/i.test(prompt),
        });
      }
    }
  }

  questions.sort((a, b) => a.id - b.id);
  return {
    questions,
    contexts,
    sections: sections.map((s) => ({
      key: s.key,
      label: s.label,
      chars: s.text.length,
    })),
  };
}

/**
 * Assign embedded page images to questions that mention image/map/table,
 * using page text to know which questions sit on which page.
 */
function attachImagesToQuestions(
  questions: ParsedQuestion[],
  pageTexts: { num: number; text: string }[],
  pageImages: { pageNumber: number; images: { dataUrl: string; width: number; height: number }[] }[],
): number {
  const knownIds = new Set(questions.map((q) => q.id));
  const byId = new Map(questions.map((q) => [q.id, q]));
  let attached = 0;

  for (const page of pageTexts) {
    const imgPage = pageImages.find((p) => p.pageNumber === page.num);
    if (!imgPage || imgPage.images.length === 0) continue;

    // Question starts on this page: "14. " but ignore matching row "1." "2."
    const foundIds = [
      ...page.text.matchAll(/(?:^|\n)(\d+)\.\s/g),
    ]
      .map((m) => Number(m[1]))
      .filter((id) => knownIds.has(id));

    // unique, keep order
    const pageQuestionIds = [...new Set(foundIds)];
    let hintQs = pageQuestionIds
      .map((id) => byId.get(id)!)
      .filter((q) => q.hasImageHint);

    // If page has images but no text-hint questions, skip
    if (hintQs.length === 0) continue;

    const pool = [...imgPage.images];
    if (hintQs.length === 1) {
      // all images on page belong to this question (e.g. two photos)
      hintQs[0].images = pool.map((i) => i.dataUrl);
      attached += pool.length;
    } else {
      // one image per hint question in order; extras go to first
      for (let i = 0; i < hintQs.length; i++) {
        const img = pool[i] ?? pool[pool.length - 1];
        if (!img) break;
        hintQs[i].images = [...(hintQs[i].images ?? []), img.dataUrl];
        attached += 1;
      }
      if (pool.length > hintQs.length) {
        const extra = pool.slice(hintQs.length).map((i) => i.dataUrl);
        hintQs[0].images = [...(hintQs[0].images ?? []), ...extra];
        attached += extra.length;
      }
    }
  }

  return attached;
}

export function parsePdfText(rawText: string, pages = 0): ParsePdfResult {
  const built = buildQuestionsFromText(rawText);
  const byType = {
    single_choice: built.questions.filter((q) => q.type === "single_choice").length,
    matching: built.questions.filter((q) => q.type === "matching").length,
    multiple_choice: built.questions.filter((q) => q.type === "multiple_choice").length,
  };
  const withImages = built.questions.filter((q) => q.hasImageHint).length;

  return {
    pages,
    chars: rawText.length,
    steps: [
      { step: 1, name: "Извлечение текста", detail: `${rawText.length} символов` },
      {
        step: 2,
        name: "Секции",
        detail: built.sections.map((s) => s.label).join(" · ") || "не найдены",
      },
      { step: 3, name: "Вопросы", detail: `${built.questions.length} распознано` },
      {
        step: 4,
        name: "Итог",
        detail: `single=${byType.single_choice}, matching=${byType.matching}, multi=${byType.multiple_choice}, нуждаются в картинке=${withImages}`,
      },
    ],
    sections: built.sections,
    contexts: built.contexts,
    questions: built.questions,
    byType,
    withImages,
    imagesAttached: 0,
  };
}

/** Convert parsed questions into DB-ready Question[]. */
export function toTestQuestions(parsed: ParsedQuestion[]): Question[] {
  return parsed.map((q) => {
    const images = q.images?.length ? q.images : undefined;
    if (q.type === "single_choice") {
      return {
        id: q.id,
        type: "single_choice" as const,
        text: q.text,
        options: q.options,
        correctAnswer: "",
        images,
      };
    }
    if (q.type === "multiple_choice") {
      return {
        id: q.id,
        type: "multiple_choice" as const,
        text: q.text,
        options: q.options,
        correctAnswers: [] as string[],
        images,
      };
    }
    return {
      id: q.id,
      type: "matching" as const,
      text: q.text,
      rows: q.rows ?? [],
      options: q.options,
      correctAnswers: {} as Record<string, string>,
      images,
    };
  });
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsePdfResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    const imageResult = await parser.getImage({
      imageThreshold: 40,
      imageDataUrl: true,
      imageBuffer: false,
    });

    const result = parsePdfText(textResult.text, textResult.total ?? 0);

    const pageTexts = (textResult.pages ?? []).map((p) => ({
      num: p.num,
      text: p.text,
    }));
    const pageImages = (imageResult.pages ?? []).map((p) => ({
      pageNumber: p.pageNumber,
      images: p.images
        .filter((img) => img.dataUrl && img.width >= 40 && img.height >= 40)
        .map((img) => ({
          dataUrl: img.dataUrl,
          width: img.width,
          height: img.height,
        })),
    }));

    const attached = attachImagesToQuestions(
      result.questions,
      pageTexts,
      pageImages,
    );
    result.imagesAttached = attached;
    result.withImages = result.questions.filter(
      (q) => (q.images?.length ?? 0) > 0 || q.hasImageHint,
    ).length;
    result.steps.push({
      step: 5,
      name: "Картинки",
      detail: `извлечено и привязано: ${attached}`,
    });

    return result;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/** Persist data:image URLs to disk and rewrite to /uploads/tests/{testId}/... */
export function materializeQuestionImages(
  testId: string,
  questions: Question[],
): Question[] {
  const safeId = testId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const dir = path.join(UPLOADS_DIR, "tests", safeId);
  fs.mkdirSync(dir, { recursive: true });

  return questions.map((q) => {
    if (!q.images?.length) return q;
    const saved: string[] = [];
    q.images.forEach((src, idx) => {
      if (src.startsWith("/uploads/")) {
        saved.push(src);
        return;
      }
      const m = /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i.exec(src);
      if (!m) {
        saved.push(src);
        return;
      }
      const ext = m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
      const filename = `q${q.id}_${idx}.${ext}`;
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, Buffer.from(m[2], "base64"));
      saved.push(`/uploads/tests/${safeId}/${filename}`);
    });
    return { ...q, images: saved };
  });
}

export function slugFromFilename(name: string): string {
  return (
    name
      .replace(/\.pdf$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9а-яёәіңғүұқөһ]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `test-${Date.now()}`
  );
}
