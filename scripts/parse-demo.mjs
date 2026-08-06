/**
 * Demo parser for ENT-style Kazakh PDF tests (e.g. 28.05.2025!.pdf)
 */
import fs from "fs";
import { PDFParse } from "pdf-parse";

const LETTER_MAP = {
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

function normalizeLetter(raw) {
  const u = raw.toUpperCase();
  return LETTER_MAP[u] || u;
}

function cleanText(s) {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim();
}

function stripPageMarkers(text) {
  return text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "\n");
}

function detectSections(text) {
  const markers = [
    { key: "single", re: /Біржауапты\s+сұрақтар/i },
    { key: "matching", re: /Сәйкестендіру/i },
    { key: "multi", re: /Көпжауапты\s+сұрақтар/i },
  ];
  const hits = [];
  for (const m of markers) {
    const match = m.re.exec(text);
    if (match) hits.push({ key: m.key, index: match.index, label: match[0] });
  }
  hits.sort((a, b) => a.index - b.index);
  const sections = [];
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index;
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    sections.push({
      key: hits[i].key,
      label: hits[i].label,
      text: text.slice(start, end),
    });
  }
  return sections;
}

function extractContextBlocks(sectionText) {
  const blocks = [];
  const re = /КОНТЕКСТ\s+[“"]([^”"]+)[”"]([\s\S]*?)(?=\n\d+\.\s|$)/gi;
  let m;
  while ((m = re.exec(sectionText))) {
    blocks.push({
      title: m[1].trim(),
      text: cleanText(m[2]),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return blocks;
}

function splitQuestions(sectionText, { minId = 1, idPattern = null } = {}) {
  const withoutHeader = sectionText.replace(
    /^(Біржауапты\s+сұрақтар|Сәйкестендіру|Көпжауапты\s+сұрақтар)\s*/i,
    "",
  );
  // idPattern: e.g. \\d{2,} so matching rows "1." "2." are not boundaries
  const boundary = idPattern
    ? new RegExp(`(?=^${idPattern}\\.\\s)`, "m")
    : /(?=^\d+\.\s)/m;
  const parts = withoutHeader.split(boundary).filter((p) => p.trim());
  return parts
    .map((chunk) => {
      const idMatch = chunk.match(/^(\d+)\.\s*/);
      const id = idMatch ? Number(idMatch[1]) : 0;
      const body = chunk.replace(/^\d+\.\s*/, "");
      return { id, raw: body };
    })
    .filter((q) => q.id >= minId);
}

function parseOptions(body) {
  const optionRe =
    /(?:^|\n)\s*([A-Fa-fА-Фа-ф])\)\s*/g;
  const indices = [];
  let m;
  while ((m = optionRe.exec(body))) {
    indices.push({ letter: normalizeLetter(m[1]), index: m.index, matchLen: m[0].length });
  }
  if (indices.length === 0) return { prompt: cleanText(body), options: [] };

  const prompt = cleanText(body.slice(0, indices[0].index));
  const options = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i].index + indices[i].matchLen;
    const end = i + 1 < indices.length ? indices[i + 1].index : body.length;
    let label = cleanText(body.slice(start, end));
    // Context block sometimes leaks into the last option
    label = label.replace(/КОНТЕКСТ[\s\S]*$/i, "").trim();
    options.push({
      id: indices[i].letter,
      label,
    });
  }
  return { prompt, options };
}

function parseMatching(body) {
  const firstOpt = body.search(/(?:^|\n)\s*[A-Fa-fА-Фа-ф]\)/);
  const head = firstOpt >= 0 ? body.slice(0, firstOpt) : body;
  const optPart = firstOpt >= 0 ? body.slice(firstOpt) : "";

  const rows = [];
  const rowRe = /(\d+)\.\s+([^\n]+)/g;
  let rm;
  while ((rm = rowRe.exec(head))) {
    rows.push({
      id: String.fromCharCode(64 + Number(rm[1])),
      label: cleanText(rm[2]),
    });
  }

  const text = cleanText(head.replace(/(\d+)\.\s+[^\n]+/g, " "));
  const { options } = parseOptions(optPart || body);

  return { text: text || `Сәйкестендіру`, rows, options };
}

function parsePdfText(rawText) {
  const steps = [];
  const text = stripPageMarkers(rawText);
  steps.push({
    step: 1,
    name: "Извлечение текста",
    detail: `${rawText.length} символов → убраны маркеры страниц`,
  });

  const sections = detectSections(text);
  steps.push({
    step: 2,
    name: "Секции",
    detail: sections.map((s) => s.label).join(" · "),
    counts: Object.fromEntries(sections.map((s) => [s.key, s.text.length])),
  });

  const questions = [];
  const contexts = [];

  for (const section of sections) {
    if (section.key === "single") {
      const ctx = extractContextBlocks(section.text);
      contexts.push(...ctx);
      const chunks = splitQuestions(section.text, { minId: 1 });
      for (const chunk of chunks) {
        if (!chunk.id) continue;
        const { prompt, options } = parseOptions(chunk.raw);
        // skip context-only false positives
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
      // Matching rows are "1." "2." — real questions are two-digit (31–35)
      const chunks = splitQuestions(section.text, {
        minId: 31,
        idPattern: "\\d{2,}",
      });
      for (const chunk of chunks) {
        if (!chunk.id) continue;
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
      const chunks = splitQuestions(section.text, { minId: 36 });
      for (const chunk of chunks) {
        if (!chunk.id) continue;
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

  steps.push({
    step: 3,
    name: "Вопросы",
    detail: `${questions.length} вопросов распознано`,
  });
  steps.push({
    step: 4,
    name: "Контексты",
    detail: contexts.length
      ? contexts.map((c) => c.title).join(", ")
      : "нет",
  });

  const byType = {
    single_choice: questions.filter((q) => q.type === "single_choice").length,
    matching: questions.filter((q) => q.type === "matching").length,
    multiple_choice: questions.filter((q) => q.type === "multiple_choice").length,
  };
  const withImages = questions.filter((q) => q.hasImageHint).length;

  steps.push({
    step: 5,
    name: "Итог",
    detail: `single=${byType.single_choice}, matching=${byType.matching}, multi=${byType.multiple_choice}, с картинками (по тексту)=${withImages}`,
  });

  return { steps, sections: sections.map((s) => ({ key: s.key, label: s.label, chars: s.text.length })), contexts, questions, byType, withImages };
}

const buf = fs.readFileSync("C:/Users/sheri/Downloads/28.05.2025!.pdf");
const parser = new PDFParse({ data: buf });
const pdf = await parser.getText();
const result = parsePdfText(pdf.text);

fs.writeFileSync(
  "C:/PROB/tmp-parse-result.json",
  JSON.stringify(result, null, 2),
  "utf8",
);

console.log(JSON.stringify({
  steps: result.steps,
  byType: result.byType,
  withImages: result.withImages,
  questionCount: result.questions.length,
  sample: result.questions.filter((q) => [1, 31, 36].includes(q.id)),
}, null, 2));
