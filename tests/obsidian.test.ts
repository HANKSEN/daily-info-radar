import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { addBriefItemToReadingList } from "../src/obsidian.ts";
import type { DailyBrief } from "../src/types.ts";

test("addBriefItemToReadingList appends a dated checklist item and avoids duplicates", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "radar-obsidian-"));
  const filePath = path.join(dir, "信息待读清单.md");
  const brief = createBrief();

  const first = await addBriefItemToReadingList({ brief, itemNumber: 1, filePath });
  const second = await addBriefItemToReadingList({ brief, itemNumber: 1, filePath });
  const content = await readFile(filePath, "utf8");

  assert.equal(first.status, "added");
  assert.equal(second.status, "duplicate");
  assert.match(content, /## 2026-06-14/);
  assert.match(content, /- \[ \] \[OpenAI update\]\(https:\/\/example.com\/openai\)/);
  assert.match(content, /认知优先级：精读 \/ 5\/5/);
  assert.match(content, /增量假设：可能更新我对模型生态优先级的判断。/);

  await rm(dir, { recursive: true, force: true });
});

function createBrief(): DailyBrief {
  return {
    date: "2026-06-14",
    generatedAt: "2026-06-14T00:00:00.000Z",
    marketSnapshot: [],
    sourceStats: {},
    items: [
      {
        sourceId: "openai",
        sourceName: "OpenAI Blog",
        sourceWeight: 1,
        title: "OpenAI update",
        url: "https://example.com/openai",
        canonicalUrl: "https://example.com/openai",
        dedupeKey: "openai update",
        domain: "ai",
        contentType: "official",
        useTags: ["值得深读"],
        valueScore: 5,
        selected: true,
        recommendationReason: "官方发布。",
        cognitiveSignal: {
          score: 5,
          priority: "精读",
          tags: ["判断更新", "创作素材"],
          hypothesis: "可能更新我对模型生态优先级的判断。",
          contentAngle: "拆解官方发布背后的产品影响。",
        },
        localSignals: {
          sourceWeight: 1,
          freshnessScore: 1,
          duplicateCount: 1,
        },
      },
    ],
  };
}
