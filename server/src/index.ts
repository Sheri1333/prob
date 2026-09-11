import "./tlsSetup.js";
import cors from "cors";
import express from "express";
import { connectDb, isDbReady } from "./db.js";
import { UPLOADS_DIR } from "./pdfParser.js";
import { authRouter } from "./routes/auth.js";
import { testsRouter } from "./routes/tests.js";
import { attemptsRouter } from "./routes/attempts.js";
import { adminRouter } from "./routes/admin.js";
import { examsRouter } from "./routes/exams.js";
import { filesRouter } from "./routes/files.js";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  ...(process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
];

const corsMw = cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, allowedOrigins.includes(origin) ? origin : false);
  },
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
  maxAge: 86400,
});

const app = express();
app.disable("x-powered-by");
app.use(corsMw);
app.options(/.*/, corsMw);
app.use(express.json({ limit: "40mb" }));

app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "talapker-api",
    db: isDbReady() ? "up" : "down",
  });
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/health") || req.path.startsWith("/uploads")) {
    next();
    return;
  }
  if (!isDbReady()) {
    res.status(503).json({ error: "База ещё не подключена, повторите через несколько секунд" });
    return;
  }
  next();
});

app.use("/api/auth", authRouter);
app.use("/api/tests", testsRouter);
app.use("/api/attempts", attemptsRouter);
app.use("/api/exams", examsRouter);
app.use("/api/files", filesRouter);
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

const server = app.listen(PORT, HOST, () => {
  console.log(`Талапкер API http://${HOST}:${PORT}`);
  console.log(`Uploads ${UPLOADS_DIR}`);
});

async function connectLoop(): Promise<void> {
  for (;;) {
    try {
      await connectDb();
      return;
    } catch (err) {
      console.error(
        "MongoDB failed:",
        err instanceof Error ? err.message : err,
      );
      console.error(
        "Check MONGODB_URI and that MongoDB is running. Retry in 8s...",
      );
      await new Promise((resolve) => setTimeout(resolve, 8000));
    }
  }
}

void connectLoop();

export default app;
export { server };
