import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

const candidateEnvFiles = [".env", ".env.local", "../.env", "../.env.local"] as const;

for (const candidate of candidateEnvFiles) {
  const resolved = path.resolve(process.cwd(), candidate);
  if (existsSync(resolved)) {
    config({ path: resolved });
    break;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

const corsOrigins = parsed.data.CORS_ORIGINS
  ? parsed.data.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

export const env = {
  ...parsed.data,
  corsOrigins,
};
