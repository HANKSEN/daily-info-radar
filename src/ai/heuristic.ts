import type { AnalyzedArticle, ArticleCandidate, ContentType, Domain, UseTag } from "../types.ts";
import { buildCognitiveSignal } from "../cognitive.ts";

export function analyzeCandidatesHeuristically(candidates: ArticleCandidate[]): AnalyzedArticle[] {
  return candidates.map((candidate) => {
    const domain = inferDomain(candidate);
    const contentType = inferContentType(candidate, domain);
    const valueScore = inferValueScore(candidate, contentType);
    const useTags = inferUseTags(domain, contentType, valueScore);
    const recommendationReason = buildReason(candidate, domain, contentType, valueScore);

    return {
      ...candidate,
      domain,
      contentType,
      useTags,
      valueScore,
      selected: valueScore >= 3,
      recommendationReason,
      cognitiveSignal: buildCognitiveSignal({
        candidate,
        domain,
        contentType,
        useTags,
        valueScore,
        recommendationReason,
      }),
    };
  });
}

function inferDomain(candidate: ArticleCandidate): Domain {
  if (candidate.domainHint) return candidate.domainHint;
  const text = `${candidate.title} ${candidate.summary ?? ""}`.toLowerCase();
  if (/stock|market|nasdaq|s&p|chip|行情|股|指数|板块/u.test(text)) return "market";
  if (/github|browser|database|developer|工程|开发者|工具链/u.test(text)) return "tech";
  return "ai";
}

function inferContentType(candidate: ArticleCandidate, domain: Domain): ContentType {
  const source = candidate.sourceName.toLowerCase();
  const text = `${candidate.title} ${candidate.summary ?? ""}`.toLowerCase();
  if (domain === "market") return "market";
  if (/arxiv|paper|research|论文/u.test(text) || source.includes("arxiv")) return "paper";
  if (/official|release|announces|发布/u.test(text) || /openai|deepmind/.test(source)) {
    return "official";
  }
  if (/hacker news|v2ex|show hn|社区|讨论/u.test(text) || /hacker news|v2ex/.test(source)) {
    return "community";
  }
  if (/deep dive|long-form|learned|analysis|实践/u.test(text)) return "deep_dive";
  return "news";
}

function inferValueScore(candidate: ArticleCandidate, contentType: ContentType): 1 | 2 | 3 | 4 | 5 {
  let score = 3;
  if (contentType === "official" || contentType === "paper" || contentType === "deep_dive") score += 1;
  if (candidate.localSignals.duplicateCount > 1) score += 1;
  if (/funding|rally|走强|raises/u.test(`${candidate.title} ${candidate.summary ?? ""}`)) score += 1;
  return Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;
}

function inferUseTags(domain: Domain, contentType: ContentType, valueScore: number): UseTag[] {
  const tags: UseTag[] = [];
  if (valueScore >= 4 || contentType === "deep_dive" || contentType === "paper") tags.push("值得深读");
  tags.push("持续关注");
  if (domain === "market") tags.push("市场信号");
  if (domain !== "market" && valueScore >= 4) tags.push("可做选题");
  return tags;
}

function buildReason(
  candidate: ArticleCandidate,
  domain: Domain,
  contentType: ContentType,
  valueScore: number,
): string {
  const domainText = domain === "ai" ? "AI" : domain === "tech" ? "科技" : "市场";
  const duplicateText =
    candidate.localSignals.duplicateCount > 1
      ? `，且出现 ${candidate.localSignals.duplicateCount} 次重复信号`
      : "";
  return `${domainText}方向的${contentType}信息，价值评分 ${valueScore}/5${duplicateText}，适合纳入早间扫描。`;
}
