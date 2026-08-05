import cors from "cors";
import express from "express";
import "./db.js";
import { authRouter } from "./routes/auth.js";
import { testsRouter } from "./routes/tests.js";
import { attemptsRouter } from "./routes/attempts.js";
import { adminRouter } from "./routes/admin.js";

const PORT = Number(process.env.PORT) || 3001;

const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = corsOrigin
  ? {
      origin: corsOrigin.split(",").map((s) => s.trim()),
      credentials: true,
    }
  : { origin: true, credentials: true };

const app = express();
app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));

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

app.listen(PORT, () => {
  console.log(`PROB API http://localhost:${PORT}`);
});

export default app;