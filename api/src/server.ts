import cors from "cors";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { projectsRouter } from "./routes/projects.js";
import { sessionsRouter } from "./routes/sessions.js";
import { usersRouter } from "./routes/users.js";

const app = express();

app.use(
  cors({
    origin: env.corsOrigins.length ? env.corsOrigins : true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

app.use("/users", usersRouter);
app.use("/projects", projectsRouter);
app.use("/sessions", sessionsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      issues: err.flatten(),
    });
    return;
  }

  console.error("API error", err);
  res.status(500).json({ error: "Internal Server Error" });
};

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});

const shutdown = async () => {
  console.log("Shutting down API server...");
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
