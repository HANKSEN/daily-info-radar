import type { ArticleCandidate } from "./types.ts";

export function fairSampleCandidates(
  candidates: ArticleCandidate[],
  options: { maxTotal: number; maxPerSource: number },
): ArticleCandidate[] {
  const bySource = new Map<string, ArticleCandidate[]>();
  for (const candidate of candidates) {
    const bucket = bySource.get(candidate.sourceId) ?? [];
    if (bucket.length < options.maxPerSource) {
      bucket.push(candidate);
      bySource.set(candidate.sourceId, bucket);
    }
  }

  const sourceIds = Array.from(bySource.keys());
  const sampled: ArticleCandidate[] = [];
  let index = 0;
  while (sampled.length < options.maxTotal) {
    let addedThisRound = false;
    for (const sourceId of sourceIds) {
      const bucket = bySource.get(sourceId) ?? [];
      const item = bucket[index];
      if (item) {
        sampled.push(item);
        addedThisRound = true;
        if (sampled.length >= options.maxTotal) break;
      }
    }
    if (!addedThisRound) break;
    index += 1;
  }

  return sampled;
}
