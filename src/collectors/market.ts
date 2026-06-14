import { spawn } from "node:child_process";

import type { MarketSnapshot } from "../types.ts";

const yahooUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) DailyInfoRadar/0.1";

export const MARKET_WATCHLIST: Array<{
  symbol: string;
  name: string;
  group: NonNullable<MarketSnapshot["group"]>;
}> = [
  { symbol: "^NDX", name: "纳斯达克 100", group: "index" },
  { symbol: "^GSPC", name: "标普 500", group: "index" },
  { symbol: "000300.SS", name: "沪深 300", group: "index" },
  { symbol: "000001.SS", name: "上证指数", group: "index" },
  { symbol: "399006.SZ", name: "创业板指", group: "index" },
  { symbol: "NVDA", name: "英伟达", group: "tech_stock" },
  { symbol: "MSFT", name: "微软", group: "tech_stock" },
  { symbol: "AAPL", name: "苹果", group: "tech_stock" },
  { symbol: "GOOGL", name: "Alphabet", group: "tech_stock" },
  { symbol: "META", name: "Meta", group: "tech_stock" },
  { symbol: "TSLA", name: "特斯拉", group: "tech_stock" },
  { symbol: "BABA", name: "阿里巴巴 ADR", group: "china_hk_stock" },
  { symbol: "BIDU", name: "百度 ADR", group: "china_hk_stock" },
  { symbol: "JD", name: "京东 ADR", group: "china_hk_stock" },
  { symbol: "0700.HK", name: "腾讯控股", group: "china_hk_stock" },
  { symbol: "3690.HK", name: "美团", group: "china_hk_stock" },
  { symbol: "BTC-USD", name: "比特币", group: "macro" },
  { symbol: "ETH-USD", name: "以太坊", group: "macro" },
  { symbol: "CL=F", name: "WTI 原油", group: "macro" },
  { symbol: "GC=F", name: "黄金", group: "macro" },
  { symbol: "DX-Y.NYB", name: "美元指数", group: "macro" },
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
}): Promise<MarketSnapshot> {
  try {
    const encoded = encodeURIComponent(market.symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=5d&interval=1d`;
    const payload = await loadYahooChartPayload(url) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            previousClose?: number;
            chartPreviousClose?: number;
          };
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
    const closes = result?.indicators?.quote?.[0]?.close?.filter((close): close is number => typeof close === "number") ?? [];
    const price = meta?.regularMarketPrice ?? closes.at(-1);
    const previous = meta?.previousClose ?? meta?.chartPreviousClose ?? closes.at(-2);
    if (typeof price !== "number" || typeof previous !== "number" || previous === 0) {
      throw new Error("missing price data");
    }
    return {
      symbol: market.symbol,
      name: market.name,
      group: market.group,
      changePercent: ((price - previous) / previous) * 100,
      status: "ok",
    };
  } catch (error) {
    return {
      symbol: market.symbol,
      name: market.name,
      group: market.group,
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
