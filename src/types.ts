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

export type CognitiveTag =
  | "判断更新"
  | "能力增强"
  | "行动线索"
  | "创作素材"
  | "趋势信号"
  | "系统优化";

export type ReadingPriority = "精读" | "扫读" | "追踪" | "跳过";

export type CognitiveSignal = {
  score: 1 | 2 | 3 | 4 | 5;
  priority: ReadingPriority;
  tags: CognitiveTag[];
  hypothesis: string;
  contentAngle: string;
};

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
  alerts: {
    enabled: boolean;
    minHealthySources: number;
    maxSourceFailureRatio: number;
    alertOnPartialSourceFailure: boolean;
  };
};

export type ModelUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type OperationalStage = "collect" | "analyze" | "render" | "deliver" | "unknown";

export type IncidentCode =
  | "AI_INSUFFICIENT_BALANCE"
  | "AI_AUTH_FAILED"
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_UNAVAILABLE"
  | "NO_AVAILABLE_SOURCES"
  | "NO_FRESH_CANDIDATES"
  | "NO_QUALIFIED_ITEMS"
  | "SOURCE_HEALTH_DEGRADED"
  | "DELIVERY_FAILED"
  | "UNKNOWN_FAILURE";

export type SourceFailure = {
  sourceId: string;
  sourceName: string;
  reason: string;
};

export type SourceHealth = {
  configured: number;
  succeeded: number;
  failed: number;
  itemCount: number;
  failures: SourceFailure[];
};

export type DailyIncident = {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  status: "open" | "resolved";
  severity: "failure" | "warning";
  stage: OperationalStage;
  code: IncidentCode;
  title: string;
  message: string;
  suggestion: string;
  retryable: boolean;
  alertSent: boolean;
  alertError?: string;
  sourceHealth?: SourceHealth;
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
  cognitiveSignal?: CognitiveSignal;
};

export type MarketSnapshot = {
  symbol: string;
  name: string;
  group?: "index" | "tech_stock" | "china_hk_stock" | "macro";
  region?: "us" | "cn" | "hk" | "other";
  cardVisible?: boolean;
  sourceName?: string;
  sourceUrl?: string;
  fetchedAt?: string;
  asOf?: string;
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
  status?: "success" | "failed";
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
  briefMarkdown?: string;
  stage?: OperationalStage;
  errorCode?: IncidentCode;
  errorMessage?: string;
  alertSent?: boolean;
  sourceHealth?: SourceHealth;
};

export type PipelineResult = {
  brief: DailyBrief;
  sourceHealth: SourceHealth;
  paths: {
    raw: string;
    candidates: string;
    analyzed: string;
    briefJson: string;
    briefMarkdown: string;
    productionMarkdown: string;
  };
};
