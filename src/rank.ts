import type { AnalyzedArticle } from "./types.ts";

const MINIMUM_MAIN_BRIEF_SCORE = 3;
const NEGATIVE_REASON_PATTERNS = [
  /信号一般/u,
  /信号弱/u,
  /非高价值/u,
  /非核心/u,
  /低分/u,
  /低价值/u,
  /时效性低/u,
];

export function rankArticles(
  articles: AnalyzedArticle[],
  options: { minItems: number; maxItems: number },
): AnalyzedArticle[] {
  const sorted = [...articles].sort((a, b) => scoreArticle(b) - scoreArticle(a));
  return sorted.filter(isMainBriefQuality).slice(0, options.maxItems);
}

function isMainBriefQuality(article: AnalyzedArticle): boolean {
  if (!article.selected) return false;
  if (article.valueScore < MINIMUM_MAIN_BRIEF_SCORE) return false;
  return !NEGATIVE_REASON_PATTERNS.some((pattern) => pattern.test(article.recommendationReason));
}

function scoreArticle(article: AnalyzedArticle): number {
  return (
    article.valueScore * 10 +
    article.localSignals.duplicateCount * 1.5 +
    article.localSignals.sourceWeight +
    article.localSignals.freshnessScore
  );
}
