export type Domain = "ai" | "tech" | "market";

export type Language = "zh" | "en" | "unknown";

export type ContentType =
  | "official"
  | "deep_dive"
  | "community"
  | "paper"
  | "market"
  | "news";

export type UseTag = "值得深读" | "持续关注" | "可做选题" | "市场信号";

export type SourceKind = "rss" | "api" | "scrape" | "fixture";

export type SourceConfig = {
  id: string;
  name: string;
  kind: SourceKind;
  url: string;
  domainHint?: Domain;
  subcategory?: string;
  lang?: Language;
  locales?: string[];
  notes?: string;
  useCurl?: boolean;
  weight?: number;
  enabled?: boolean;
};

export type RuntimeConfig = {
  repoRoot: string;
  dataDir: string;
  timezone: string;
  minItems: number;
  maxItems: number;
  candidatePoolMax: number;
  maxPerSource: number;
  ai: {
    mode: "openai" | "heuristic";
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };
};

export type ModelUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type SourceItem = {
  sourceId: string;
  sourceName: string;
  sourceWeight?: number;
  sourceSubcategory?: string;
  url: string;
  title: string;
  publishedAt?: string;
  summary?: string;
  language?: Language;
  domainHint?: Domain;
};

export type ArticleCandidate = SourceItem & {
  canonicalUrl: string;
  dedupeKey: string;
  excerpt?: string;
  localSignals: {
    sourceWeight: number;
    freshnessScore: number;
    duplicateCount: number;
  };
};

export type AnalyzedArticle = ArticleCandidate & {
  domain: Domain;
  contentType: ContentType;
  useTags: UseTag[];
  valueScore: 1 | 2 | 3 | 4 | 5;
  selected: boolean;
  recommendationReason: string;
};

export type MarketSnapshot = {
  symbol: string;
  name: string;
  group?: "index" | "tech_stock" | "china_hk_stock" | "macro";
  changePercent?: number;
  status: "ok" | "unavailable";
  note?: string;
};

export type DailyBrief = {
  date: string;
  generatedAt: string;
  marketSnapshot: MarketSnapshot[];
  items: AnalyzedArticle[];
  sourceStats: Record<string, number>;
  modelUsage?: ModelUsage;
};

export type DailyRunLogEntry = {
  date: string;
  generatedAt: string;
  aiMode: RuntimeConfig["ai"]["mode"];
  model?: string;
  apiBaseUrl?: string;
  tokenUsage: Required<ModelUsage>;
  sourceItemCount: number;
  sourceCount: number;
  candidateCount: number;
  selectedItemCount: number;
  briefMarkdown: string;
};

export type PipelineResult = {
  brief: DailyBrief;
  paths: {
    raw: string;
    candidates: string;
    analyzed: string;
    briefJson: string;
    briefMarkdown: string;
  };
};
