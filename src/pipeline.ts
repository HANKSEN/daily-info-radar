import type {
  AnalyzedArticle,
  ArticleCandidate,
  MarketSnapshot,
  ModelUsage,
  PipelineResult,
  RuntimeConfig,
  SourceItem,
} from "./types.ts";
import { analyzeCandidatesHeuristically } from "./ai/heuristic.ts";
import { analyzeCandidatesWithOpenAI } from "./ai/openaiCompatible.ts";
import { collectDailyInputs } from "./collectors/index.ts";
import { loadSourceConfig } from "./config.ts";
import { formatDateInTimezone } from "./date.ts";
import { dedupeCandidates } from "./dedupe.ts";
import { normalizeSourceItem } from "./normalize.ts";
import { prefilterCandidates } from "./prefilter.ts";
import { rankArticles } from "./rank.ts";
import { renderDailyBriefMarkdown } from "./renderers/markdown.ts";
import { renderCognitiveProductionMarkdown } from "./renderers/production.ts";
import { fairSampleCandidates } from "./sampling.ts";
import { appendDailyRunLog, writeDailyArtifacts } from "./storage.ts";

export type RunDailyPipelineOptions = {
  repoRoot: string;
  dataDir: string;
  now?: Date;
  timezone?: string;
  minItems?: number;
  maxItems?: number;
  candidatePoolMax?: number;
  maxPerSource?: number;
  sourceItems?: SourceItem[];
  marketSnapshots?: MarketSnapshot[];
  dryRun?: boolean;
  config?: RuntimeConfig;
  sourceEnv?: Record<string, string | undefined>;
};

export async function runDailyPipeline(options: RunDailyPipelineOptions): Promise<PipelineResult> {
  const now = options.now ?? new Date();
  const timezone = options.timezone ?? "Asia/Shanghai";
  const date = formatDateInTimezone(now, timezone);
  const maxItems = options.maxItems ?? options.config?.maxItems ?? 20;
  const minItems = options.minItems ?? options.config?.minItems ?? 10;
  const candidatePoolMax = options.candidatePoolMax ?? options.config?.candidatePoolMax ?? 80;
  const maxPerSource = options.maxPerSource ?? options.config?.maxPerSource ?? 8;

  const inputs = await resolveInputs(options);
  const candidates = buildCandidates(inputs.sourceItems, { candidatePoolMax, maxPerSource, now });
  const analysis = await analyzeCandidates(candidates, options);
  const items = rankArticles(analysis.articles, { minItems, maxItems });

  const brief = {
    date,
    generatedAt: now.toISOString(),
    marketSnapshot: inputs.marketSnapshots,
    items,
    sourceStats: countSources(inputs.sourceItems),
    modelUsage: normalizeUsage(analysis.modelUsage),
  };

  const markdown = renderDailyBriefMarkdown(brief);
  const productionMarkdown = renderCognitiveProductionMarkdown(brief);
  const paths = await writeDailyArtifacts({
    dataDir: options.dataDir,
    date,
    raw: inputs,
    candidates,
    analyzed: analysis.articles,
    brief,
    markdown,
    productionMarkdown,
  });
  await appendDailyRunLog(options.dataDir, {
    date,
    generatedAt: brief.generatedAt,
    aiMode: resolveAiMode(options),
    model: resolveAiMode(options) === "openai" ? options.config?.ai.model : undefined,
    apiBaseUrl: resolveAiMode(options) === "openai" ? options.config?.ai.baseUrl : undefined,
    tokenUsage: normalizeUsage(analysis.modelUsage),
    sourceItemCount: inputs.sourceItems.length,
    sourceCount: Object.keys(brief.sourceStats).length,
    candidateCount: candidates.length,
    selectedItemCount: items.length,
    briefMarkdown: paths.briefMarkdown,
  });

  return { brief, paths };
}

export function buildCandidates(
  sourceItems: SourceItem[],
  options: { candidatePoolMax?: number; maxPerSource?: number; now?: Date; maxAgeHours?: number } = {},
): ArticleCandidate[] {
  const now = options.now ?? new Date();
  const maxAgeHours = options.maxAgeHours ?? 24;
  const freshSourceItems = sourceItems.filter((item) =>
    isPublishedWithinWindow(item.publishedAt, now, maxAgeHours)
  );
  const candidates = prefilterCandidates(
    dedupeCandidates(freshSourceItems.map((item) => normalizeSourceItem(item))),
  );
  return fairSampleCandidates(candidates, {
    maxTotal: options.candidatePoolMax ?? 80,
    maxPerSource: options.maxPerSource ?? 8,
  });
}

function isPublishedWithinWindow(
  publishedAt: string | undefined,
  now: Date,
  maxAgeHours: number,
): boolean {
  if (!publishedAt) return false;
  const publishedTime = Date.parse(publishedAt);
  if (!Number.isFinite(publishedTime)) return false;

  const nowTime = now.getTime();
  const windowStart = nowTime - maxAgeHours * 60 * 60 * 1000;
  return publishedTime >= windowStart && publishedTime <= nowTime;
}

async function resolveInputs(options: RunDailyPipelineOptions): Promise<{
  sourceItems: SourceItem[];
  marketSnapshots: MarketSnapshot[];
}> {
  if (options.sourceItems && options.marketSnapshots) {
    return {
      sourceItems: options.sourceItems,
      marketSnapshots: options.marketSnapshots,
    };
  }

  const sources = await loadSourceConfig(options.repoRoot, options.sourceEnv);
  return collectDailyInputs(sources);
}

async function analyzeCandidates(
  candidates: ArticleCandidate[],
  options: RunDailyPipelineOptions,
): Promise<{ articles: AnalyzedArticle[]; modelUsage?: ModelUsage }> {
  if (options.dryRun) return { articles: analyzeCandidatesHeuristically(candidates) };
  if (!options.config) return { articles: analyzeCandidatesHeuristically(candidates) };
  if (options.config.ai.mode === "heuristic") {
    return { articles: analyzeCandidatesHeuristically(candidates) };
  }
  const result = await analyzeCandidatesWithOpenAI(candidates, options.config);
  return { articles: result.articles, modelUsage: result.usage };
}

function countSources(sourceItems: SourceItem[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const item of sourceItems) {
    stats[item.sourceId] = (stats[item.sourceId] ?? 0) + 1;
  }
  return stats;
}

function normalizeUsage(usage: ModelUsage | undefined): Required<ModelUsage> {
  return {
    promptTokens: usage?.promptTokens ?? 0,
    completionTokens: usage?.completionTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
  };
}

function resolveAiMode(options: RunDailyPipelineOptions): RuntimeConfig["ai"]["mode"] {
  if (options.dryRun) return "heuristic";
  return options.config?.ai.mode ?? "heuristic";
}
