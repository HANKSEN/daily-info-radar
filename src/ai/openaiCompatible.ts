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

const AI_BATCH_SIZE = 20;
const AI_BATCH_MAX_ITEMS = 8;
const AI_FORMAT_ATTEMPTS = 3;
const AI_SUMMARY_MAX_LENGTH = 600;
const AI_REQUEST_TIMEOUT_MS = 60000;
const AI_RETRY_DELAYS_MS = [5000, 20000];

const DOMAINS = new Set<Domain>(["ai", "tech", "market"]);
const CONTENT_TYPES = new Set<ContentType>([
  "official",
  "deep_dive",
  "community",
  "paper",
  "market",
  "news",
]);
const USE_TAGS = new Set<UseTag>(["值得深读", "持续关注", "可做选题", "市场信号"]);

type AiPayload = {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: unknown };
    delta?: { content?: unknown };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export type OpenAIAnalysisOptions = {
  retryDelaysMs?: number[];
  requestTimeoutMs?: number;
};

class AiFormatError extends Error {
  readonly layer: "envelope" | "content";

  constructor(layer: "envelope" | "content", message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "AiFormatError";
    this.layer = layer;
  }
}

type IndexedCandidate = {
  candidate: ArticleCandidate;
  index: number;
};

type ParsedAiItem = {
  index: number;
  domain: Domain;
  contentType: ContentType;
  useTags: UseTag[];
  valueScore: 1 | 2 | 3 | 4 | 5;
  selected: boolean;
  recommendationReason: string;
  cognitiveSignal?: Partial<CognitiveSignal>;
};

type BatchResult = {
  articles: AnalyzedArticle[];
  usage?: ModelUsage;
  error?: unknown;
};

export async function analyzeCandidatesWithOpenAI(
  candidates: ArticleCandidate[],
  config: RuntimeConfig,
  options: OpenAIAnalysisOptions = {},
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

  const indexed = candidates.map((candidate, index) => ({ candidate, index: index + 1 }));
  const batches = chunk(indexed, AI_BATCH_SIZE);
  const articles: AnalyzedArticle[] = [];
  const retryDelaysMs = options.retryDelaysMs ?? AI_RETRY_DELAYS_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? AI_REQUEST_TIMEOUT_MS;
  let usage: ModelUsage | undefined;
  let lastFormatError: unknown;
  let failedBatches = 0;

  for (const [batchIndex, batch] of batches.entries()) {
    const result = await analyzeBatch(
      batch,
      config,
      batchIndex,
      batches.length,
      retryDelaysMs,
      requestTimeoutMs,
    );
    usage = mergeUsage(usage, result.usage);
    if (result.error) {
      failedBatches += 1;
      lastFormatError = result.error;
      continue;
    }
    articles.push(...result.articles);
  }

  if (failedBatches === batches.length) throw invalidAiResponse(lastFormatError);
  return { articles: dedupeArticles(articles), usage };
}

async function analyzeBatch(
  candidates: IndexedCandidate[],
  config: RuntimeConfig,
  batchIndex: number,
  batchCount: number,
  retryDelaysMs: number[],
  requestTimeoutMs: number,
): Promise<BatchResult> {
  let usage: ModelUsage | undefined;
  let lastError: AiFormatError | RadarOperationalError | undefined;

  for (let attempt = 0; attempt < AI_FORMAT_ATTEMPTS; attempt += 1) {
    try {
      const payload = await requestAnalysis(
        candidates,
        config,
        attempt,
        batchIndex,
        requestTimeoutMs,
      );
      usage = mergeUsage(usage, toModelUsage(payload.usage));
      return {
        articles: parseAnalysisPayload(payload, candidates),
        usage,
      };
    } catch (error) {
      if (!isRetryableAiAttemptError(error)) throw error;
      lastError = error;
      console.warn(
        `[${new Date().toISOString()}] AI 第 ${batchIndex + 1}/${batchCount} 批 `
          + `${formatAttemptFailure(error)}`
          + `（尝试 ${attempt + 1}/${AI_FORMAT_ATTEMPTS}）`,
      );
      const delayMs = retryDelaysMs[attempt] ?? 0;
      if (attempt < AI_FORMAT_ATTEMPTS - 1 && delayMs > 0) await sleep(delayMs);
    }
  }

  if (lastError instanceof RadarOperationalError) throw lastError;
  return { articles: [], usage, error: lastError };
}

async function requestAnalysis(
  candidates: IndexedCandidate[],
  config: RuntimeConfig,
  attempt: number,
  batchIndex: number,
  requestTimeoutMs: number,
): Promise<AiPayload> {
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${config.ai.baseUrl?.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        stream: false,
        temperature: attempt === 0 ? 0.2 : 0,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: attempt === 0
              ? "You select high-signal AI, technology, and market information for a Chinese daily brief. Return strict compact JSON only. Do not include markdown or prose."
              : "Return one complete, valid, compact JSON object only. The previous attempt could not be parsed. Keep the response short and do not include markdown or prose.",
          },
          {
            role: "user",
            content: buildPrompt(candidates),
          },
        ],
      }),
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    throw aiTransportError(error, {
      batch: batchIndex + 1,
      attempt: attempt + 1,
      phase: "request",
      timeoutMs: requestTimeoutMs,
      elapsedMs: Date.now() - startedAt,
    });
  }

  if (!response.ok) {
    throw aiResponseError(response.status, await response.text());
  }

  let responseBody: string;
  try {
    responseBody = await response.text();
  } catch (error) {
    throw aiTransportError(error, {
      batch: batchIndex + 1,
      attempt: attempt + 1,
      phase: "response_body",
      timeoutMs: requestTimeoutMs,
      elapsedMs: Date.now() - startedAt,
    });
  }
  return parseAiEnvelope(responseBody, response);
}

function parseAnalysisPayload(
  payload: AiPayload,
  candidates: IndexedCandidate[],
): AnalyzedArticle[] {
  const content = normalizeContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    throw new AiFormatError(
      "content",
      `finish_reason=${safeDiagnosticValue(payload.choices?.[0]?.finish_reason ?? "unknown")}, content_length=0`,
    );
  }

  let rawItems: unknown[];
  try {
    rawItems = parseResponseItems(content);
  } catch (error) {
    const finishReason = payload.choices?.[0]?.finish_reason ?? "unknown";
    throw new AiFormatError(
      "content",
      `finish_reason=${safeDiagnosticValue(finishReason)}, content_length=${content.length}`,
      error,
    );
  }
  if (rawItems.length === 0) return [];

  const candidateByIndex = new Map(candidates.map((item) => [item.index, item.candidate]));
  const seenIndexes = new Set<number>();
  const articles: AnalyzedArticle[] = [];

  for (const rawItem of rawItems) {
    const item = normalizeAiItem(rawItem, candidateByIndex);
    if (!item || seenIndexes.has(item.index)) continue;
    const candidate = candidateByIndex.get(item.index);
    if (!candidate) continue;
    seenIndexes.add(item.index);
    articles.push({
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
    });
  }

  if (articles.length === 0) {
    throw new AiFormatError(
      "content",
      `finish_reason=${safeDiagnosticValue(payload.choices?.[0]?.finish_reason ?? "unknown")}, content_length=${content.length}, valid_items=0`,
    );
  }
  return articles;
}

function normalizeAiItem(
  raw: unknown,
  candidateByIndex: Map<number, ArticleCandidate>,
): ParsedAiItem | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const item = raw as Record<string, unknown>;
  if (!Number.isInteger(item.index) || !candidateByIndex.has(item.index as number)) return undefined;
  if (!DOMAINS.has(item.domain as Domain)) return undefined;
  if (!CONTENT_TYPES.has(item.contentType as ContentType)) return undefined;
  if (![1, 2, 3, 4, 5].includes(item.valueScore as number)) return undefined;
  if (typeof item.selected !== "boolean") return undefined;
  if (typeof item.recommendationReason !== "string" || !item.recommendationReason.trim()) {
    return undefined;
  }

  const useTags = Array.isArray(item.useTags)
    ? item.useTags.filter((tag): tag is UseTag => USE_TAGS.has(tag as UseTag))
    : [];
  const cognitiveSignal = item.cognitiveSignal && typeof item.cognitiveSignal === "object"
    ? item.cognitiveSignal as Partial<CognitiveSignal>
    : undefined;

  return {
    index: item.index as number,
    domain: item.domain as Domain,
    contentType: item.contentType as ContentType,
    useTags,
    valueScore: item.valueScore as 1 | 2 | 3 | 4 | 5,
    selected: item.selected,
    recommendationReason: item.recommendationReason.trim().slice(0, 60),
    cognitiveSignal,
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

function buildPrompt(candidates: IndexedCandidate[]): string {
  return JSON.stringify({
    task:
      "Select and classify candidates for a concise Chinese daily brief. Return only compact JSON. Do not repeat title, url, summary, or source fields. Use the provided index to refer to each candidate.",
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
      `Return up to ${AI_BATCH_MAX_ITEMS} selected items. Returning zero items is valid.`,
      "selected=true is allowed only when valueScore>=3.",
      "Omit unselected candidates from items to keep the JSON short.",
      "Set selected=false for low-signal, non-core, generic, off-topic, low-value, or weak-news candidates.",
      "Never select items whose recommendationReason would be 信号一般, 非高价值, 非核心科技新闻, 低分, 信号弱, or 时效性低.",
      "recommendationReason must be Chinese and no longer than 60 characters.",
      "cognitiveSignal describes how this item may help a personal cognitive production line, not just why it is newsworthy.",
      "cognitiveSignal.hypothesis must be Chinese and no longer than 70 characters.",
      "cognitiveSignal.contentAngle must be Chinese and no longer than 60 characters.",
    ],
    candidates: candidates.map(({ candidate, index }) => ({
      index,
      sourceId: candidate.sourceId,
      sourceName: candidate.sourceName,
      title: candidate.title,
      publishedAt: candidate.publishedAt,
      summary: truncate(candidate.summary, AI_SUMMARY_MAX_LENGTH),
      language: candidate.language,
      domainHint: candidate.domainHint,
      localSignals: candidate.localSignals,
    })),
    outputShape: {
      items: [
        {
          index: candidates[0]?.index ?? 1,
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
            hypothesis: "可能更新的关键判断",
            contentAngle: "一个具体的创作角度",
          },
        },
      ],
    },
  });
}

function parseAiEnvelope(responseBody: string, response: Response): AiPayload {
  const body = responseBody.trim().replace(/^\uFEFF/u, "");
  let parseError: unknown;

  try {
    return assertAiPayload(JSON.parse(body));
  } catch (error) {
    parseError = error;
  }

  if (body.startsWith("data:") || response.headers.get("content-type")?.includes("text/event-stream")) {
    try {
      return parseSseEnvelope(body);
    } catch (error) {
      parseError = error;
    }
  }

  const completeObject = extractFirstCompleteObject(body);
  if (completeObject) {
    try {
      return assertAiPayload(JSON.parse(completeObject));
    } catch (error) {
      parseError = error;
    }
  }

  throw new AiFormatError("envelope", envelopeDiagnostic(response, body), parseError);
}

function parseSseEnvelope(body: string): AiPayload {
  let content = "";
  let finishReason: string | undefined;
  let usage: AiPayload["usage"];
  let fullPayload: AiPayload | undefined;
  let parsedChunks = 0;

  for (const line of body.split(/\r?\n/u)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    const chunk = assertAiPayload(JSON.parse(data));
    parsedChunks += 1;
    usage = chunk.usage ?? usage;
    const choice = chunk.choices?.[0];
    const messageContent = normalizeContent(choice?.message?.content);
    if (messageContent) fullPayload = chunk;
    content += normalizeContent(choice?.delta?.content) ?? "";
    finishReason = choice?.finish_reason ?? finishReason;
  }

  if (fullPayload) return fullPayload;
  if (parsedChunks > 0 && content) {
    return {
      choices: [{ finish_reason: finishReason, message: { content } }],
      usage,
    };
  }
  throw new Error("SSE response contained no usable message content");
}

function assertAiPayload(value: unknown): AiPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI response envelope is not an object");
  }
  return value as AiPayload;
}

function envelopeDiagnostic(response: Response, body: string): string {
  const contentType = safeDiagnosticValue(response.headers.get("content-type") ?? "missing");
  const requestId = response.headers.get("x-request-id")
    ?? response.headers.get("request-id")
    ?? response.headers.get("cf-ray")
    ?? "missing";
  const firstCharacter = body.trimStart().charAt(0) || "empty";
  return [
    `status=${response.status}`,
    `content_type=${contentType}`,
    `body_length=${body.length}`,
    `starts_with=${safeDiagnosticValue(firstCharacter)}`,
    `request_id=${safeDiagnosticValue(requestId)}`,
  ].join(", ");
}

function normalizeContent(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return undefined;
  const content = value.map((part) => {
    if (!part || typeof part !== "object") return "";
    const record = part as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (typeof record.content === "string") return record.content;
    if (record.text && typeof record.text === "object") {
      const text = record.text as Record<string, unknown>;
      if (typeof text.value === "string") return text.value;
    }
    return "";
  }).join("");
  return content || undefined;
}

function parseResponseItems(content: string): unknown[] {
  let parseError: unknown;
  try {
    const parsed = JSON.parse(extractJson(content)) as { items?: unknown };
    if (!Array.isArray(parsed.items)) throw new Error("missing items");
    return parsed.items;
  } catch (error) {
    parseError = error;
  }

  const salvaged = extractCompleteItemObjects(content);
  if (salvaged.length > 0) return salvaged;
  throw parseError;
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1].trim() ?? trimmed;
  const object = extractFirstCompleteObject(source);
  if (object) return object;
  throw new Error("Unable to extract a complete JSON object from AI response.");
}

function extractFirstCompleteObject(content: string): string | undefined {
  const start = content.indexOf("{");
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return content.slice(start, index + 1);
  }
  return undefined;
}

function extractCompleteItemObjects(content: string): unknown[] {
  const itemsKey = content.search(/"items"\s*:/u);
  if (itemsKey < 0) return [];
  const arrayStart = content.indexOf("[", itemsKey);
  if (arrayStart < 0) return [];

  const result: unknown[] = [];
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart + 1; index < content.length; index += 1) {
    const char = content[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) objectStart = index;
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        try {
          result.push(JSON.parse(content.slice(objectStart, index + 1)));
        } catch {
          // A malformed item is ignored while other complete items remain usable.
        }
        objectStart = -1;
      }
    }
  }
  return result;
}

function mergeUsage(current: ModelUsage | undefined, next: ModelUsage | undefined): ModelUsage | undefined {
  if (!current && !next) return undefined;
  return {
    promptTokens: (current?.promptTokens ?? 0) + (next?.promptTokens ?? 0),
    completionTokens: (current?.completionTokens ?? 0) + (next?.completionTokens ?? 0),
    totalTokens: (current?.totalTokens ?? 0) + (next?.totalTokens ?? 0),
  };
}

function toModelUsage(usage: AiPayload["usage"]): ModelUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

function dedupeArticles(articles: AnalyzedArticle[]): AnalyzedArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.canonicalUrl)) return false;
    seen.add(article.canonicalUrl);
    return true;
  });
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function formatLayerName(layer: AiFormatError["layer"]): string {
  return layer === "envelope" ? "HTTP 外层响应" : "AI 内容";
}

function isRetryableAiAttemptError(error: unknown): error is AiFormatError | RadarOperationalError {
  if (error instanceof AiFormatError) return true;
  if (!(error instanceof RadarOperationalError) || !error.retryable) return false;
  return error.code === "AI_TIMEOUT"
    || error.code === "AI_UNAVAILABLE"
    || error.code === "AI_RATE_LIMITED";
}

function formatAttemptFailure(error: AiFormatError | RadarOperationalError): string {
  if (error instanceof AiFormatError) {
    return `${formatLayerName(error.layer)}格式校验失败：${error.message}`;
  }
  return `${error.publicMessage}：code=${error.code}`;
}

function safeDiagnosticValue(value: string): string {
  return value.replace(/[^a-zA-Z0-9_+./;:=<>-]/gu, "_").slice(0, 120);
}

async function sleep(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
