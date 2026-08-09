import type {
  AnalyzedArticle,
  ArticleCandidate,
  CognitiveSignal,
  CognitiveTag,
  ContentType,
  Domain,
  ReadingPriority,
  UseTag,
} from "./types.ts";

export function buildCognitiveSignal(input: {
  candidate: ArticleCandidate;
  domain: Domain;
  contentType: ContentType;
  useTags: UseTag[];
  valueScore: 1 | 2 | 3 | 4 | 5;
  recommendationReason: string;
}): CognitiveSignal {
  const score = inferCognitiveScore(input);
  const priority = inferReadingPriority(score, input.useTags, input.contentType);
  const tags = inferCognitiveTags(input.domain, input.contentType, input.useTags);

  return {
    score,
    priority,
    tags,
    hypothesis: buildHypothesis(input),
    contentAngle: buildContentAngle(input),
  };
}

export function normalizeCognitiveSignal(
  raw: Partial<CognitiveSignal> | undefined,
  fallbackInput: Parameters<typeof buildCognitiveSignal>[0],
): CognitiveSignal {
  const fallback = buildCognitiveSignal(fallbackInput);
  return {
    score: normalizeScore(raw?.score, fallback.score),
    priority: normalizePriority(raw?.priority, fallback.priority),
    tags: normalizeTags(raw?.tags, fallback.tags),
    hypothesis: normalizeText(raw?.hypothesis, fallback.hypothesis, 90),
    contentAngle: normalizeText(raw?.contentAngle, fallback.contentAngle, 80),
  };
}

export function scoreForProduction(item: AnalyzedArticle): number {
  const cognitiveScore = item.cognitiveSignal?.score ?? item.valueScore;
  const priorityBonus = item.cognitiveSignal?.priority === "精读"
    ? 8
    : item.cognitiveSignal?.priority === "扫读"
    ? 4
    : item.cognitiveSignal?.priority === "追踪"
    ? 2
    : 0;
  const creationBonus = item.cognitiveSignal?.tags.includes("创作素材") ? 3 : 0;
  const judgmentBonus = item.cognitiveSignal?.tags.includes("判断更新") ? 3 : 0;
  return cognitiveScore * 10 + priorityBonus + creationBonus + judgmentBonus + item.valueScore;
}

function inferCognitiveScore(input: {
  contentType: ContentType;
  useTags: UseTag[];
  valueScore: 1 | 2 | 3 | 4 | 5;
  recommendationReason: string;
}): 1 | 2 | 3 | 4 | 5 {
  let score = input.valueScore;
  if (
    input.useTags.includes("值得深读") &&
    (input.contentType === "official" || input.contentType === "paper" || input.contentType === "deep_dive")
  ) {
    score += 1;
  }
  if (input.useTags.includes("可做选题")) score += 1;
  if (input.contentType === "official" || input.contentType === "paper" || input.contentType === "deep_dive") {
    score += 1;
  }
  if (/融资|估值|收购|监管|政策|组织|架构|workflow|agent|Agent|系统|方法/u.test(input.recommendationReason)) {
    score += 1;
  }
  return Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;
}

function inferReadingPriority(
  score: 1 | 2 | 3 | 4 | 5,
  useTags: UseTag[],
  contentType: ContentType,
): ReadingPriority {
  const isDeepReadingMaterial = contentType === "official" || contentType === "paper" || contentType === "deep_dive";
  if (score >= 5 && isDeepReadingMaterial) {
    return "精读";
  }
  if (score >= 4) return "扫读";
  if (useTags.includes("持续关注") || useTags.includes("市场信号")) return "追踪";
  return "跳过";
}

function inferCognitiveTags(domain: Domain, contentType: ContentType, useTags: UseTag[]): CognitiveTag[] {
  const tags = new Set<CognitiveTag>();
  if (useTags.includes("可做选题")) tags.add("创作素材");
  if (useTags.includes("市场信号") || domain === "market") tags.add("趋势信号");
  if (contentType === "official" || contentType === "paper" || contentType === "deep_dive") {
    tags.add("判断更新");
  }
  if (contentType === "deep_dive" || contentType === "paper") tags.add("能力增强");
  if (domain === "tech" || domain === "ai") tags.add("行动线索");
  if (tags.size === 0) tags.add("趋势信号");
  return Array.from(tags);
}

function buildHypothesis(input: {
  candidate: ArticleCandidate;
  domain: Domain;
  contentType: ContentType;
  recommendationReason: string;
}): string {
  const subject = input.domain === "market" ? "行业趋势判断" : input.domain === "tech" ? "技术与产品判断" : "AI 发展判断";
  if (input.contentType === "official") {
    return `可能更新我对${subject}中一手信号优先级的判断：${input.recommendationReason}`;
  }
  if (input.contentType === "paper" || input.contentType === "deep_dive") {
    return `可能沉淀为方法或能力卡片：${input.recommendationReason}`;
  }
  return `可能提供一个值得追踪的外部信号：${input.recommendationReason}`;
}

function buildContentAngle(input: {
  candidate: ArticleCandidate;
  contentType: ContentType;
  useTags: UseTag[];
  recommendationReason: string;
}): string {
  if (input.useTags.includes("可做选题")) {
    return `选题角度：为什么「${input.candidate.title}」值得普通人关注？`;
  }
  if (input.useTags.includes("值得深读")) {
    return `精读角度：这条信息背后的机制、证据和可迁移经验是什么？`;
  }
  if (input.useTags.includes("市场信号")) {
    return `趋势角度：这个信号会如何影响 AI、产品或创业机会排序？`;
  }
  return `记录角度：它是否真的改变了我的判断，还是只是短期噪音？`;
}

function normalizeScore(value: unknown, fallback: 1 | 2 | 3 | 4 | 5): 1 | 2 | 3 | 4 | 5 {
  return [1, 2, 3, 4, 5].includes(value as number) ? value as 1 | 2 | 3 | 4 | 5 : fallback;
}

function normalizePriority(value: unknown, fallback: ReadingPriority): ReadingPriority {
  return value === "精读" || value === "扫读" || value === "追踪" || value === "跳过" ? value : fallback;
}

function normalizeTags(value: unknown, fallback: CognitiveTag[]): CognitiveTag[] {
  if (!Array.isArray(value)) return fallback;
  const allowed = new Set<CognitiveTag>(["判断更新", "能力增强", "行动线索", "创作素材", "趋势信号", "系统优化"]);
  const tags = value.filter((item): item is CognitiveTag => allowed.has(item));
  return tags.length > 0 ? tags : fallback;
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value.trim().slice(0, maxLength);
}
