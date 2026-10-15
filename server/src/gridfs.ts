import { createCanvas, loadImage } from "@napi-rs/canvas";
import { GridFSBucket, ObjectId, type GridFSFile } from "mongodb";
import { Readable } from "node:stream";
import { getDb } from "./db.js";
import type { Question } from "./scoring.js";

const BUCKET_NAME = "images";

export function imagesBucket(): GridFSBucket {
  return new GridFSBucket(getDb(), { bucketName: BUCKET_NAME });
}

export function fileUrl(id: string): string {
  return `/api/files/${id}`;
}

const WEBP_QUALITY = 85;
const MAX_IMAGE_WIDTH = 1600;
const CONVERTIBLE = new Set(["image/png", "image/jpeg", "image/jpg"]);

/**
 * Re-encodes PNG/JPEG as WebP (question scans and screenshots shrink 2-10x),
 * downscaling anything wider than MAX_IMAGE_WIDTH. Keeps the original when it
 * is another format, cannot be decoded, or would not get smaller.
 */
export async function compressImage(
  buffer: Buffer,
  contentType: string,
  filename: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const original = { buffer, contentType, filename };
  if (!CONVERTIBLE.has(contentType.toLowerCase())) return original;
  try {
    const img = await loadImage(buffer);
    const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = createCanvas(width, height);
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    const webp = await canvas.encode("webp", WEBP_QUALITY);
    if (webp.length >= buffer.length) return original;
    return {
      buffer: webp,
      contentType: "image/webp",
      filename: filename.replace(/\.(png|jpe?g)$/i, "") + ".webp",
    };
  } catch {
    return original;
  }
}

export async function storeImage(opts: {
  buffer: Buffer;
  filename: string;
  contentType: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; url: string }> {
  const id = new ObjectId();
  const image = await compressImage(opts.buffer, opts.contentType, opts.filename);
  await writeImage(id, image, opts.metadata);
  return { id: id.toHexString(), url: fileUrl(id.toHexString()) };
}

/** Writes a GridFS file under a fixed id (also used to re-encode in place). */
export async function writeImage(
  id: ObjectId,
  image: { buffer: Buffer; contentType: string; filename: string },
  metadata?: Record<string, unknown>,
): Promise<void> {
  const bucket = imagesBucket();
  await new Promise<void>((resolve, reject) => {
    const stream = bucket.openUploadStreamWithId(id, image.filename, {
      contentType: image.contentType,
      metadata,
    });
    stream.on("finish", () => resolve());
    stream.on("error", reject);
    Readable.from(image.buffer).pipe(stream);
  });
}

export async function findImage(id: string): Promise<GridFSFile | null> {
  if (!ObjectId.isValid(id)) return null;
  const oid = new ObjectId(id);
  if (oid.toHexString() !== id) return null;
  const files = await imagesBucket().find({ _id: oid }).toArray();
  return files[0] ?? null;
}

const DATA_IMAGE =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i;

async function persistSrc(
  src: string,
  filename: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  if (
    src.startsWith("/api/files/") ||
    src.startsWith("/uploads/") ||
    src.startsWith("http://") ||
    src.startsWith("https://")
  ) {
    return src;
  }
  const match = DATA_IMAGE.exec(src.replace(/\s/g, ""));
  if (!match) return src;
  const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  const contentType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const { url } = await storeImage({
    buffer: Buffer.from(match[2], "base64"),
    filename: `${filename}.${ext}`,
    contentType,
    metadata,
  });
  return url;
}

export async function persistCoverImage(src: string | undefined): Promise<string> {
  if (!src) return "";
  return persistSrc(src, "cover", { kind: "cover" });
}

export async function persistQuestionImages(
  questions: Question[],
): Promise<Question[]> {
  const out: Question[] = [];
  // A passage picture is shared by several questions — store it once.
  const saved = new Map<string, string>();
  for (const q of questions) {
    let next: Question = q;
    if (q.images?.length) {
      const images: string[] = [];
      for (let i = 0; i < q.images.length; i++) {
        const src = q.images[i];
        let url = saved.get(src);
        if (!url) {
          url = await persistSrc(src, `q${q.id}_${i}`, {
            kind: "question",
            questionId: q.id,
          });
          saved.set(src, url);
        }
        images.push(url);
      }
      next = { ...next, images };
    }
    if (next.type === "matching") {
      const rows = [];
      for (const row of next.rows) {
        if (!row.image) {
          rows.push(row);
          continue;
        }
        rows.push({
          ...row,
          image: await persistSrc(row.image, `q${q.id}_r${row.id}`, {
            kind: "matching-row",
            questionId: q.id,
            rowId: row.id,
          }),
        });
      }
      next = { ...next, rows };
    }
    out.push(next);
  }
  return out;
}
