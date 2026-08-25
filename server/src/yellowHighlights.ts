import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export interface HighlightHit {
  page: number;
  x: number;
  y: number;
  text: string;
}

export interface QuestionMarker {
  page: number;
  x: number;
  y: number;
  id: number;
}

export interface HighlightExtract {
  hits: HighlightHit[];
  markers: QuestionMarker[];
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface TextRun {
  str: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function toUnit(n: number): number {
  return n > 1 ? n / 255 : n;
}

function isYellow(rgb: Rgb | null): boolean {
  if (!rgb) return false;
  const r = toUnit(rgb.r);
  const g = toUnit(rgb.g);
  const b = toUnit(rgb.b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 0.55) return false;
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.12) return false;
  return r >= 0.72 && g >= 0.62 && b <= 0.82 && (r + g) / 2 - b >= 0.12;
}

function cmykToRgb(c: number, m: number, y: number, k: number): Rgb {
  return {
    r: 1 - Math.min(1, c * (1 - k) + k),
    g: 1 - Math.min(1, m * (1 - k) + k),
    b: 1 - Math.min(1, y * (1 - k) + k),
  };
}

function applyTransform(x: number, y: number, m: number[]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function transformRect(rect: Rect, matrix: number[]): Rect {
  const pts = [
    applyTransform(rect.x0, rect.y0, matrix),
    applyTransform(rect.x1, rect.y0, matrix),
    applyTransform(rect.x0, rect.y1, matrix),
    applyTransform(rect.x1, rect.y1, matrix),
  ];
  return {
    x0: Math.min(pts[0][0], pts[1][0], pts[2][0], pts[3][0]),
    y0: Math.min(pts[0][1], pts[1][1], pts[2][1], pts[3][1]),
    x1: Math.max(pts[0][0], pts[1][0], pts[2][0], pts[3][0]),
    y1: Math.max(pts[0][1], pts[1][1], pts[2][1], pts[3][1]),
  };
}

function overlaps(a: Rect, b: Rect, pad = 4): boolean {
  return (
    a.x0 < b.x1 + pad &&
    a.x1 > b.x0 - pad &&
    a.y0 < b.y1 + pad &&
    a.y1 > b.y0 - pad
  );
}

function rectSizeOk(rect: Rect): boolean {
  const w = Math.abs(rect.x1 - rect.x0);
  const h = Math.abs(rect.y1 - rect.y0);
  return w >= 8 && h >= 3 && h <= 48 && w <= 520;
}

function looksLikeLineHighlight(rect: Rect): boolean {
  const w = Math.abs(rect.x1 - rect.x0);
  const h = Math.abs(rect.y1 - rect.y0);
  return w >= 16 && h >= 3 && h <= 42 && w / Math.max(h, 1) >= 1.6;
}

function isYellowPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 80) return false;
  return r >= 180 && g >= 160 && b <= 170 && (r + g) / 2 - b >= 40;
}

function findYellowPixelRects(
  data: Uint8ClampedArray | Buffer,
  width: number,
  height: number,
): Rect[] {
  const step = 2;
  const minRun = 14;
  const runs: { x0: number; x1: number; y: number }[] = [];

  for (let y = 0; y < height; y += step) {
    let x = 0;
    while (x < width) {
      const i = (y * width + x) * 4;
      if (isYellowPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        let x1 = x + 1;
        while (x1 < width) {
          const j = (y * width + x1) * 4;
          if (!isYellowPixel(data[j], data[j + 1], data[j + 2], data[j + 3])) {
            break;
          }
          x1 += 1;
        }
        if (x1 - x >= minRun) runs.push({ x0: x, x1, y });
        x = x1;
      } else {
        x += step;
      }
    }
  }

  const groups: { x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const run of runs) {
    const g = groups.find(
      (item) =>
        run.y <= item.y1 + 6 &&
        run.x0 <= item.x1 + 18 &&
        run.x1 >= item.x0 - 18,
    );
    if (g) {
      g.x0 = Math.min(g.x0, run.x0);
      g.x1 = Math.max(g.x1, run.x1);
      g.y1 = Math.max(g.y1, run.y);
    } else {
      groups.push({ x0: run.x0, x1: run.x1, y0: run.y, y1: run.y });
    }
  }

  return groups
    .map((g) => ({
      x0: g.x0,
      y0: g.y0,
      x1: g.x1,
      y1: g.y1 + 3,
    }))
    .filter((r) => looksLikeLineHighlight(r));
}

function canvasRectToPdf(
  rect: Rect,
  imgW: number,
  imgH: number,
  view: number[],
): Rect {
  const x0 = view[0] + (rect.x0 / imgW) * (view[2] - view[0]);
  const x1 = view[0] + (rect.x1 / imgW) * (view[2] - view[0]);
  const yBottom = view[3] - (rect.y1 / imgH) * (view[3] - view[1]);
  const yTop = view[3] - (rect.y0 / imgH) * (view[3] - view[1]);
  return {
    x0: Math.min(x0, x1),
    y0: Math.min(yBottom, yTop),
    x1: Math.max(x0, x1),
    y1: Math.max(yBottom, yTop),
  };
}

async function yellowRectsFromRaster(
  page: {
    getViewport: (opts: { scale: number }) => { width: number; height: number };
    render: (params: Record<string, unknown>) => { promise: Promise<void> };
    view: number[];
  },
  canvasFactory: {
    create: (
      width: number,
      height: number,
    ) => {
      canvas: unknown;
      context: {
        getImageData: (
          x: number,
          y: number,
          w: number,
          h: number,
        ) => { data: Uint8ClampedArray };
      };
    };
  },
): Promise<Rect[]> {
  try {
    const scale = 1.4;
    const viewport = page.getViewport({ scale });
    const width = Math.max(1, Math.floor(viewport.width));
    const height = Math.max(1, Math.floor(viewport.height));
    const canvasAndContext = canvasFactory.create(width, height);
    await page.render({
      canvas: canvasAndContext.canvas,
      canvasContext: canvasAndContext.context,
      viewport,
    }).promise;
    const image = canvasAndContext.context.getImageData(0, 0, width, height);
    const pixelRects = findYellowPixelRects(image.data, width, height);
    return pixelRects.map((r) => canvasRectToPdf(r, width, height, page.view));
  } catch {
    return [];
  }
}

function textInRects(runs: TextRun[], rects: Rect[]): string {
  const hit = runs
    .filter((run) => rects.some((r) => overlaps(run, r)))
    .sort((a, b) => (Math.abs(a.y0 - b.y0) > 2 ? b.y0 - a.y0 : a.x0 - b.x0));
  return hit
    .map((r) => r.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function annotationRects(annot: {
  subtype?: string;
  rect?: number[];
  color?: ArrayLike<number> | null;
  quadPoints?: number[] | null;
}): Rect[] {
  const subtype = annot.subtype ?? "";
  const color = annot.color
    ? { r: annot.color[0], g: annot.color[1], b: annot.color[2] }
    : null;
  const accept =
    subtype === "Highlight" ||
    subtype === "Underline" ||
    (subtype === "Square" && isYellow(color)) ||
    (color !== null && isYellow(color));
  if (!accept) return [];

  const rects: Rect[] = [];
  const quads = annot.quadPoints;
  if (quads && quads.length >= 8) {
    for (let i = 0; i + 7 < quads.length; i += 8) {
      const xs = [quads[i], quads[i + 2], quads[i + 4], quads[i + 6]];
      const ys = [quads[i + 1], quads[i + 3], quads[i + 5], quads[i + 7]];
      rects.push({
        x0: Math.min(...xs),
        y0: Math.min(...ys),
        x1: Math.max(...xs),
        y1: Math.max(...ys),
      });
    }
  } else if (annot.rect && annot.rect.length >= 4) {
    rects.push({
      x0: Math.min(annot.rect[0], annot.rect[2]),
      y0: Math.min(annot.rect[1], annot.rect[3]),
      x1: Math.max(annot.rect[0], annot.rect[2]),
      y1: Math.max(annot.rect[1], annot.rect[3]),
    });
  }
  return rects.filter(rectSizeOk);
}

function yellowRectsFromOps(opList: {
  fnArray: number[];
  argsArray: unknown[];
}): Rect[] {
  const OPS = pdfjs.OPS as Record<string, number>;
  let fill: Rgb | null = null;
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const rects: Rect[] = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const rawArgs = opList.argsArray[i];
    const args = (Array.isArray(rawArgs) ? rawArgs : []) as unknown[];

    if (fn === OPS.setFillRGBColor || fn === OPS.setStrokeRGBColor) {
      if (fn === OPS.setFillRGBColor) {
        fill = { r: Number(args[0]), g: Number(args[1]), b: Number(args[2]) };
      }
    } else if (fn === OPS.setFillCMYKColor) {
      fill = cmykToRgb(
        Number(args[0]),
        Number(args[1]),
        Number(args[2]),
        Number(args[3]),
      );
    } else if (fn === OPS.setFillGray) {
      fill = { r: Number(args[0]), g: Number(args[0]), b: Number(args[0]) };
    } else if (fn === OPS.setFillColor && args.length >= 3) {
      fill = { r: Number(args[0]), g: Number(args[1]), b: Number(args[2]) };
    } else if (fn === OPS.save) {
      stack.push(matrix.slice());
    } else if (fn === OPS.restore) {
      matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform && args.length >= 6) {
      matrix = pdfjs.Util.transform(matrix, args as number[]);
    } else if (fn === OPS.constructPath) {
      const op = Number(args[0] ?? 0);
      const mm = args[2] as number[] | undefined;
      const isFill =
        op === OPS.fill ||
        op === OPS.eoFill ||
        op === OPS.fillStroke ||
        op === OPS.eoFillStroke;
      if (!isFill || !isYellow(fill) || !mm || mm.length < 4) continue;
      if (!Number.isFinite(mm[0]) || mm[0] === Infinity) continue;
      const raw: Rect = {
        x0: mm[0],
        y0: mm[1],
        x1: mm[2],
        y1: mm[3],
      };
      const mapped = transformRect(raw, matrix);
      if (rectSizeOk(mapped)) rects.push(mapped);
    }
  }

  return rects;
}

/**
 * Collect text that sits on yellow highlight marks (Word fill or PDF highlighter).
 */
export async function extractYellowHighlights(
  buffer: Buffer,
): Promise<HighlightExtract> {
  const data = new Uint8Array(buffer);
  const loading = pdfjs.getDocument({
    data,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const doc = await loading.promise;
  const hits: HighlightHit[] = [];
  const markers: QuestionMarker[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const runs: TextRun[] = [];
      const items = textContent.items;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!("str" in item) || !item.str) continue;
        const tm = item.transform;
        const x = tm[4];
        const y = tm[5];
        const w = item.width ?? 0;
        const h = item.height || Math.abs(tm[3]) || 10;
        runs.push({ str: item.str, x0: x, y0: y, x1: x + w, y1: y + h });

        let id: number | null = null;
        const num = item.str.match(/(\d{1,2})\s*\./);
        if (num) {
          id = Number(num[1]);
        } else {
          // pdf.js sometimes splits "21." into separate "21" and "."
          // runs at a font/kerning boundary — treat an adjacent pair on
          // the same line as one marker.
          const bare = item.str.match(/^\s*(\d{1,2})\s*$/);
          const next = items[i + 1];
          if (
            bare &&
            next &&
            "str" in next &&
            typeof next.str === "string" &&
            /^\s*\./.test(next.str)
          ) {
            const ntm = next.transform;
            const sameLine = Math.abs(ntm[5] - y) < 3;
            const closeX = ntm[4] - (x + w) < 20 && ntm[4] >= x - 1;
            if (sameLine && closeX) id = Number(bare[1]);
          }
        }
        if (id !== null) {
          markers.push({ page: pageNum, x, y, id });
        }
      }

      const rects: Rect[] = [];
      const annots = await page.getAnnotations();
      for (const annot of annots) {
        rects.push(...annotationRects(annot as never));
      }

      const opList = await page.getOperatorList();
      rects.push(...yellowRectsFromOps(opList));
      const canvasFactory = (
        doc as unknown as {
          canvasFactory?: {
            create: (
              width: number,
              height: number,
            ) => {
              canvas: unknown;
              context: {
                getImageData: (
                  x: number,
                  y: number,
                  w: number,
                  h: number,
                ) => { data: Uint8ClampedArray };
              };
            };
          };
        }
      ).canvasFactory;
      if (canvasFactory) {
        rects.push(
          ...(await yellowRectsFromRaster(
            page as unknown as Parameters<typeof yellowRectsFromRaster>[0],
            canvasFactory,
          )),
        );
      }

      for (const rect of rects) {
        const text = textInRects(runs, [rect]);
        if (text.length < 1) continue;
        hits.push({
          page: pageNum,
          x: (rect.x0 + rect.x1) / 2,
          y: (rect.y0 + rect.y1) / 2,
          text,
        });
      }
    }
  } finally {
    await doc.destroy();
  }

  return { hits, markers };
}
