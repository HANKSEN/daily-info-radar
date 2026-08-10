import { spawn } from "node:child_process";

import type { MarketSnapshot } from "../types.ts";

const yahooUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) DailyInfoRadar/0.1";

export const MARKET_WATCHLIST: Array<{
  symbol: string;
  name: string;
  group: NonNullable<MarketSnapshot["group"]>;
  region: NonNullable<MarketSnapshot["region"]>;
  cardVisible?: boolean;
}> = [
  { symbol: "QQQM", name: "纳斯达克 100 ETF（QQQM）", group: "index", region: "us" },
  { symbol: "^GSPC", name: "标普 500", group: "index", region: "us" },
  { symbol: "^DJI", name: "道琼指数", group: "index", region: "us" },
  { symbol: "000001.SS", name: "上证指数", group: "index", region: "cn" },
  { symbol: "000300.SS", name: "沪深 300", group: "index", region: "cn" },
  { symbol: "399006.SZ", name: "创业板指", group: "index", region: "cn" },
  { symbol: "^HSI", name: "恒生指数", group: "index", region: "hk" },
  { symbol: "NVDA", name: "英伟达", group: "tech_stock", region: "us", cardVisible: false },
  { symbol: "MSFT", name: "微软", group: "tech_stock", region: "us", cardVisible: false },
  { symbol: "AAPL", name: "苹果", group: "tech_stock", region: "us", cardVisible: false },
  { symbol: "GOOGL", name: "Alphabet", group: "tech_stock", region: "us", cardVisible: false },
  { symbol: "META", name: "Meta", group: "tech_stock", region: "us", cardVisible: false },
  { symbol: "TSLA", name: "特斯拉", group: "tech_stock", region: "us", cardVisible: false },
  { symbol: "BABA", name: "阿里巴巴 ADR", group: "china_hk_stock", region: "us", cardVisible: false },
  { symbol: "BIDU", name: "百度 ADR", group: "china_hk_stock", region: "us", cardVisible: false },
  { symbol: "JD", name: "京东 ADR", group: "china_hk_stock", region: "us", cardVisible: false },
  { symbol: "0700.HK", name: "腾讯控股", group: "china_hk_stock", region: "hk" },
  { symbol: "3690.HK", name: "美团", group: "china_hk_stock", region: "hk" },
  { symbol: "BTC-USD", name: "比特币", group: "macro", region: "other" },
  { symbol: "ETH-USD", name: "以太坊", group: "macro", region: "other" },
  { symbol: "GC=F", name: "黄金", group: "macro", region: "other" },
  { symbol: "SI=F", name: "白银", group: "macro", region: "other" },
  { symbol: "CL=F", name: "WTI 原油", group: "macro", region: "other" },
  { symbol: "DX-Y.NYB", name: "美元指数", group: "macro", region: "other" },
];

export async function collectMarketSnapshots(): Promise<MarketSnapshot[]> {
  const snapshots: MarketSnapshot[] = [];
  for (const market of MARKET_WATCHLIST) {
    snapshots.push(await fetchYahooSnapshot(market));
  }
  return snapshots;
}

export async function fetchYahooSnapshot(market: {
  symbol: string;
  name: string;
  group: NonNullable<MarketSnapshot["group"]>;
  region?: MarketSnapshot["region"];
  cardVisible?: boolean;
}): Promise<MarketSnapshot> {
  try {
    const encoded = encodeURIComponent(market.symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=5d&interval=1d`;
    const payload = await loadYahooChartPayload(url) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            regularMarketTime?: number;
            chartPreviousClose?: number;
          };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              close?: Array<number | null>;
            }>;
          };
        }>;
      };
    };
    const result = payload.chart?.result?.[0];
    const meta = result?.meta;
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const timestamps = result?.timestamp ?? [];
    const completedPoints = closes
      .map((close, index) => ({ close, timestamp: timestamps[index] }))
      .filter((point): point is { close: number; timestamp: number | undefined } =>
        typeof point.close === "number"
      );
    const latest = completedPoints.at(-1);
    const previous = completedPoints.at(-2);
    const price = meta?.regularMarketPrice ?? latest?.close;
    const previousPrice = completedPoints.length >= 2
      ? previous?.close
      : meta?.chartPreviousClose;
    if (typeof price !== "number" || typeof previousPrice !== "number" || previousPrice === 0) {
      throw new Error("missing price data");
    }
    const asOfSeconds = meta?.regularMarketTime ?? latest?.timestamp;
    return {
      symbol: market.symbol,
      name: market.name,
      group: market.group,
      region: market.region,
      cardVisible: market.cardVisible,
      sourceName: "Yahoo Finance",
      sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(market.symbol)}`,
      fetchedAt: new Date().toISOString(),
      asOf: typeof asOfSeconds === "number" ? new Date(asOfSeconds * 1000).toISOString() : undefined,
      changePercent: ((price - previousPrice) / previousPrice) * 100,
      status: "ok",
    };
  } catch (error) {
    return {
      symbol: market.symbol,
      name: market.name,
      group: market.group,
      region: market.region,
      cardVisible: market.cardVisible,
      sourceName: "Yahoo Finance",
      sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(market.symbol)}`,
      fetchedAt: new Date().toISOString(),
      status: "unavailable",
      note: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function loadYahooChartPayload(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": yahooUserAgent,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) return response.json();
  } catch {
    // Fall through to curl; Yahoo sometimes rejects Node fetch but accepts curl.
  }

  const curlBody = await runCurl([
    "-fsSL",
    "--max-time",
    "15",
    "-A",
    yahooUserAgent,
    "-H",
    "Accept: application/json",
    url,
  ]);
  return JSON.parse(curlBody);
}

function runCurl(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`curl exited with ${code}: ${stderr || stdout}`));
    });
  });
}
