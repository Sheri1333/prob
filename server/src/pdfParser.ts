import { PDFParse } from "pdf-parse";
import type { Question } from "./scoring.js";

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

function parseMatching(body: string) {
  const firstOpt = body.search(/(?:^|\n)\s*[A-Fa-fА-Фа-ф]\)/);
  const head = firstOpt >= 0 ? body.slice(0, firstOpt) : body;
  const optPart = firstOpt >= 0 ? body.slice(firstOpt) : "";

  const rows: { id: string; label: string }[] = [];
  const rowRe = /(\d+)\.\s+([^\n]+)/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(head))) {
    rows.push({
      id: String.fromCharCode(64 + Number(rm[1])),
      label: cleanText(rm[2]),
    });
  }

  const text = cleanText(head.replace(/(\d+)\.\s+[^\n]+/g, " "));
  const { options } = parseOptions(optPart || body);
  return { text: text || "Сәйкестендіру", rows, options };
}

export function parsePdfText(rawText: string, pages = 0): ParsePdfResult {
  const steps: ParsePdfResult["steps"] = [];
  const text = stripPageMarkers(rawText);
  steps.push({
    step: 1,
    name: "Извлечение текста",
    detail: `${rawText.length} символов`,
  });

  const sections = detectSections(text);
  steps.push({
    step: 2,
    name: "Секции",
    detail: sections.map((s) => s.label).join(" · ") || "не найдены",
  });

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

  const byType = {
    single_choice: questions.filter((q) => q.type === "single_choice").length,
    matching: questions.filter((q) => q.type === "matching").length,
    multiple_choice: questions.filter((q) => q.type === "multiple_choice").length,
  };
  const withImages = questions.filter((q) => q.hasImageHint).length;

  steps.push({
    step: 3,
    name: "Вопросы",
    detail: `${questions.length} распознано`,
  });
  steps.push({
    step: 4,
    name: "Итог",
    detail: `single=${byType.single_choice}, matching=${byType.matching}, multi=${byType.multiple_choice}, картинки≈${withImages}`,
  });

  return {
    pages,
    chars: rawText.length,
    steps,
    sections: sections.map((s) => ({
      key: s.key,
      label: s.label,
      chars: s.text.length,
    })),
    contexts,
    questions,
    byType,
    withImages,
  };
}

/** Convert parsed questions into DB-ready Question[] (answers empty — fill later). */
export function toTestQuestions(parsed: ParsedQuestion[]): Question[] {
  return parsed.map((q) => {
    if (q.type === "single_choice") {
      return {
        id: q.id,
        type: "single_choice" as const,
        text: q.text,
        options: q.options,
        correctAnswer: "",
      };
    }
    if (q.type === "multiple_choice") {
      return {
        id: q.id,
        type: "multiple_choice" as const,
        text: q.text,
        options: q.options,
        correctAnswers: [] as string[],
      };
    }
    return {
      id: q.id,
      type: "matching" as const,
      text: q.text,
      rows: q.rows ?? [],
      options: q.options,
      correctAnswers: {} as Record<string, string>,
    };
  });
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsePdfResult> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return parsePdfText(result.text, result.total ?? 0);
}

export function slugFromFilename(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яёәіңғүұқөһ]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `test-${Date.now()}`;
}
