import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";

import { runDailyPipeline } from "../src/pipeline.ts";
import { createDryRunFixture } from "../src/fixtures/dryRunFixture.ts";

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
  assert.ok(result.brief.items.length >= 10);
  assert.ok(result.brief.items.length <= 20);

  const jsonPath = path.join(dataDir, "briefs", "json", "2026-06-13.json");
  const markdownPath = path.join(dataDir, "briefs", "markdown", "2026-06-13.md");
  await stat(jsonPath);
  await stat(markdownPath);

  await assert.rejects(stat(path.join(repoRoot, "data")));
  await assert.rejects(stat(path.join(repoRoot, "logs")));

  const markdown = await readFile(markdownPath, "utf8");
  assert.match(markdown, /纳斯达克 100/);
  assert.match(markdown, /\[1\]\s/);
  assert.match(markdown, /推荐理由/);

  const latestRun = JSON.parse(await readFile(path.join(dataDir, "state", "latest-run.json"), "utf8"));
  assert.equal(latestRun.date, "2026-06-13");
  assert.equal(latestRun.aiMode, "heuristic");
  assert.equal(latestRun.tokenUsage.totalTokens, 0);
  assert.equal(latestRun.selectedItemCount, result.brief.items.length);
  assert.match(await readFile(path.join(dataDir, "logs", "daily-runs.jsonl"), "utf8"), /"tokenUsage"/);

  await rm(root, { recursive: true, force: true });
});
