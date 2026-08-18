import { Router } from "express";
import { findImage, imagesBucket } from "../gridfs.js";

export const filesRouter = Router();

filesRouter.get("/:id", async (req, res) => {
  const file = await findImage(req.params.id);
  if (!file) {
    res.status(404).json({ error: "Файл не найден" });
    return;
  }
  res.setHeader("Content-Type", file.contentType || "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  if (file.filename) {
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.filename)}"`,
    );
  }
  const stream = imagesBucket().openDownloadStream(file._id);
  stream.on("error", () => {
    if (!res.headersSent) res.status(404).end();
    else res.end();
  });
  stream.pipe(res);
});
