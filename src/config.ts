import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import type { RuntimeConfig, SourceConfig } from "./types.ts";

export type LoadRuntimeConfigOptions = {
  repoRoot?: string;
  env?: Record<string, string | undefined>;
};

export function getDefaultRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function loadRuntimeConfig(options: LoadRuntimeConfigOptions = {}): RuntimeConfig {
  const repoRoot = path.resolve(options.repoRoot ?? getDefaultRepoRoot());
  const env = options.env ?? process.env;
  const dataDir = path.resolve(
    env.RADAR_DATA_DIR ?? path.join(repoRoot, "..", "daily-info-radar.local-data"),
  );

  assertPrivateDataDir(repoRoot, dataDir);

  return {
    repoRoot,
    dataDir,
    timezone: env.RADAR_TIMEZONE ?? "Asia/Shanghai",
    minItems: parsePositiveInt(env.RADAR_MIN_ITEMS, 10),
    maxItems: parsePositiveInt(env.RADAR_MAX_ITEMS, 20),
    candidatePoolMax: parsePositiveInt(env.RADAR_CANDIDATE_POOL_MAX, 80),
    maxPerSource: parsePositiveInt(env.RADAR_MAX_PER_SOURCE, 8),
    ai: {
      mode: parseAiMode(env.RADAR_AI_MODE),
      baseUrl: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL,
    },
  };
}

export async function loadSourceConfig(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): Promise<SourceConfig[]> {
  const localPath = path.join(repoRoot, "config", "sources.json");
  const examplePath = path.join(repoRoot, "config", "sources.example.json");
  const content = await readFirstExisting([localPath, examplePath]);
  const parsed = JSON.parse(content) as { sources?: SourceConfig[] };
  return (parsed.sources ?? [])
    .filter((source) => source.enabled !== false)
    .map((source) => ({
      ...source,
      url: expandConfigPlaceholders(source.url, env),
    }));
}

export async function loadDotEnv(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): Promise<Record<string, string | undefined>> {
  const merged = { ...env };
  try {
    const content = await readFile(path.join(repoRoot, ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");
      if (!merged[key]) merged[key] = value;
    }
  } catch {
    return merged;
  }
  return merged;
}

export function assertPrivateDataDir(repoRoot: string, dataDir: string): void {
  const relative = path.relative(repoRoot, dataDir);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error(
      `RADAR_DATA_DIR must be outside the repository to avoid leaking production data: ${dataDir}`,
    );
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAiMode(value: string | undefined): "openai" | "heuristic" {
  return value === "heuristic" ? "heuristic" : "openai";
}

function expandConfigPlaceholders(
  value: string,
  env: Record<string, string | undefined>,
): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, key: string) => {
    const replacement = env[key] ?? defaultPlaceholderValue(key);
    if (!replacement) return "";
    if (key === "RSSHUB_BASE_URL") return replacement.replace(/\/+$/, "");
    return replacement;
  });
}

function defaultPlaceholderValue(key: string): string | undefined {
  if (key === "RSSHUB_BASE_URL") return "https://rsshub.app";
  return undefined;
}

async function readFirstExisting(paths: string[]): Promise<string> {
  const errors: unknown[] = [];
  for (const candidate of paths) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      errors.push(error);
    }
  }
  throw new Error(`Unable to read any config file: ${paths.join(", ")}`, { cause: errors });
}
