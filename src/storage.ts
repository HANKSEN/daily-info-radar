import path from "node:path";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";

import type {
  ArticleCandidate,
  AnalyzedArticle,
  DailyBrief,
  DailyRunLogEntry,
  MarketSnapshot,
  SourceItem,
} from "./types.ts";

export type StoragePaths = {
  raw: string;
  candidates: string;
  analyzed: string;
  briefJson: string;
  briefMarkdown: string;
  productionMarkdown: string;
};

export async function ensureStorage(dataDir: string): Promise<void> {
  for (const relative of [
    "raw",
    "candidates",
    "briefs/json",
    "briefs/markdown",
    "briefs/production",
    "cache",
    "logs",
    "state",
    "private-config",
  ]) {
    await mkdir(path.join(dataDir, relative), { recursive: true });
  }
}

export function dailyPaths(dataDir: string, date: string): StoragePaths {
  return {
    raw: path.join(dataDir, "raw", `${date}.json`),
    candidates: path.join(dataDir, "candidates", `${date}.json`),
    analyzed: path.join(dataDir, "candidates", `${date}.analyzed.json`),
    briefJson: path.join(dataDir, "briefs", "json", `${date}.json`),
    briefMarkdown: path.join(dataDir, "briefs", "markdown", `${date}.md`),
    productionMarkdown: path.join(dataDir, "briefs", "production", `${date}.md`),
  };
}

export async function writeDailyArtifacts(input: {
  dataDir: string;
  date: string;
  raw: {
    sourceItems: SourceItem[];
    marketSnapshots: MarketSnapshot[];
    sourceHealth?: import("./types.ts").SourceHealth;
  };
  candidates: ArticleCandidate[];
  analyzed: AnalyzedArticle[];
  brief: DailyBrief;
  markdown: string;
  productionMarkdown: string;
}): Promise<StoragePaths> {
  await ensureStorage(input.dataDir);
  const paths = dailyPaths(input.dataDir, input.date);

  await writeJson(paths.raw, input.raw);
  await writeJson(paths.candidates, input.candidates);
  await writeJson(paths.analyzed, input.analyzed);
  await writeJson(paths.briefJson, input.brief);
  await writeFile(paths.briefMarkdown, input.markdown, "utf8");
  await writeFile(paths.productionMarkdown, input.productionMarkdown, "utf8");
  await writeJson(path.join(input.dataDir, "state", "latest.json"), {
    date: input.date,
    paths,
  });

  return paths;
}

export async function readLatestBrief(dataDir: string): Promise<DailyBrief> {
  const latest = JSON.parse(await readFile(path.join(dataDir, "state", "latest.json"), "utf8")) as {
    paths: { briefJson: string };
  };
  return JSON.parse(await readFile(latest.paths.briefJson, "utf8")) as DailyBrief;
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function appendDailyRunLog(dataDir: string, entry: DailyRunLogEntry): Promise<void> {
  await appendJsonLine(path.join(dataDir, "logs", "daily-runs.jsonl"), entry);
  await writeJson(path.join(dataDir, "state", "latest-run.json"), entry);
}

async function appendJsonLine(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}
