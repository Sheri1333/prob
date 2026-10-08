/**
 * Maths PDFs lose their formulas when read as text (fractions split across
 * lines, broken glyph encodings). Here each question is cut out of the
 * rendered page as a picture, exactly as printed, and only the answer letters
 * are taken from the text. Matching tasks get their values numbered 1–4 on
 * the picture so students can pick them.
 */
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Question } from "./scoring.js";

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PageData {
  width: number;
  height: number;
  items: Item[];
  canvas: Canvas | null;
}

interface Marker {
  n: number;
  page: number;
  top: number;
}

const SCALE = 2;
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const LETTER_MAP: Record<string, string> = { А: "A", В: "B", С: "C", Д: "D", Е: "E" };
const QUESTION_MARK = /^\s*№\s*(\d{1,2})\s*\./;
const OPTION_MARK = /^\s*([A-FАВСДЕ])\s*\)/;

/** "𝐴" (math italic) → "A": formula fonts use these for row markers too. */
function plainLetters(s: string): string {
  return [...s]
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp < 0x1d400 || cp > 0x1d6a3) return ch;
      const i = (cp - 0x1d400) % 52;
      return String.fromCharCode(i < 26 ? 65 + i : 97 + i - 26);
    })
    .join("");
}

/** Count Unicode "math italic" letters (𝑥, 𝜋…) — a sign of formula-heavy text. */
export function mathSymbolCount(text: string): number {
  return [...text].filter((ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    return cp >= 0x1d400 && cp <= 0x1d7ff;
  }).length;
}

export function countQuestionMarkers(text: string): number {
  return (text.match(/(^|\n)\s*№\s*\d{1,2}\s*\./g) ?? []).length;
}

async function loadPages(buffer: Buffer): Promise<PageData[]> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  }).promise;
  const pages: PageData[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const [, , width, height] = page.view;
      const tc = await page.getTextContent();
      const items: Item[] = [];
      for (const it of tc.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        items.push({ str: plainLetters(it.str), x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || 11 });
      }
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      pages.push({ width, height, items, canvas });
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

/**
 * Move a region top up to the nearest blank pixel row, so drawn parts of a
 * formula (radical bars, braces) above the text line stay with the question.
 */
function snapTopToGap(page: PageData, topPdf: number): number {
  if (!page.canvas) return topPdf;
  const ctx = page.canvas.getContext("2d");
  const width = page.canvas.width;
  const start = Math.max(1, Math.round((page.height - topPdf) * SCALE));
  for (let row = start; row > Math.max(0, start - 50 * SCALE); row--) {
    const data = ctx.getImageData(0, row, width, 1).data;
    let ink = false;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) {
        ink = true;
        break;
      }
    }
    if (!ink) return page.height - row / SCALE;
  }
  return topPdf;
}

/** Non-white bounding box of a canvas area (pixels), or null if blank. */
function inkBox(canvas: Canvas, x0: number, y0: number, x1: number, y1: number) {
  const ctx = canvas.getContext("2d");
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return null;
  const data = ctx.getImageData(x0, y0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x0: x0 + minX, y0: y0 + minY, x1: x0 + maxX + 1, y1: y0 + maxY + 1 };
}

interface Label {
  text: string;
  /** PDF coordinates of the value's left edge and vertical centre. */
  x: number;
  y: number;
}

/** Cut [topPdf, bottomPdf] of a page into a PNG data URL, drawing labels on it. */
function cropRegion(page: PageData, topPdf: number, bottomPdf: number, labels: Label[]): string | null {
  if (!page.canvas) return null;
  const toPx = (y: number) => Math.round((page.height - y) * SCALE);
  const y0 = Math.max(0, toPx(topPdf));
  const y1 = Math.min(page.canvas.height, toPx(bottomPdf));
  const box = inkBox(page.canvas, 0, y0, page.canvas.width, y1);
  if (!box) return null;
  const pad = 14;
  const labelRoom = labels.length ? 70 : 0;
  const sx = Math.max(0, box.x0 - pad - labelRoom);
  const sy = Math.max(0, box.y0 - pad);
  const sw = Math.min(page.canvas.width, box.x1 + pad) - sx;
  const sh = Math.min(page.canvas.height, box.y1 + pad) - sy;
  const out = createCanvas(sw, sh);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(page.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  for (const label of labels) {
    const vx = Math.round(label.x * SCALE - sx);
    const ly = Math.round((page.height - label.y) * SCALE - sy);
    // Put the number just inside the table cell: find the cell's left border
    // by scanning left from the value for a dark vertical line.
    let lx = vx - 58;
    const row = ctx.getImageData(0, Math.max(0, Math.min(sh - 1, ly)), Math.max(1, vx - 4), 1).data;
    for (let x = vx - 6; x > 0; x--) {
      const i = x * 4;
      if (row[i] < 120 && row[i + 1] < 120 && row[i + 2] < 120) {
        if (vx - x > 40) lx = x + 8;
        break;
      }
    }
    ctx.fillStyle = "#3a46c4";
    ctx.font = "bold 24px sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(label.text, Math.max(2, lx), ly);
  }
  return `data:image/png;base64,${out.toBuffer("image/png").toString("base64")}`;
}

function linesOf(items: Item[]) {
  const lines: { y: number; items: Item[] }[] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((l) => Math.abs(l.y - it.y) < 3);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}

interface Region {
  page: number;
  top: number;
  bottom: number;
}

/**
 * Matching laid out as rows "А) …" with two printed values each. Values are
 * numbered 1,2 (row A) and 3,4 (row B), the order answer keys use.
 */
function matchingLabels(page: PageData, region: Region): { rows: string[]; labels: Label[] } | null {
  const items = page.items.filter((it) => it.y <= region.top && it.y >= region.bottom);
  // A row marker is the start of a line ("А) p", or "A" + ")" split in two).
  const rowItems: Item[] = [];
  const rows: string[] = [];
  for (const line of linesOf(items)) {
    const m = OPTION_MARK.exec(line.items.map((it) => it.str).join(""));
    if (!m) continue;
    rowItems.push(line.items[0]);
    rows.push(LETTER_MAP[m[1]] ?? m[1]);
  }
  if (rowItems.length < 2) return null;
  // Row captions sit next to the row marker; values are further right.
  const rowLine = (it: Item) => items.filter((o) => Math.abs(o.y - it.y) < 3).sort((a, b) => a.x - b.x);
  let captionEnd = 0;
  for (const r of rowItems) {
    let end = r.x + r.w;
    for (const o of rowLine(r)) {
      if (o.x < r.x || o.x - end > 25) continue;
      end = Math.max(end, o.x + o.w);
    }
    captionEnd = Math.max(captionEnd, end);
  }
  // Values may sit a little above their row marker, but the "Жауапты таңдаңыз"
  // column header is ~30pt higher and must stay out.
  const firstRowTop = rowItems[0].y + 20;
  const values = items.filter((it) => it.x > captionEnd + 15 && it.y <= firstRowTop);
  if (values.length === 0) return null;
  // Group stacked pieces (fractions, superscripts) into one value per cluster.
  const sorted = [...values].sort((a, b) => b.y - a.y);
  const clusters: Item[][] = [];
  for (const it of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && last[last.length - 1].y - it.y < 18) last.push(it);
    else clusters.push([it]);
  }
  if (clusters.length !== rows.length * 2) return null;
  const labels = clusters.map((c, i) => {
    const ys = c.map((it) => it.y + it.h / 2);
    return {
      text: `${i + 1})`,
      x: Math.min(...c.map((it) => it.x)),
      y: (Math.max(...ys) + Math.min(...ys)) / 2,
    };
  });
  return { rows, labels };
}

export interface ImageQuestionsResult {
  questions: Question[];
  pages: number;
  /** Questions whose answer letters could not be read from the text. */
  warnings: string[];
}

export async function importPdfAsImages(buffer: Buffer): Promise<ImageQuestionsResult> {
  const pages = await loadPages(buffer);
  const markers: Marker[] = [];
  // "№26-30. Үйдің шатыры" + figure, repeated before each question of a group:
  // it opens the region of the question that follows it.
  const groupStarts: { page: number; top: number }[] = [];
  let expected = 1;
  let markerX: number | null = null;
  pages.forEach((page, p) => {
    const lines = linesOf(page.items);
    // A system of equations or a tall fraction starts above the "№7." baseline;
    // pull the top up over such pieces (they sit right of the number).
    const topOf = (line: { y: number; items: Item[] }) => {
      let top = line.y + 14;
      let prevY = line.y;
      const above = lines.filter((l) => l.y > line.y).sort((a, b) => a.y - b.y);
      for (const u of above) {
        if (u.y - prevY > 16 || u.items[0].x <= line.items[0].x + 15) break;
        top = u.y + 14;
        prevY = u.y;
      }
      return top;
    };
    for (const line of lines) {
      const head = line.items.map((it) => it.str).join("");
      const x = line.items[0].x;
      if (/^\s*№\s*\d{1,2}\s*[-–]\s*\d{1,2}/.test(head)) {
        groupStarts.push({ page: p, top: snapTopToGap(page, line.y + 14) });
        continue;
      }
      const m = QUESTION_MARK.exec(head) ?? /^\s*(\d{1,2})\s*\.\s*\S/.exec(head);
      // A number without "№" counts only at the usual left edge ("35. 𝑦 = …").
      const plain = !/^\s*№/.test(head);
      if (!m || Number(m[1]) !== expected) continue;
      // Word list indentation can shift it right by ~18pt.
      if (plain && (markerX === null || x < markerX - 4 || x > markerX + 25)) continue;
      markerX ??= x;
      markers.push({ n: expected, page: p, top: snapTopToGap(page, topOf(line)) });
      expected += 1;
    }
  });
  // Move each question's top up to a group header between it and the previous one.
  const before = (a: { page: number; top: number }, b: { page: number; top: number }) =>
    a.page < b.page || (a.page === b.page && a.top > b.top);
  markers.forEach((m, i) => {
    const prev = markers[i - 1];
    const header = groupStarts
      .filter((g) => before(g, m) && (!prev || before(prev, g)))
      .pop();
    if (header) {
      m.page = header.page;
      m.top = header.top;
    }
  });

  const questions: Question[] = [];
  const warnings: string[] = [];
  const bottomMargin = 20;
  markers.forEach((marker, i) => {
    const next = markers[i + 1];
    const regions: Region[] = [];
    for (let p = marker.page; p < pages.length; p++) {
      const top = p === marker.page ? marker.top : pages[p].height - 20;
      if (next && next.page === p) {
        regions.push({ page: p, top, bottom: next.top + 1 });
        break;
      }
      regions.push({ page: p, top, bottom: bottomMargin });
      if (!next) break;
    }

    const regionItems = regions.flatMap((r) =>
      pages[r.page].items.filter((it) => it.y <= r.top && it.y >= r.bottom),
    );
    const regionText = linesOf(regionItems)
      .map((l) => l.items.map((it) => it.str).join(""))
      .join("\n");
    const letters = new Set<string>();
    for (const line of regionText.split("\n")) {
      const m = OPTION_MARK.exec(line);
      if (m) letters.add(LETTER_MAP[m[1]] ?? m[1]);
    }
    // "тандаңыз" (н for ң) occurs as a typo in the source files.
    const isMatching = /сәйкест|Жауапты\s*та[ңн]да/i.test(regionText) && letters.size <= 3;

    let labels: Label[] = [];
    let rows: string[] = [];
    if (isMatching) {
      for (const r of regions) {
        const found = matchingLabels(pages[r.page], r);
        if (found) {
          rows = found.rows;
          labels = found.labels;
          break;
        }
      }
      if (!labels.length) warnings.push(`№${marker.n}: не удалось пронумеровать значения соответствия`);
    }

    const images = regions
      .map((r) => cropRegion(pages[r.page], r.top, r.bottom, labels.length && r.page === regions[0].page ? labels : []))
      .filter((src): src is string => Boolean(src));

    if (isMatching) {
      const rowIds = rows.length ? rows : ["A", "B"];
      const count = labels.length || 4;
      questions.push({
        id: marker.n,
        type: "matching",
        text: "",
        images,
        rows: rowIds.map((id) => ({ id, label: "" })),
        options: Array.from({ length: count }, (_, k) => ({ id: String(k + 1), label: "" })),
        correctAnswers: {},
      });
      return;
    }

    const optionCount = letters.size >= 2 ? Math.max(...[...letters].map((l) => LETTERS.indexOf(l))) + 1 : 4;
    if (letters.size < 2) warnings.push(`№${marker.n}: варианты ответа не прочитаны, поставлено A–D`);
    const options = LETTERS.slice(0, optionCount).map((id) => ({ id, label: "" }));
    questions.push(
      optionCount >= 5
        ? { id: marker.n, type: "multiple_choice", text: "", images, options, correctAnswers: [] }
        : { id: marker.n, type: "single_choice", text: "", images, options, correctAnswer: "" },
    );
  });

  return { questions, pages: pages.length, warnings };
}
