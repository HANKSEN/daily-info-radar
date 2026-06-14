import test from "node:test";
import assert from "node:assert/strict";

import { fairSampleCandidates } from "../src/sampling.ts";
import type { ArticleCandidate } from "../src/types.ts";

test("fairSampleCandidates applies a per-source cap and round-robin source sampling", () => {
  const sampled = fairSampleCandidates(
    [
      candidate("a", "a1"),
      candidate("a", "a2"),
      candidate("a", "a3"),
      candidate("b", "b1"),
      candidate("b", "b2"),
      candidate("c", "c1"),
    ],
    { maxTotal: 5, maxPerSource: 2 },
  );

  assert.deepEqual(sampled.map((item) => item.title), ["a1", "b1", "c1", "a2", "b2"]);
});

function candidate(sourceId: string, title: string): ArticleCandidate {
  return {
    sourceId,
    sourceName: sourceId,
    sourceWeight: 1,
    title,
    url: `https://example.com/${title}`,
    canonicalUrl: `https://example.com/${title}`,
    dedupeKey: title,
    localSignals: {
      sourceWeight: 1,
      freshnessScore: 1,
      duplicateCount: 1,
    },
  };
}
