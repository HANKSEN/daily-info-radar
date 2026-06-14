import type { ArticleCandidate } from "./types.ts";

export function dedupeCandidates(candidates: ArticleCandidate[]): ArticleCandidate[] {
  const urlGroups = groupBy(candidates, (candidate) => candidate.canonicalUrl);
  const urlDeduped = Array.from(urlGroups.values()).map(mergeGroup);
  const titleGroups = groupBy(urlDeduped, (candidate) => candidate.dedupeKey);
  return Array.from(titleGroups.values()).map(mergeGroup);
}

function mergeGroup(group: ArticleCandidate[]): ArticleCandidate {
  const [first, ...rest] = group;
  const all = [first, ...rest];
  const duplicateCount = all.reduce(
    (count, candidate) => count + candidate.localSignals.duplicateCount,
    0,
  );

  return {
    ...first,
    summary: first.summary ?? rest.find((candidate) => candidate.summary)?.summary,
    localSignals: {
      sourceWeight: Math.max(...all.map((candidate) => candidate.localSignals.sourceWeight)),
      freshnessScore: Math.max(...all.map((candidate) => candidate.localSignals.freshnessScore)),
      duplicateCount,
    },
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const current = groups.get(key);
    if (current) {
      current.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}
