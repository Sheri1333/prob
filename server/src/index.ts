import cors from "cors";
import express from "express";
import { connectDb } from "./db.js";
import { UPLOADS_DIR } from "./pdfParser.js";
import { authRouter } from "./routes/auth.js";
import { testsRouter } from "./routes/tests.js";
import { attemptsRouter } from "./routes/attempts.js";
import { adminRouter } from "./routes/admin.js";

const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "40mb" }));

app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "prob-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/tests", testsRouter);
app.use("/api/attempts", attemptsRouter);
app.use("/api/admin", adminRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal error" });
  },
);

await connectDb();
app.listen(PORT, () => {
  console.log(`PROB API http://localhost:${PORT}`);
  console.log(`Uploads ${UPLOADS_DIR}`);
});

export default app;
