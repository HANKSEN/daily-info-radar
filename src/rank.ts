import type { AnalyzedArticle } from "./types.ts";

export function rankArticles(
  articles: AnalyzedArticle[],
  options: { minItems: number; maxItems: number },
): AnalyzedArticle[] {
  const sorted = [...articles].sort((a, b) => scoreArticle(b) - scoreArticle(a));
  const selected = sorted.filter((article) => article.selected && article.valueScore >= 3);
  const pool = selected.length >= options.minItems ? selected : sorted;
  return pool.slice(0, options.maxItems);
}

function scoreArticle(article: AnalyzedArticle): number {
  return (
    article.valueScore * 10 +
    article.localSignals.duplicateCount * 1.5 +
    article.localSignals.sourceWeight +
    article.localSignals.freshnessScore
  );
}
