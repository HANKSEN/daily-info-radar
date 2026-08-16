import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";

import { buildCandidates, runDailyPipeline } from "../src/pipeline.ts";
import { createDryRunFixture } from "../src/fixtures/dryRunFixture.ts";
import type { SourceItem } from "../src/types.ts";

test("dry-run pipeline writes daily outputs only to the private data directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "radar-pipeline-"));
  const repoRoot = path.join(root, "daily-info-radar");
  const dataDir = path.join(root, "daily-info-radar.local-data");
  const fixture = createDryRunFixture();

  const result = await runDailyPipeline({
    repoRoot,
    dataDir,
    now: new Date("2026-06-13T00:30:00.000Z"),
    sourceItems: fixture.sourceItems,
    marketSnapshots: fixture.marketSnapshots,
    dryRun: true,
  });

  assert.equal(result.brief.date, "2026-06-13");
  assert.ok(result.brief.items.length > 0);
  assert.ok(result.brief.items.length <= 20);
  assert.ok(result.brief.items.every((item) => item.selected && item.valueScore >= 3));

  const jsonPath = path.join(dataDir, "briefs", "json", "2026-06-13.json");
  const markdownPath = path.join(dataDir, "briefs", "markdown", "2026-06-13.md");
  const productionPath = path.join(dataDir, "briefs", "production", "2026-06-13.md");
  await stat(jsonPath);
  await stat(markdownPath);
  await stat(productionPath);

  await assert.rejects(stat(path.join(repoRoot, "data")));
  await assert.rejects(stat(path.join(repoRoot, "logs")));

  const markdown = await readFile(markdownPath, "utf8");
  assert.match(markdown, /纳斯达克 100/);
  assert.match(markdown, /\[1\]\s/);
  assert.match(markdown, /推荐理由/);
  assert.match(markdown, /认知优先级/);

  const production = await readFile(productionPath, "utf8");
  assert.match(production, /# 认知生产线 - 2026-06-13/);
  assert.match(production, /今日精读入口/);
  assert.match(production, /认知增量卡片草稿/);

  const latestRun = JSON.parse(await readFile(path.join(dataDir, "state", "latest-run.json"), "utf8"));
  assert.equal(latestRun.date, "2026-06-13");
  assert.equal(latestRun.aiMode, "heuristic");
  assert.equal(latestRun.tokenUsage.totalTokens, 0);
  assert.equal(latestRun.selectedItemCount, result.brief.items.length);
  assert.match(await readFile(path.join(dataDir, "logs", "daily-runs.jsonl"), "utf8"), /"tokenUsage"/);

  await rm(root, { recursive: true, force: true });
});

test("buildCandidates keeps only items published in the previous 24 hours", () => {
  const now = new Date("2026-06-15T08:30:00.000Z");
  const items: SourceItem[] = [
    item("recent", "Recent model release", "2026-06-15T08:00:00.000Z"),
    item("boundary", "Boundary AI funding news", "2026-06-14T08:30:00.000Z"),
    item("stale", "Stale product update", "2026-06-14T08:29:59.000Z"),
    item("future", "Future launch rumor", "2026-06-15T08:31:00.000Z"),
    item("unknown", "Unknown publish time"),
  ];

  const candidates = buildCandidates(items, {
    now,
    candidatePoolMax: 10,
    maxPerSource: 10,
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.sourceId),
    ["recent", "boundary"],
  );
});

function item(sourceId: string, title: string, publishedAt?: string): SourceItem {
  return {
    sourceId,
    sourceName: sourceId,
    title,
    url: `https://example.com/${sourceId}`,
    publishedAt,
    summary: "AI and tech market update.",
    domainHint: "ai",
  };
}
