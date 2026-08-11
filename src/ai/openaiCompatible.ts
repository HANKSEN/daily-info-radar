import type {
  AnalyzedArticle,
  ArticleCandidate,
  CognitiveSignal,
  ContentType,
  Domain,
  ModelUsage,
  RuntimeConfig,
  UseTag,
} from "../types.ts";
import { normalizeCognitiveSignal } from "../cognitive.ts";
import {
  aiResponseError,
  aiTransportError,
  RadarOperationalError,
} from "../operationalError.ts";

type AiPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type ParsedAiResponse = {
  items: Array<{
    index: number;
    domain: Domain;
    contentType: ContentType;
    useTags: UseTag[];
    valueScore: 1 | 2 | 3 | 4 | 5;
    selected: boolean;
    recommendationReason: string;
    cognitiveSignal?: Partial<CognitiveSignal>;
  }>;
};

export async function analyzeCandidatesWithOpenAI(
  candidates: ArticleCandidate[],
  config: RuntimeConfig,
): Promise<{ articles: AnalyzedArticle[]; usage?: ModelUsage }> {
  if (!config.ai.baseUrl || !config.ai.apiKey || !config.ai.model) {
    throw new RadarOperationalError(
      "AI_AUTH_FAILED",
      "analyze",
      "AI API 配置不完整",
      "请不要在飞书中发送密钥。直接回复我“查看处理指引”，我会告诉你如何安全联系维护者处理。",
      false,
    );
  }

  let lastFormatError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const payload = await requestAnalysis(candidates, config, attempt);
    try {
      return parseAnalysisPayload(payload, candidates);
    } catch (error) {
      lastFormatError = error;
    }
  }
  throw invalidAiResponse(lastFormatError);
}

async function requestAnalysis(
  candidates: ArticleCandidate[],
  config: RuntimeConfig,
  attempt: number,
): Promise<AiPayload> {
  let response: Response;
  try {
    response = await fetch(`${config.ai.baseUrl?.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: attempt === 0 ? 0.2 : 0,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: attempt === 0
              ? "You select high-signal AI, technology, and market information for a Chinese daily brief. Return strict compact JSON only. Do not include markdown or prose."
              : "Return one complete, valid, compact JSON object only. The previous attempt could not be parsed. Do not truncate the JSON and do not include markdown or prose.",
          },
          {
            role: "user",
            content: buildPrompt(candidates),
          },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    throw aiTransportError(error);
  }

  if (!response.ok) {
    throw aiResponseError(response.status, await response.text());
  }
  try {
    return await response.json() as AiPayload;
  } catch (error) {
    throw invalidAiResponse(error);
  }
}

function parseAnalysisPayload(
  payload: AiPayload,
  candidates: ArticleCandidate[],
): { articles: AnalyzedArticle[]; usage?: ModelUsage } {
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("missing response content");
  const parsed = JSON.parse(extractJson(content)) as ParsedAiResponse;
  if (!Array.isArray(parsed.items)) throw new Error("missing items");
  const articles = parsed.items.map((item) => {
    const candidate = candidates[item.index - 1];
    if (!candidate) throw new Error(`AI response referenced unknown candidate index: ${item.index}`);
    return {
      ...candidate,
      domain: item.domain,
      contentType: item.contentType,
      useTags: item.useTags,
      valueScore: item.valueScore,
      selected: item.selected,
      recommendationReason: item.recommendationReason,
      cognitiveSignal: normalizeCognitiveSignal(item.cognitiveSignal, {
        candidate,
        domain: item.domain,
        contentType: item.contentType,
        useTags: item.useTags,
        valueScore: item.valueScore,
        recommendationReason: item.recommendationReason,
      }),
    };
  });
  return {
    articles,
    usage: payload.usage
      ? {
          promptTokens: payload.usage.prompt_tokens,
          completionTokens: payload.usage.completion_tokens,
          totalTokens: payload.usage.total_tokens,
        }
      : undefined,
  };
}

function invalidAiResponse(cause?: unknown): RadarOperationalError {
  return new RadarOperationalError(
    "AI_UNAVAILABLE",
    "analyze",
    "AI 返回内容格式异常",
    "直接回复我“重新生成今天的资讯”，我会再次尝试。",
    true,
    { cause },
  );
}

function buildPrompt(candidates: ArticleCandidate[]): string {
  return JSON.stringify({
    task:
      "Select and classify candidates for a concise Chinese daily brief. Return only compact JSON. Do not repeat title, url, summary, or source fields. Use the 1-based index to refer to each candidate.",
    allowed: {
      domain: ["ai", "tech", "market"],
      contentType: ["official", "deep_dive", "community", "paper", "market", "news"],
      useTags: ["值得深读", "持续关注", "可做选题", "市场信号"],
      valueScore: [1, 2, 3, 4, 5],
      cognitiveSignal: {
        score: [1, 2, 3, 4, 5],
        priority: ["精读", "扫读", "追踪", "跳过"],
        tags: ["判断更新", "能力增强", "行动线索", "创作素材", "趋势信号", "系统优化"],
      },
    },
    rules: [
      "Quality is more important than count. Do not fill the brief with weak items.",
      "Return up to 20 selected items. It is acceptable to return fewer than 10 selected items.",
      "selected=true is allowed only when valueScore>=3.",
      "Set selected=false for low-signal, non-core, generic, off-topic, low-value, or weak-news candidates.",
      "Never select items whose recommendationReason would be 信号一般, 非高价值, 非核心科技新闻, 低分, 信号弱, or 时效性低.",
      "recommendationReason must be Chinese and no longer than 60 characters.",
      "cognitiveSignal describes how this item may help a personal cognitive production line, not just why it is newsworthy.",
      "Set cognitiveSignal.priority=精读 only for items that may change judgment, deepen capability, or become a strong content asset.",
      "cognitiveSignal.hypothesis must state what judgment may be updated, in Chinese and no longer than 90 characters.",
      "cognitiveSignal.contentAngle must state one concrete creation angle, in Chinese and no longer than 80 characters.",
    ],
    candidates: candidates.map((candidate, index) => ({
      index: index + 1,
      sourceId: candidate.sourceId,
      sourceName: candidate.sourceName,
      title: candidate.title,
      publishedAt: candidate.publishedAt,
      summary: candidate.summary,
      language: candidate.language,
      domainHint: candidate.domainHint,
      localSignals: candidate.localSignals,
    })),
    outputShape: {
      items: [
        {
          index: 1,
          domain: "ai",
          contentType: "official",
          useTags: ["值得深读", "持续关注"],
          valueScore: 4,
          selected: true,
          recommendationReason: "中文短理由",
          cognitiveSignal: {
            score: 5,
            priority: "精读",
            tags: ["判断更新", "创作素材"],
            hypothesis: "它可能更新我对某个 AI 趋势、产品机制或行动优先级的判断",
            contentAngle: "围绕它写一条今日认知增量或一篇精读拆解",
          },
        },
      ],
    },
  });
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("Unable to extract JSON from AI response.");
}
