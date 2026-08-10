import type {
  DailyIncident,
  IncidentCode,
  OperationalStage,
  SourceHealth,
} from "./types.ts";

export class RadarOperationalError extends Error {
  readonly code: IncidentCode;
  readonly stage: OperationalStage;
  readonly publicMessage: string;
  readonly suggestion: string;
  readonly retryable: boolean;
  readonly sourceHealth?: SourceHealth;

  constructor(
    code: IncidentCode,
    stage: OperationalStage,
    publicMessage: string,
    suggestion: string,
    retryable: boolean,
    options?: { cause?: unknown; sourceHealth?: SourceHealth },
  ) {
    super(publicMessage, { cause: options?.cause });
    this.name = "RadarOperationalError";
    this.code = code;
    this.stage = stage;
    this.publicMessage = publicMessage;
    this.suggestion = suggestion;
    this.retryable = retryable;
    this.sourceHealth = options?.sourceHealth;
  }
}

export function aiResponseError(status: number, responseBody: string): RadarOperationalError {
  const normalized = responseBody.toLowerCase();
  if (
    status === 402
    || /insufficient[ _-]*(balance|quota|credit)|balance[ _-]*insufficient|余额不足|额度不足/u.test(normalized)
  ) {
    return new RadarOperationalError(
      "AI_INSUFFICIENT_BALANCE",
      "analyze",
      "API 余额不足",
      "补充 API 余额后，直接回复我“余额已补充，重新推送今天的资讯”，我会自动检查并重新生成。",
      true,
    );
  }
  if (status === 401 || status === 403 || /invalid[ _-]*api[ _-]*key|authentication failed|鉴权失败/u.test(normalized)) {
    return new RadarOperationalError(
      "AI_AUTH_FAILED",
      "analyze",
      "AI API 鉴权失败",
      "请不要在飞书中发送密钥。直接回复我“查看处理指引”，我会告诉你如何安全联系维护者处理。",
      false,
    );
  }
  if (status === 429 || /rate[ _-]*limit|too many requests|请求频率/u.test(normalized)) {
    return new RadarOperationalError(
      "AI_RATE_LIMITED",
      "analyze",
      "AI API 请求频率受限",
      "稍后直接回复我“现在重新试一次”，我会重新生成今天的资讯。",
      true,
    );
  }
  return new RadarOperationalError(
    "AI_UNAVAILABLE",
    "analyze",
    `AI 服务暂时不可用（HTTP ${status}）`,
    "直接回复我“重新生成今天的资讯”，我会再次尝试。",
    status >= 500,
  );
}

export function aiTransportError(error: unknown): RadarOperationalError {
  const timeout = error instanceof Error
    && (error.name === "TimeoutError" || error.name === "AbortError");
  return new RadarOperationalError(
    timeout ? "AI_TIMEOUT" : "AI_UNAVAILABLE",
    "analyze",
    timeout ? "AI 服务连接超时" : "无法连接 AI 服务",
    "直接回复我“重新生成今天的资讯”，我会再次尝试。",
    true,
    { cause: error },
  );
}

export function sourceOperationalError(
  code: "NO_AVAILABLE_SOURCES" | "NO_FRESH_CANDIDATES" | "NO_QUALIFIED_ITEMS",
  sourceHealth: SourceHealth,
): RadarOperationalError {
  if (code === "NO_AVAILABLE_SOURCES") {
    return new RadarOperationalError(
      code,
      "collect",
      "没有可用的信息源",
      "直接回复我“检查信息源”，我会重新检测并告诉你哪些来源还没有恢复。",
      true,
      { sourceHealth },
    );
  }
  if (code === "NO_FRESH_CANDIDATES") {
    return new RadarOperationalError(
      code,
      "collect",
      "最近 24 小时内没有可用资讯",
      "直接回复我“检查信息源”，我会确认是今日暂无更新，还是采集来源出现异常。",
      true,
      { sourceHealth },
    );
  }
  return new RadarOperationalError(
    code,
    "analyze",
    "今日没有资讯通过质量筛选",
    "直接回复我“查看今日候选资讯”，我会展示被筛选内容供你核实，但不会自动降低质量标准。",
    false,
    { sourceHealth },
  );
}

export function classifyOperationalError(
  error: unknown,
  fallbackStage: OperationalStage = "unknown",
): RadarOperationalError {
  if (error instanceof RadarOperationalError) return error;
  if (fallbackStage === "deliver") {
    return new RadarOperationalError(
      "DELIVERY_FAILED",
      "deliver",
      "飞书消息发送失败",
      "系统已保留本地日报和错误记录。请联系维护者检查飞书连接后重新发送。",
      true,
      { cause: error },
    );
  }
  return new RadarOperationalError(
    "UNKNOWN_FAILURE",
    fallbackStage,
    "资讯处理流程出现异常",
    "直接回复我“查看处理指引”，我会说明当前状态和下一步处理方式。",
    false,
    { cause: error },
  );
}

export function createIncident(input: {
  error: RadarOperationalError;
  date: string;
  now?: Date;
  severity?: DailyIncident["severity"];
}): DailyIncident {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    id: `${input.date}-${input.error.code}-${now.getTime()}`,
    date: input.date,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "open",
    severity: input.severity ?? "failure",
    stage: input.error.stage,
    code: input.error.code,
    title: input.severity === "warning" ? "今日资讯信源告警" : "今日资讯推送失败",
    message: input.error.publicMessage,
    suggestion: input.error.suggestion,
    retryable: input.error.retryable,
    alertSent: false,
    sourceHealth: input.error.sourceHealth,
  };
}
