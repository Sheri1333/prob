/**
 * Re-encode stored PNG/JPEG question images as WebP, keeping each file's id so
 * the /api/files/<id> links inside tests keep working.
 * Run (from server/):  npx tsx src/compressImages.ts --dry-run   then without the flag.
 * Back up the images.* collections first; a file is replaced in place.
 */
import { closeDb, connectDb } from "./db.js";
import { compressImage, imagesBucket, writeImage } from "./gridfs.js";

const dryRun = process.argv.includes("--dry-run");

async function readFile(id: unknown): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of imagesBucket().openDownloadStream(id as never)) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function main() {
  await connectDb();
  const bucket = imagesBucket();
  const files = await bucket
    .find({ contentType: { $in: ["image/png", "image/jpeg", "image/jpg"] } })
    .toArray();

  let before = 0;
  let after = 0;
  let converted = 0;
  for (const file of files) {
    const original = await readFile(file._id);
    const image = await compressImage(original, file.contentType ?? "", file.filename);
    before += original.length;
    after += image.buffer.length;
    if (image.buffer === original) continue;
    converted += 1;
    if (dryRun) continue;
    await bucket.delete(file._id);
    await writeImage(file._id, image, file.metadata);
  }

  const mb = (n: number) => (n / 1048576).toFixed(1);
  console.log(
    `${dryRun ? "[dry run] " : ""}${converted}/${files.length} files -> WebP; ` +
      `${mb(before)} MB -> ${mb(after)} MB`,
  );
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
