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

export async function storeImage(opts: {
  buffer: Buffer;
  filename: string;
  contentType: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; url: string }> {
  const id = new ObjectId();
  const bucket = imagesBucket();
  await new Promise<void>((resolve, reject) => {
    const stream = bucket.openUploadStreamWithId(id, opts.filename, {
      contentType: opts.contentType,
      metadata: opts.metadata,
    });
    stream.on("finish", () => resolve());
    stream.on("error", reject);
    Readable.from(opts.buffer).pipe(stream);
  });
  return { id: id.toHexString(), url: fileUrl(id.toHexString()) };
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
  for (const q of questions) {
    if (!q.images?.length) {
      out.push(q);
      continue;
    }
    const images: string[] = [];
    for (let i = 0; i < q.images.length; i++) {
      images.push(
        await persistSrc(q.images[i], `q${q.id}_${i}`, {
          kind: "question",
          questionId: q.id,
        }),
      );
    }
    out.push({ ...q, images });
  }
  return out;
}
