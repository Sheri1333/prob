import { strFromU8, unzipSync } from "fflate";

/** A piece of text with the formatting that test authors use to mark keys. */
export interface DocSegment {
  text: string;
  bold: boolean;
  highlight: boolean;
  color: boolean;
  /** Equation text: authors rarely bold formulas, so it is ignored for marks. */
  math?: boolean;
}

export interface DocImage {
  src: string;
  /** Floating (anchored) picture — its position in the text is arbitrary. */
  floating: boolean;
}

export interface DocLine {
  segments: DocSegment[];
  /** Pictures in this paragraph (data: URLs). */
  images: DocImage[];
  /** Table rows → cells → paragraphs. Only set on table lines. */
  table?: DocLine[][][];
}

export interface DocxExtract {
  lines: DocLine[];
  /** Pictures in formats a browser cannot show (EMF/WMF). */
  skippedImages: number;
}

const XML_ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&amp;": "&",
};

function decodeXml(s: string): string {
  return s
    .replace(/&(lt|gt|quot|apos|amp);/g, (m) => XML_ENTITIES[m])
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

/** Split `xml` into top-level elements of the given tag names, keeping order. */
function topLevel(xml: string, names: string[]): { name: string; xml: string }[] {
  const re = new RegExp(`<(/?)(${names.join("|")})(?=[\\s>/])[^>]*?(/?)>`, "g");
  const out: { name: string; xml: string }[] = [];
  let depth = 0;
  let start = -1;
  let current = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const [, closing, name, selfClosing] = m;
    if (selfClosing) {
      if (depth === 0) out.push({ name, xml: m[0] });
      continue;
    }
    if (!closing) {
      if (depth === 0) {
        start = m.index;
        current = name;
      }
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        out.push({ name: current, xml: xml.slice(start, m.index + m[0].length) });
        start = -1;
      }
    }
  }
  return out;
}

/* ---------- numbering (auto-numbered lists) ---------- */

interface LevelDef {
  start: number;
  fmt: string;
  text: string;
}

interface Numbering {
  levels: Map<string, Map<number, LevelDef>>;
  counters: Map<string, number[]>;
}

function parseNumbering(xml: string | null): Numbering {
  const levels = new Map<string, Map<number, LevelDef>>();
  if (!xml) return { levels, counters: new Map() };
  const abstract = new Map<string, Map<number, LevelDef>>();
  for (const a of topLevel(xml, ["w:abstractNum"])) {
    const id = attr(a.xml, "w:abstractNumId");
    if (!id) continue;
    const lv = new Map<number, LevelDef>();
    for (const l of topLevel(a.xml.replace(/^<w:abstractNum[^>]*>/, ""), ["w:lvl"])) {
      const ilvl = Number(attr(l.xml, "w:ilvl") ?? 0);
      lv.set(ilvl, {
        start: Number(/<w:start w:val="(\d+)"/.exec(l.xml)?.[1] ?? 1),
        fmt: /<w:numFmt w:val="([^"]+)"/.exec(l.xml)?.[1] ?? "decimal",
        text: decodeXml(/<w:lvlText w:val="([^"]*)"/.exec(l.xml)?.[1] ?? "%1."),
      });
    }
    abstract.set(id, lv);
  }
  for (const n of topLevel(xml, ["w:num"])) {
    const numId = attr(n.xml, "w:numId");
    const absId = /<w:abstractNumId w:val="(\d+)"/.exec(n.xml)?.[1];
    if (!numId || !absId || !abstract.has(absId)) continue;
    const lv = new Map(abstract.get(absId)!);
    for (const o of topLevel(n.xml.replace(/^<w:num[^>]*>/, ""), ["w:lvlOverride"])) {
      const ilvl = Number(attr(o.xml, "w:ilvl") ?? 0);
      const start = /<w:startOverride w:val="(\d+)"/.exec(o.xml)?.[1];
      const base = lv.get(ilvl);
      if (base && start) lv.set(ilvl, { ...base, start: Number(start) });
    }
    levels.set(numId, lv);
  }
  return { levels, counters: new Map() };
}

const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

function formatNumber(n: number, fmt: string): string {
  switch (fmt) {
    case "upperLetter":
    case "russianUpper":
      // Answer options: always Latin so "Б)" never appears as a key letter.
      return LATIN[(n - 1) % 26];
    case "lowerLetter":
    case "russianLower":
      return LATIN[(n - 1) % 26].toLowerCase();
    case "upperRoman":
      return toRoman(n);
    case "lowerRoman":
      return toRoman(n).toLowerCase();
    case "bullet":
    case "none":
      return "";
    default:
      return String(n);
  }
}

function listLabel(numbering: Numbering, numId: string, ilvl: number): string {
  const lv = numbering.levels.get(numId);
  const def = lv?.get(ilvl);
  if (!lv || !def || def.fmt === "bullet" || def.fmt === "none") return "";
  const counters = numbering.counters.get(numId) ?? [];
  counters[ilvl] = (counters[ilvl] ?? lv.get(ilvl)!.start - 1) + 1;
  counters.length = ilvl + 1;
  numbering.counters.set(numId, counters);
  return def.text.replace(/%(\d)/g, (_, d) => {
    const level = Number(d) - 1;
    const value = counters[level] ?? lv.get(level)?.start ?? 1;
    return formatNumber(value, lv.get(level)?.fmt ?? "decimal");
  });
}

/* ---------- Office Math (equations) → plain text ---------- */

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", n: "ⁿ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
};

function scriptText(s: string, table: Record<string, string>, fallback: string): string {
  return [...s].every((c) => table[c]) ? [...s].map((c) => table[c]).join("") : `${fallback}(${s})`;
}

function group(s: string): string {
  return /^[\w.,²³√]+$/u.test(s) ? s : `(${s})`;
}

function mathToText(xml: string): string {
  let out = "";
  for (const el of topLevel(xml, [
    "m:r", "m:f", "m:sSup", "m:sSub", "m:sSubSup", "m:rad", "m:d", "m:nary", "m:e", "m:func", "m:box", "m:acc", "m:bar", "m:groupChr", "m:limLow", "m:limUpp",
  ])) {
    const inner = (name: string) => {
      const part = topLevel(el.xml.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, ""), [name])[0];
      return part ? mathToText(part.xml.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, "")) : "";
    };
    switch (el.name) {
      case "m:r":
        out += (el.xml.match(/<m:t[^>]*>([\s\S]*?)<\/m:t>/g) ?? [])
          .map((t) => decodeXml(t.replace(/<[^>]+>/g, "")))
          .join("");
        break;
      case "m:f":
        out += `${group(inner("m:num"))}/${group(inner("m:den"))}`;
        break;
      case "m:sSup":
        out += inner("m:e") + scriptText(inner("m:sup"), SUP, "^");
        break;
      case "m:sSub":
        out += inner("m:e") + scriptText(inner("m:sub"), SUB, "_");
        break;
      case "m:sSubSup":
        out += inner("m:e") + scriptText(inner("m:sub"), SUB, "_") + scriptText(inner("m:sup"), SUP, "^");
        break;
      case "m:rad": {
        const deg = inner("m:deg");
        out += `${deg ? scriptText(deg, SUP, "^") : ""}√${group(inner("m:e"))}`;
        break;
      }
      case "m:d": {
        const beg = /<m:begChr m:val="([^"]*)"/.exec(el.xml)?.[1] ?? "(";
        const end = /<m:endChr m:val="([^"]*)"/.exec(el.xml)?.[1] ?? ")";
        const parts = topLevel(el.xml.replace(/^<m:d>/, "").replace(/<\/m:d>$/, ""), ["m:e"]).map((e) =>
          mathToText(e.xml.replace(/^<m:e>/, "").replace(/<\/m:e>$/, "")),
        );
        out += `${beg}${parts.join(", ")}${end}`;
        break;
      }
      case "m:nary": {
        const chr = /<m:chr m:val="([^"]*)"/.exec(el.xml)?.[1] ?? "∫";
        out += `${chr}${inner("m:sub")}${inner("m:sup") ? `^${inner("m:sup")}` : ""} ${inner("m:e")}`;
        break;
      }
      case "m:e":
        out += mathToText(el.xml.replace(/^<m:e>/, "").replace(/<\/m:e>$/, ""));
        break;
      default:
        out += mathToText(el.xml.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, ""));
    }
  }
  return out;
}

/* ---------- paragraphs ---------- */

interface Ctx {
  rels: Map<string, string>;
  files: Record<string, Uint8Array>;
  numbering: Numbering;
  skippedImages: number;
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

function imageFromRel(ctx: Ctx, relId: string): string | null {
  const target = ctx.rels.get(relId);
  if (!target) return null;
  const path = target.startsWith("/") ? target.slice(1) : `word/${target.replace(/^\.\//, "")}`;
  const bytes = ctx.files[path];
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const type = IMAGE_TYPES[ext];
  if (!bytes || !type) {
    ctx.skippedImages += 1;
    return null;
  }
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}

function isOn(rpr: string, tag: string): boolean {
  const m = new RegExp(`<w:${tag}(?: w:val="([^"]*)")?\\s*/>`).exec(rpr);
  return Boolean(m) && !/^(0|false|off|none)$/i.test(m![1] ?? "");
}

function runFormat(rpr: string) {
  const highlight = /<w:highlight w:val="([^"]+)"/.exec(rpr)?.[1];
  const fill = /<w:shd [^>]*w:fill="([0-9A-Fa-f]{6})"/.exec(rpr)?.[1];
  const color = /<w:color w:val="([0-9A-Fa-f]{6})"/.exec(rpr)?.[1];
  const darkish = (hex: string) => {
    const n = parseInt(hex, 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return Math.max(r, g, b) < 70;
  };
  return {
    bold: isOn(rpr, "b"),
    highlight:
      Boolean(highlight && highlight !== "none") ||
      Boolean(fill && !/^(auto|FFFFFF)$/i.test(fill)),
    color: Boolean(color && !darkish(color)),
  };
}

function parseParagraph(xml: string, ctx: Ctx): DocLine {
  const segments: DocSegment[] = [];
  const images: DocImage[] = [];
  // Text inside drawings (map labels, text boxes) and the duplicate
  // compatibility copy (mc:Fallback) is not part of the question text.
  xml = xml
    .replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "")
    .replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g, "");
  const ppr = /<w:pPr>([\s\S]*?)<\/w:pPr>/.exec(xml)?.[1] ?? "";
  const numId = /<w:numId w:val="(\d+)"/.exec(ppr)?.[1];
  if (numId && numId !== "0") {
    const ilvl = Number(/<w:ilvl w:val="(\d+)"/.exec(ppr)?.[1] ?? 0);
    const label = listLabel(ctx.numbering, numId, ilvl);
    if (label) segments.push({ text: `${label} `, bold: false, highlight: false, color: false });
  }

  const re = /<w:r(?=[\s>])[\s\S]*?<\/w:r>|<m:oMath(?=[\s>])[\s\S]*?<\/m:oMath>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const run = m[0];
    if (run.startsWith("<m:oMath")) {
      const text = mathToText(run.replace(/^<m:oMath[^>]*>/, "").replace(/<\/m:oMath>$/, ""));
      if (text) segments.push({ text, bold: false, highlight: false, color: false, math: true });
      continue;
    }
    const rpr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run)?.[1] ?? "";
    const fmt = runFormat(rpr);
    let text = "";
    const parts = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\b[^>]*\/>|<w:cr\s*\/>|<w:noBreakHyphen\s*\/>|r:embed="([^"]+)"|<v:imagedata [^>]*r:id="([^"]+)"/g;
    let p: RegExpExecArray | null;
    while ((p = parts.exec(run))) {
      if (p[1] !== undefined) text += decodeXml(p[1]);
      else if (p[0].startsWith("<w:tab")) text += "\t";
      else if (p[0].startsWith("<w:br") || p[0].startsWith("<w:cr")) text += "\n";
      else if (p[0].startsWith("<w:noBreakHyphen")) text += "-";
      else {
        const src = imageFromRel(ctx, p[2] ?? p[3]);
        if (src) images.push({ src, floating: run.includes("<wp:anchor") });
      }
    }
    if (text) segments.push({ text, ...fmt });
  }
  return { segments, images };
}

function parseTable(xml: string, ctx: Ctx): DocLine[][][] {
  const body = xml.replace(/^<w:tbl[^>]*>/, "").replace(/<\/w:tbl>$/, "");
  return topLevel(body, ["w:tr"]).map((tr) =>
    topLevel(tr.xml.replace(/^<w:tr[^>]*>/, "").replace(/<\/w:tr>$/, ""), ["w:tc"]).map((tc) =>
      blockLines(tc.xml.replace(/^<w:tc[^>]*>/, "").replace(/<\/w:tc>$/, ""), ctx),
    ),
  );
}

function blockLines(xml: string, ctx: Ctx): DocLine[] {
  const lines: DocLine[] = [];
  for (const el of topLevel(xml, ["w:p", "w:tbl", "w:sdt"])) {
    if (el.name === "w:p") lines.push(parseParagraph(el.xml, ctx));
    else if (el.name === "w:tbl") {
      lines.push({ segments: [], images: [], table: parseTable(el.xml, ctx) });
    } else {
      const content = /<w:sdtContent>([\s\S]*)<\/w:sdtContent>/.exec(el.xml)?.[1] ?? "";
      lines.push(...blockLines(content, ctx));
    }
  }
  return lines;
}

/** Read a .docx into paragraph lines with bold/highlight/colour marks. */
export function parseDocxBuffer(buffer: Buffer): DocxExtract {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error("Не удалось открыть Word-файл. Нужен .docx (не старый .doc)");
  }
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("В файле нет word/document.xml — это не .docx");
  const rels = new Map<string, string>();
  const relXml = files["word/_rels/document.xml.rels"];
  if (relXml) {
    for (const r of strFromU8(relXml).match(/<Relationship [^>]+>/g) ?? []) {
      const id = attr(r, "Id");
      const target = attr(r, "Target");
      if (id && target) rels.set(id, target);
    }
  }
  const numberingXml = files["word/numbering.xml"];
  const ctx: Ctx = {
    rels,
    files,
    numbering: parseNumbering(numberingXml ? strFromU8(numberingXml) : null),
    skippedImages: 0,
  };
  const xml = strFromU8(doc);
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
  return { lines: blockLines(body, ctx), skippedImages: ctx.skippedImages };
}

export function lineText(line: DocLine): string {
  return line.segments.map((s) => s.text).join("");
}
