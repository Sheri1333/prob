/**
 * Turns a document (PDF text or Word paragraphs) into ENT questions.
 *
 * Works on lines that may carry "marks" (bold / highlight / colour) because
 * test authors mark the correct answers that way. Handles:
 *  - "1.Вопрос" / "1. Вопрос" / Word auto-numbering, options "A)", "А)", "A.", "a)"
 *  - reading passages and tables/pictures shared by several questions
 *  - matching in tables or in lines: I/II ↔ A–D, A/B ↔ 1–4, options repeated per row
 *  - answer keys from marks, "Жауабы: I – C; II – A" lines or a key section at the end
 *  - several variants in one file (numbering restarts at 1)
 */
import type { DocLine } from "./docxParser.js";

export interface ParsedQuestion {
  id: number;
  type: "single_choice" | "multiple_choice" | "matching";
  text: string;
  options: { id: string; label: string }[];
  rows?: { id: string; label: string }[];
  hasImageHint: boolean;
  /** data: URLs for preview, or /uploads/... after persist */
  images?: string[];
  /** Reading passage the question refers to ("## heading" + text / tables). */
  context?: string;
  detectedAnswer?: string;
  detectedAnswers?: string[];
  /** rowId → option ids, several joined with "," ("A,C"). */
  detectedMatch?: Record<string, string>;
}

export interface BuiltVariant {
  title: string;
  questions: ParsedQuestion[];
  contexts: { title: string; text: string }[];
  keys: { fromMarks: number; fromKeyList: number };
}

/** A line of text; `mask[i]` is 1 for marked chars, 0 for plain, 2 to ignore. */
export interface BLine {
  text: string;
  mask: Uint8Array;
  images: { src: string; floating: boolean }[];
  table?: BLine[][][];
}

export function plainLine(text: string): BLine {
  return { text, mask: new Uint8Array(text.length), images: [] };
}

export function fromDocLine(line: DocLine): BLine {
  const text = line.segments.map((s) => s.text).join("");
  const mask = new Uint8Array(text.length);
  let at = 0;
  for (const seg of line.segments) {
    const v = seg.math ? 2 : seg.bold || seg.highlight || seg.color ? 1 : 0;
    mask.fill(v, at, at + seg.text.length);
    at += seg.text.length;
  }
  return {
    text,
    mask,
    images: line.images,
    table: line.table?.map((row) => row.map((cell) => cell.map(fromDocLine))),
  };
}

/* ---------- small helpers ---------- */

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const LETTER_MAP: Record<string, string> = {
  А: "A", В: "B", С: "C", Д: "D", Е: "E", Ф: "F",
  а: "A", в: "B", с: "C", д: "D", е: "E", ф: "F",
};
const LETTER_CLASS = "A-Ha-hАВСДЕФавсдеф";

function letterIndex(raw: string): number {
  const ch = LETTER_MAP[raw] ?? raw.toUpperCase();
  return LETTERS.indexOf(ch);
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
function romanIndex(raw: string): number {
  // Cyrillic "І" is often typed instead of Latin "I".
  return ROMAN.indexOf(raw.replace(/І/g, "I").toUpperCase());
}

const CODE_HINT = /^\s*(def |for |while |if |elif |else:|return\b|print\(|import |class )|:\s*$/m;

/**
 * Collapse spaces; in program code (Python) keep each line's indentation,
 * since it changes the meaning of the program.
 */
function clean(s: string): string {
  const code = CODE_HINT.test(s);
  return s
    .split("\n")
    .map((line) => {
      const indent = code ? (/^[ \t ]*/.exec(line)?.[0] ?? "").replace(/\t/g, "    ").replace(/ /g, " ") : "";
      return indent + line.replace(/[ \t ]+/g, " ").trim();
    })
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Share of marked characters in [start, end), ignoring spaces and formulas. */
function markedRatio(line: BLine, start = 0, end = line.text.length): number {
  let marked = 0;
  let total = 0;
  for (let i = start; i < end; i++) {
    if (/\s/.test(line.text[i]) || line.mask[i] === 2) continue;
    total += 1;
    if (line.mask[i] === 1) marked += 1;
  }
  return total === 0 ? 0 : marked / total;
}

function tableToMarkdown(table: BLine[][][]): string {
  const rows = table.map((row) =>
    row.map((cell) => oneLine(cell.map((l) => l.text).join(" ")).replace(/\|/g, "/")),
  );
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const lines = [`| ${pad(rows[0]).join(" | ")} |`, `|${" --- |".repeat(width)}`];
  for (const r of rows.slice(1)) lines.push(`| ${pad(r).join(" | ")} |`);
  return lines.join("\n");
}

/** Lines of a table flattened row by row (for matching laid out as a table). */
function tableLines(table: BLine[][][]): BLine[] {
  return table.flatMap((row) => row.flatMap((cell) => cell));
}

const QUESTION_LINE = /^\s*(\d{1,3})\s*[.)]\s*/;
const OPTION_START = new RegExp(`^\\s*([${LETTER_CLASS}])\\s*(?:\\)|\\.(?=\\s))\\s*`);
// No \b here: in JS it only knows Latin letters, so "Жауаптары" never matched.
const KEY_HEADING =
  /^\s*(жауап(тар|тары)?(\s*(кілт|кесте)\S*)?|жауап\s*кілттері|дұрыс\s*жауаптар\S*|кілттер|ответы|ключи|ключ\s*ответ\S*)(?![а-яәіңғүұқөһё])/i;
const MATCHING_HINT = /сәйкест|соответств/i;
const MULTI_HINT = /\(\s*-\s*(дар|дер|тар|тер|лар|лер|лары|лері|дары|дері|тары|тері)\s*\)|бір немесе бірнеше|один или несколько/i;
const VARIANT_LINE = /нұсқа|вариант/i;
const INSTRUCTION = /белгілеңіз|таңдаңыз|тапсырма|жауапты|отметьте|выберите|задани/i;
const ANSWER_LINE = /^\s*жауабы?\s*[:：]/i;

function optionStart(line: BLine): { index: number; end: number; paren: boolean } | null {
  const m = OPTION_START.exec(line.text);
  if (!m) return null;
  const index = letterIndex(m[1]);
  return index < 0 ? null : { index, end: m[0].length, paren: m[0].includes(")") };
}

function optionLikeCount(lines: BLine[]): number {
  let n = 0;
  for (const line of lines) {
    if (line.table) n += optionLikeCount(tableLines(line.table));
    else if (optionStart(line)) n += 1;
  }
  return n;
}

/* ---------- matching ---------- */

type Kind = "letter" | "roman" | "number";
interface Token {
  kind: Kind;
  index: number;
  line: number;
  start: number;
  end: number;
  labelEnd: number;
}

const MARKER = new RegExp(
  `(?<=^|\\s)(?:(IV|VI{0,3}|I{1,3}|ІV|І{1,3})\\s*[.)]|([${LETTER_CLASS}])\\s*(?:\\)|\\.(?=\\s))|(\\d{1,2})\\s*[.)]|(\\d)(?=[A-Za-zА-Яа-яЁёӘәІіҢңҒғҮүҰұҚқӨөҺһ]))\\s*`,
  "g",
);
// The last alternative accepts a typo like "2жай ғана" (no dot); the
// sequence check below keeps it from matching random digits.

function tokenize(lines: BLine[]) {
  const tokens: Token[] = [];
  let rowKind: Kind | null = null;
  const next: Record<Kind, number> = { letter: 0, roman: 0, number: 0 };
  lines.forEach((line, li) => {
    MARKER.lastIndex = 0;
    let m: RegExpExecArray | null;
    const found: Token[] = [];
    while ((m = MARKER.exec(line.text))) {
      const kind: Kind = m[1] ? "roman" : m[2] ? "letter" : "number";
      const index =
        kind === "roman" ? romanIndex(m[1]) : kind === "letter" ? letterIndex(m[2]) : Number(m[3] ?? m[4]) - 1;
      // A glued digit is only trusted when it is exactly the next option.
      if (m[4] && index !== next[kind]) continue;
      if (index < 0) continue;
      if (!rowKind) {
        // The left column starts at the beginning of a line with its first item.
        if (index !== 0 || line.text.slice(0, m.index).trim()) continue;
        rowKind = kind;
      }
      const isRow = kind === rowKind;
      // Rows go 1,2,3…; options continue or restart at the first value
      // (options repeated under every row).
      const ok = isRow ? index === next[kind] : index === next[kind] || index === 0;
      if (!ok) continue;
      next[kind] = index + 1;
      found.push({ kind, index, line: li, start: m.index, end: m.index + m[0].length, labelEnd: line.text.length });
    }
    found.forEach((t, i) => {
      t.labelEnd = found[i + 1]?.start ?? line.text.length;
    });
    tokens.push(...found);
  });
  return { tokens, rowKind };
}

interface MatchingParse {
  prompt: string;
  rows: string[];
  options: string[];
  /** row index → option indexes, from marks on per-row options. */
  marked: Map<number, number[]>;
  rowKind: Kind;
  optionKind: Kind;
}

function parseMatching(lines: BLine[], joinPrompt: string): MatchingParse | null {
  const { tokens, rowKind } = tokenize(lines);
  if (!rowKind || tokens.length === 0) return null;
  const first = tokens[0];
  const promptParts = lines.slice(0, first.line).map((l) => l.text);
  promptParts.push(lines[first.line].text.slice(0, first.start));
  const label = (t: Token) => clean(lines[t.line].text.slice(t.end, t.labelEnd));

  const rowTokens = tokens.filter((t) => t.kind === rowKind);
  const optTokens = tokens.filter((t) => t.kind !== rowKind);
  if (rowTokens.length < 2 || optTokens.length < 2) return null;
  const optionKind = optTokens[0].kind;
  if (optTokens.some((t) => t.kind !== optionKind)) return null;

  const repeated = new Set(optTokens.map((t) => t.index)).size < optTokens.length;
  const rows = rowTokens.map(label);
  let options: string[];
  const marked = new Map<number, number[]>();
  if (repeated) {
    // Options listed under every row; the marked one is that row's answer.
    const byIndex = new Map<number, string>();
    for (const t of optTokens) if (!byIndex.has(t.index)) byIndex.set(t.index, label(t));
    options = [...byIndex.keys()].sort((a, b) => a - b).map((i) => byIndex.get(i)!);
    let row = -1;
    for (const t of tokens) {
      if (t.kind === rowKind) {
        row = t.index;
        continue;
      }
      if (row < 0 || markedRatio(lines[t.line], t.start, t.labelEnd) < 0.6) continue;
      marked.set(row, [...(marked.get(row) ?? []), t.index]);
    }
  } else {
    options = optTokens.map(label);
  }
  return {
    prompt: clean(promptParts.join(joinPrompt)),
    rows,
    options,
    marked,
    rowKind,
    optionKind,
  };
}

/** "I – C; II – A", "A–3,4; B–1,2", "1-A, 2-C" → row index → option indexes. */
function parsePairs(spec: string): Map<number, number[]> {
  const pairs = new Map<number, number[]>();
  const re = new RegExp(
    `(IV|VI{0,3}|I{1,3}|ІV|І{1,3}|[${LETTER_CLASS}]|\\d)\\s*[–—-]\\s*((?:[${LETTER_CLASS}]|\\d)(?:\\s*,\\s*(?:[${LETTER_CLASS}]|\\d))*)`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(spec))) {
    const rowRaw = m[1];
    const row = /^[IVІ]+$/.test(rowRaw) ? romanIndex(rowRaw) : /^\d$/.test(rowRaw) ? Number(rowRaw) - 1 : letterIndex(rowRaw);
    const opts = m[2]
      .split(/\s*,\s*/)
      .map((o) => (/^\d$/.test(o) ? Number(o) - 1 : letterIndex(o)))
      .filter((i) => i >= 0);
    if (row >= 0 && opts.length) pairs.set(row, opts);
  }
  if (pairs.size === 0) {
    // Compact form without dashes: "A2 B1", "A1,3 B2".
    const compact = new RegExp(`(?<![\\w])([${LETTER_CLASS}])\\s*([1-9](?:\\s*,\\s*[1-9])*)`, "g");
    while ((m = compact.exec(spec))) {
      const row = letterIndex(m[1]);
      const opts = m[2].split(/\s*,\s*/).map((o) => Number(o) - 1);
      if (row >= 0) pairs.set(row, opts);
    }
  }
  return pairs;
}

function matchFromPairs(q: ParsedQuestion, pairs: Map<number, number[]>): Record<string, string> | null {
  if (!q.rows) return null;
  const out: Record<string, string> = {};
  for (const [row, opts] of pairs) {
    const rowId = q.rows[row]?.id;
    const ids = opts.map((i) => q.options[i]?.id).filter(Boolean);
    if (!rowId || ids.length !== opts.length) return null;
    out[rowId] = [...new Set(ids)].sort().join(",");
  }
  return Object.keys(out).length === q.rows.length ? out : null;
}

/* ---------- questions ---------- */

interface Chunk {
  id: number;
  lines: BLine[];
}

interface Variant {
  title: string;
  preamble: BLine[];
  chunks: Chunk[];
  keyLines: BLine[];
}

function splitDocument(lines: BLine[]): { title: string; variants: Variant[] } {
  const variants: Variant[] = [];
  let current: Variant = { title: "", preamble: [], chunks: [], keyLines: [] };
  let expected = 1;
  let inKeys = false;
  // A numbered line is a question only if answer options follow it before the
  // next question number. Numbered statements inside a question ("1. …",
  // "2. …" starting from 1) are skipped while looking for that boundary.
  const looksLikeQuestion = (i: number, id: number, requireNext = false) => {
    let options = 0;
    let statement = 1;
    let sawNext = false;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.table) {
        options += optionLikeCount([line]);
        continue;
      }
      if (KEY_HEADING.test(line.text) && line.text.length < 90) break;
      const m = QUESTION_LINE.exec(line.text);
      if (m && !optionStart(line)) {
        const n = Number(m[1]);
        if (n === statement && options === 0) {
          statement += 1;
          continue;
        }
        if (n === id + 1) {
          sawNext = true;
          break;
        }
      }
      if (optionStart(line)) options += 1;
    }
    return options >= 2 && (!requireNext || sawNext);
  };
  // "1.Қорғауға … 2.Жұмақ …" is a list of statements, not a new variant.
  const startsNewVariant = (i: number) =>
    !/\s2\s*[.)]/.test(lines[i].text) && looksLikeQuestion(i, 1, true);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;
    if (!line.table && KEY_HEADING.test(text) && text.length < 90) {
      inKeys = true;
      continue;
    }
    const m = line.table ? null : QUESTION_LINE.exec(text);
    const id = m ? Number(m[1]) : 0;
    const restart =
      id === 1 && current.chunks.length >= 5 && expected > 1 && startsNewVariant(i);
    if (m && (restart || (!inKeys && id === expected && looksLikeQuestion(i, id)))) {
      if (restart) {
        variants.push(current);
        // A "2 – нұсқа" line right before the restart names the new variant.
        const prev = current.chunks[current.chunks.length - 1];
        const label = [...(prev?.lines ?? []), ...current.keyLines]
          .reverse()
          .find((l) => !l.table && VARIANT_LINE.test(l.text) && l.text.length < 40);
        current = { title: label ? oneLine(label.text) : "", preamble: [], chunks: [], keyLines: [] };
        expected = 1;
        inKeys = false;
      }
      current.chunks.push({
        id,
        lines: [{ ...line, text: text.slice(m[0].length), mask: line.mask.slice(m[0].length) }, ...[]],
      });
      expected = id + 1;
      continue;
    }
    if (inKeys) current.keyLines.push(line);
    else if (current.chunks.length === 0) current.preamble.push(line);
    else current.chunks[current.chunks.length - 1].lines.push(line);
  }
  variants.push(current);

  const first = variants[0];
  const titleLine = first.preamble.find((l) => !l.table && l.text.trim());
  const title =
    titleLine && titleLine.text.trim().length <= 60 && !VARIANT_LINE.test(titleLine.text)
      ? oneLine(titleLine.text)
      : "";
  // Variant labels like "1 – нұсқа" sitting in the preamble.
  for (const v of variants) {
    if (!v.title) {
      const label = v.preamble.find((l) => !l.table && VARIANT_LINE.test(l.text) && l.text.length < 40);
      if (label) v.title = oneLine(label.text);
    }
  }
  return { title, variants: variants.filter((v) => v.chunks.length > 0) };
}

interface ContextBlock {
  text: string;
  images: string[];
}

/** Free text / tables / pictures between questions → a reading passage. */
function contextFrom(lines: BLine[], images: string[], pdf: boolean): ContextBlock | null {
  const parts: string[] = [];
  const pics = [...images];
  // A bare "Контекст" / "Мәтін" label line is dropped; the line after it is the heading.
  const textLines = lines.filter(
    (l) =>
      l.table ||
      l.images.length ||
      (l.text.trim() && !/^(контекст|мәтін|мәнмәтін|текст)\s*[:.]?$/i.test(l.text.trim())),
  );
  textLines.forEach((l, i) => {
    for (const img of l.images) pics.push(img.src);
    if (l.table) {
      parts.push(tableToMarkdown(l.table));
      return;
    }
    const t = clean(l.text);
    if (!t) return;
    const heading =
      i === 0 &&
      textLines.length > 1 &&
      t.length <= 80 &&
      (markedRatio(l) > 0.6 || !/[.!?:;]$/.test(t));
    parts.push(heading ? `## ${t.replace(/\.$/, "")}` : t);
  });
  const text = pdf
    ? parts.join("\n").replace(/^(## [^\n]+)\n([\s\S]*)$/, (_, h, body) => `${h}\n${oneLine(body)}`)
    : parts.join("\n");
  const plain = text.replace(/^## .*$/m, "").replace(/\s+/g, "");
  if (plain.length < 60 && pics.length === 0 && !text.includes("|")) return null;
  // A lone instruction ("Әр тапсырмада … белгілеңіз") is not a passage.
  if (pics.length === 0 && !text.includes("|") && parts.length === 1 && INSTRUCTION.test(text)) return null;
  return { text: text.trim(), images: pics };
}

const INLINE_OPTION = new RegExp(`(?<=^|\\s)([${LETTER_CLASS}])\\s*\\)`, "g");

/**
 * Tests converted from PDF keep several options on one line:
 * "2. Қыздырғанда … А) Ca(NO3)2" / "В) Cu(NO3)2 С) AgNO3". Split such lines at
 * option markers that continue the A, B, C… sequence.
 */
function explodeInlineOptions(lines: BLine[]): BLine[] {
  const out: BLine[] = [];
  let expected = 0;
  for (const line of lines) {
    if (line.table) {
      out.push(line);
      continue;
    }
    const cuts: number[] = [];
    INLINE_OPTION.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = INLINE_OPTION.exec(line.text))) {
      if (letterIndex(m[1]) !== expected) continue;
      expected += 1;
      if (m.index > 0) cuts.push(m.index);
    }
    if (cuts.length === 0) {
      out.push(line);
      continue;
    }
    const bounds = [0, ...cuts, line.text.length];
    for (let i = 0; i < bounds.length - 1; i++) {
      const text = line.text.slice(bounds[i], bounds[i + 1]);
      if (!text.trim()) continue;
      out.push({
        text: text.trimEnd(),
        mask: line.mask.slice(bounds[i], bounds[i] + text.trimEnd().length),
        images: i === 0 ? line.images : [],
      });
    }
  }
  return out;
}

interface ChunkResult {
  question: ParsedQuestion;
  tail: BLine[];
  tailImages: string[];
  marksKeyed: boolean;
}

function parseChunk(chunk: Chunk, pdf: boolean): ChunkResult | null {
  const join = pdf ? " " : "\n";
  const answerLines = chunk.lines.filter((l) => !l.table && ANSWER_LINE.test(l.text));
  let lines = chunk.lines.filter((l) => !answerLines.includes(l));
  const floating: string[] = [];
  lines = lines.map((l) => {
    const keep = l.images.filter((img) => !img.floating);
    floating.push(...l.images.filter((img) => img.floating).map((img) => img.src));
    return keep.length === l.images.length ? l : { ...l, images: keep };
  });
  lines = explodeInlineOptions(lines);

  // When options are written "A)", lines like "А. 1582-1598 жж." belong to the
  // question text; "A." options are used only when no "A)" ones exist.
  const parenStyle = lines.some((l, i) => i > 0 && !l.table && optionStart(l)?.paren);
  const optionAt = (l: BLine) => {
    const o = l.table ? null : optionStart(l);
    return o && (!parenStyle || o.paren) ? o : null;
  };
  // Line 0 is the question itself ("А. Байтұрсынов…" must not become option A).
  const firstOption = lines.findIndex((l, i) => i > 0 && optionAt(l)?.index === 0);
  const promptPreview = lines
    .slice(0, firstOption < 0 ? lines.length : firstOption)
    .map((l) => l.text)
    .join(" ");

  // Options like "I-B, II-A, III-D" are combinations — a single-choice task.
  const comboOptions = lines.filter(
    (l) => optionStart(l) && /\b(?:I{1,3}|IV|V|\d)\s*[-–]\s*[A-DА-Д]\b/.test(l.text),
  ).length;
  // A table holding both row markers and option markers is a matching task
  // even when the wording has no "сәйкестендір" (and no options outside it).
  const tableMatching = lines.some((l) => {
    if (!l.table) return false;
    const text = tableLines(l.table).map((x) => x.text).join("\n");
    const rows = text.match(new RegExp(`(?<=^|\\s)(?:[${LETTER_CLASS}]\\s*\\)|(?:I|І){1,3}\\s*[.)])`, "g"))?.length ?? 0;
    const nums = text.match(/(?<=^|\s)\d\s*[.)]/g)?.length ?? 0;
    return rows >= 2 && (nums >= 2 || /(^|\s)(I|І)\s*[.)]/.test(text));
  });
  const optionsOutsideTables = lines.filter((l, i) => i > 0 && !l.table && optionStart(l)).length;
  const matchingLike =
    comboOptions < 2 &&
    (MATCHING_HINT.test(promptPreview) || (tableMatching && optionsOutsideTables < 2));

  if (matchingLike) {
    const flat = lines.slice(1).flatMap((l) => (l.table ? tableLines(l.table) : [l]));
    const parsed = parseMatching(flat, join);
    if (parsed) parsed.prompt = clean([lines[0].text, parsed.prompt].filter(Boolean).join(join));
    if (parsed && parsed.rows.length >= 2 && parsed.options.length >= 2) {
      const question: ParsedQuestion = {
        id: chunk.id,
        type: "matching",
        text: parsed.prompt || `Сәйкестендіру №${chunk.id}`,
        rows: parsed.rows.map((label, i) => ({ id: String(i + 1), label })),
        options: parsed.options.map((label, i) => ({ id: LETTERS[i] ?? String(i + 1), label })),
        hasImageHint: false,
      };
      const images = flat.flatMap((l) => l.images.map((img) => img.src));
      if (images.length) question.images = images;
      let marksKeyed = false;
      const fromAnswerLine = answerLines.length
        ? matchFromPairs(question, parsePairs(answerLines.map((l) => l.text).join(" ")))
        : null;
      if (fromAnswerLine) question.detectedMatch = fromAnswerLine;
      else if (parsed.marked.size) {
        const fromMarks = matchFromPairs(question, parsed.marked);
        if (fromMarks) {
          question.detectedMatch = fromMarks;
          marksKeyed = true;
        }
      }
      return { question, tail: [], tailImages: floating, marksKeyed };
    }
  }

  if (firstOption < 0) return null;
  const promptLines = lines.slice(0, firstOption);
  const options: { id: string; label: string; line: BLine; start: number }[] = [];
  const optionLineIdx: number[] = [];
  for (let i = firstOption; i < lines.length; i++) {
    const l = lines[i];
    const o = optionAt(l);
    // Typo in the source: "А) В) С) В)" — a repeated earlier letter after three
    // options is the missing next one (D).
    const typo = o && options.length >= 3 && o.index < options.length - 1;
    if (o && (o.index === options.length || typo)) {
      const id = LETTERS[options.length];
      options.push({ id, label: l.text.slice(o.end), line: l, start: o.end });
      optionLineIdx.push(i);
    }
  }
  if (options.length < 2) return null;
  const lastOptionIdx = optionLineIdx[optionLineIdx.length - 1];
  // Lines between options continue the previous option (a two-line answer).
  for (let k = 0; k < optionLineIdx.length - 1; k++) {
    for (let i = optionLineIdx[k] + 1; i < optionLineIdx[k + 1]; i++) {
      if (!lines[i].table && lines[i].text.trim()) options[k].label += `${join}${lines[i].text}`;
    }
  }
  let tail = lines.slice(lastOptionIdx + 1);
  if (pdf) {
    // PDF wraps long answers: a lowercase line right after the last option.
    while (tail.length && /^\s*[a-zа-яәіңғүұқөһё0-9(«"-]/.test(tail[0].text) && !tail[0].table) {
      options[options.length - 1].label += ` ${tail[0].text}`;
      tail = tail.slice(1);
    }
  }

  const textParts: string[] = [];
  const images: string[] = [];
  for (const l of promptLines) {
    images.push(...l.images.map((img) => img.src));
    if (l.table) textParts.push(tableToMarkdown(l.table));
    else if (l.text.trim()) textParts.push(pdf ? l.text : clean(l.text));
  }
  for (const o of options) images.push(...o.line.images.map((img) => img.src));
  const text = pdf ? oneLine(textParts.join(" ")) : clean(textParts.join("\n"));

  const markedIds = options
    .filter((o) => markedRatio(o.line) >= 0.6)
    .map((o) => o.id);
  const multi =
    options.length >= 6 || MULTI_HINT.test(text) || (markedIds.length > 1 && markedIds.length < options.length);
  const question: ParsedQuestion = {
    id: chunk.id,
    type: multi ? "multiple_choice" : "single_choice",
    text,
    options: options.map((o) => ({ id: o.id, label: pdf ? oneLine(o.label) : clean(o.label) })),
    hasImageHint: /сурет|карта|кесте|сызба|график|диаграмм/i.test(text) && images.length === 0,
  };
  if (images.length) question.images = images;
  let marksKeyed = false;
  if (markedIds.length > 0 && markedIds.length < options.length) {
    if (multi) question.detectedAnswers = markedIds;
    else if (markedIds.length === 1) question.detectedAnswer = markedIds[0];
    marksKeyed = Boolean(question.detectedAnswer || question.detectedAnswers);
  }
  return { question, tail, tailImages: floating, marksKeyed };
}

/** Apply "N. B." / "N. A, D." / "N. I – C; II – A." lines and key tables. */
function applyKeyList(questions: ParsedQuestion[], keyLines: BLine[]): number {
  const entries: { id: number; spec: string }[] = [];
  const flat = keyLines.flatMap((l) => (l.table ? [] : [l.text]));
  for (const text of flat) {
    const m = /^\s*(\d{1,3})\s*[.)]\s*(.+)$/.exec(text);
    if (m) entries.push({ id: Number(m[1]), spec: m[2] });
  }
  for (const l of keyLines) {
    if (!l.table) continue;
    const cells = l.table.flatMap((row) => row.map((cell) => oneLine(cell.map((c) => c.text).join(" "))));
    // Only an answer table — not a spec table with difficulty levels A/B/C.
    const header = (l.table[0] ?? []).map((cell) => cell.map((c) => c.text).join(" ")).join(" ");
    if (!/жауап|кілт|ответ|ключ/i.test(header)) continue;
    for (let i = 0; i < cells.length - 1; i++) {
      if (/^\d{1,3}$/.test(cells[i]) && !/^\d{1,3}$/.test(cells[i + 1]) && cells[i + 1]) {
        entries.push({ id: Number(cells[i]), spec: cells[i + 1] });
        i += 1;
      }
    }
  }
  let applied = 0;
  const seen = new Set<number>();
  for (const { id, spec } of entries) {
    const q = questions.find((x) => x.id === id);
    if (!q || seen.has(id)) continue;
    seen.add(id);
    // The answer is the prefix before an explanation sentence.
    const head = spec.split(/\.\s+(?=\S)/)[0];
    if (q.type === "matching") {
      const match = matchFromPairs(q, parsePairs(head));
      if (match) {
        q.detectedMatch = match;
        applied += 1;
      }
      continue;
    }
    // "A", "A, D", or letters written together: "ABE".
    const lm =
      new RegExp(`^\\s*([${LETTER_CLASS}])(?:\\s*[,;]\\s*([${LETTER_CLASS}]))*\\s*(?:[.)]|$)`).exec(head) ??
      new RegExp(`^\\s*[${LETTER_CLASS}]{2,6}\\s*$`).exec(head);
    if (!lm) continue;
    const letters = head
      .slice(0, lm[0].length)
      .match(new RegExp(`[${LETTER_CLASS}]`, "g"))!
      .map((c) => LETTERS[letterIndex(c)])
      .filter((c) => q.options.some((o) => o.id === c));
    if (letters.length === 0) continue;
    if (letters.length > 1 && q.type === "single_choice") q.type = "multiple_choice";
    if (q.type === "multiple_choice") {
      q.detectedAnswers = [...new Set(letters)].sort();
      delete q.detectedAnswer;
    } else q.detectedAnswer = letters[0];
    applied += 1;
  }
  return applied;
}

const CONTEXT_SPAN = 5;

function buildVariant(variant: Variant, pdf: boolean): BuiltVariant {
  const questions: ParsedQuestion[] = [];
  const contexts: { title: string; text: string }[] = [];
  let fromMarks = 0;
  let pending: (ContextBlock & { left: number; type: string | null }) | null = null;

  const setContext = (lines: BLine[], images: string[]) => {
    const block = contextFrom(lines, images, pdf);
    if (!block) return;
    pending = { ...block, left: CONTEXT_SPAN, type: null };
    const heading = /^## (.+)$/m.exec(block.text)?.[1] ?? block.text.slice(0, 40);
    contexts.push({ title: heading, text: block.text });
  };

  // Text before the first question (e.g. "1-мәтін" + passage).
  const pre = variant.preamble.filter((l, i) => {
    if (l.table || l.images.length) return true;
    const t = l.text.trim();
    if (!t) return false;
    // Skip the title and variant label lines.
    return !(i <= 2 && t.length <= 60 && (VARIANT_LINE.test(t) || /^\d+\s*сұрақ/i.test(t) || i === 0));
  });
  setContext(pre, []);

  for (const chunk of variant.chunks) {
    const res = parseChunk(chunk, pdf);
    if (!res) continue;
    const q = res.question;
    const p = pending as (ContextBlock & { left: number; type: string | null }) | null;
    if (p && p.left > 0 && (p.type === null || p.type === q.type)) {
      q.context = p.text || undefined;
      if (!q.context) delete q.context;
      if (p.images.length) q.images = [...p.images, ...(q.images ?? [])];
      p.left -= 1;
      p.type = q.type;
    } else pending = null;
    if (res.marksKeyed) fromMarks += 1;
    questions.push(q);
    if (res.tail.length || res.tailImages.length) setContext(res.tail, res.tailImages);
  }
  const fromKeyList = applyKeyList(questions, variant.keyLines);
  return { title: variant.title, questions, contexts, keys: { fromMarks, fromKeyList } };
}

export function buildTests(lines: BLine[], opts: { pdf: boolean }): { title: string; variants: BuiltVariant[] } {
  const { title, variants } = splitDocument(lines);
  return { title, variants: variants.map((v) => buildVariant(v, opts.pdf)) };
}
