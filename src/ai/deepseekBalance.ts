export type DeepSeekBalanceInfo = {
  currency: string;
  totalBalance: string;
  grantedBalance: string;
  toppedUpBalance: string;
};

export type DeepSeekBalance = {
  isAvailable: boolean;
  balances: DeepSeekBalanceInfo[];
  checkedAt: string;
};

export type DeepSeekBalanceConfig = {
  apiKey: string;
  baseUrl: string;
};

export function resolveDeepSeekBalanceConfig(
  env: Record<string, string | undefined>,
): DeepSeekBalanceConfig | undefined {
  const apiKey = env.DEEPSEEK_API_KEY ?? env.AI_API_KEY;
  const explicitBaseUrl = env.DEEPSEEK_BALANCE_BASE_URL;
  const aiBaseUrl = env.AI_BASE_URL;
  const baseUrl = explicitBaseUrl ?? (isDeepSeekBaseUrl(aiBaseUrl) ? aiBaseUrl : undefined);
  if (!apiKey || !baseUrl) return undefined;
  return { apiKey, baseUrl };
}

export async function queryDeepSeekBalance(options: {
  apiKey: string;
  baseUrl: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  now?: Date;
}): Promise<DeepSeekBalance> {
  const response = await (options.fetchFn ?? fetch)(buildBalanceUrl(options.baseUrl), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("DeepSeek API 身份验证失败，请检查 API Key 是否有效。");
    }
    if (response.status === 429) {
      throw new Error("DeepSeek API 暂时请求过多，请稍后再查询。");
    }
    throw new Error(`DeepSeek 余额服务暂时不可用（HTTP ${response.status}）。`);
  }

  const payload = await response.json() as {
    is_available?: unknown;
    balance_infos?: Array<{
      currency?: unknown;
      total_balance?: unknown;
      granted_balance?: unknown;
      topped_up_balance?: unknown;
    }>;
  };
  if (typeof payload.is_available !== "boolean" || !Array.isArray(payload.balance_infos)) {
    throw new Error("DeepSeek 余额服务返回了无法识别的数据。");
  }

  return {
    isAvailable: payload.is_available,
    balances: payload.balance_infos.map((info) => ({
      currency: stringValue(info.currency, "UNKNOWN"),
      totalBalance: stringValue(info.total_balance, "0"),
      grantedBalance: stringValue(info.granted_balance, "0"),
      toppedUpBalance: stringValue(info.topped_up_balance, "0"),
    })),
    checkedAt: (options.now ?? new Date()).toISOString(),
  };
}

export function renderDeepSeekBalance(
  balance: DeepSeekBalance,
  timezone = "Asia/Shanghai",
): string {
  const lines = [
    `DeepSeek API 状态：${balance.isAvailable ? "可用" : "不可用（余额不足或账户受限）"}`,
    ...balance.balances.map((info) => {
      const symbol = info.currency === "CNY" ? "¥" : info.currency === "USD" ? "$" : `${info.currency} `;
      return `${info.currency}：总余额 ${symbol}${info.totalBalance}（充值 ${symbol}${info.toppedUpBalance} / 赠送 ${symbol}${info.grantedBalance}）`;
    }),
    `查询时间：${formatTimestamp(balance.checkedAt, timezone)}`,
  ];
  if (!balance.isAvailable) {
    lines.push("余额补充后，可直接回复“余额已补充，重新推送今天的资讯”。");
  }
  return lines.join("\n");
}

function buildBalanceUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/v1\/?$/u, "").replace(/\/+$/u, "")}/user/balance`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function isDeepSeekBaseUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "deepseek.com" || hostname.endsWith(".deepseek.com");
  } catch {
    return false;
  }
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function formatTimestamp(timestamp: string, timezone: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}
