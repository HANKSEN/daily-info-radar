import test from "node:test";
import assert from "node:assert/strict";

import { fetchYahooSnapshot, MARKET_WATCHLIST } from "../src/collectors/market.ts";

test("market watchlist covers indexes, tech stocks, china/hk stocks, and macro signals", () => {
  const groups = new Set(MARKET_WATCHLIST.map((asset) => asset.group));

  assert.ok(groups.has("index"));
  assert.ok(groups.has("tech_stock"));
  assert.ok(groups.has("china_hk_stock"));
  assert.ok(groups.has("macro"));
  assert.ok(MARKET_WATCHLIST.some((asset) => asset.symbol === "QQQM"));
  assert.ok(MARKET_WATCHLIST.some((asset) => asset.symbol === "^DJI" && asset.region === "us"));
  assert.ok(MARKET_WATCHLIST.some((asset) => asset.symbol === "^HSI" && asset.region === "hk"));
  assert.ok(MARKET_WATCHLIST.some((asset) => asset.symbol === "SI=F" && asset.region === "other"));
  assert.ok(MARKET_WATCHLIST.some((asset) => asset.symbol === "NVDA"));
  assert.ok(MARKET_WATCHLIST.some((asset) => asset.symbol === "0700.HK"));
  assert.ok(MARKET_WATCHLIST.some((asset) => asset.symbol === "BTC-USD"));
});

test("fetchYahooSnapshot sends browser-like headers and parses change percent", async () => {
  const originalFetch = globalThis.fetch;
  let headers: HeadersInit | undefined;
  globalThis.fetch = async (_input, init) => {
    headers = init?.headers;
    return new Response(JSON.stringify({
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 110,
              chartPreviousClose: 80,
              regularMarketTime: 1786132800,
            },
            timestamp: [1786023000, 1786109400],
            indicators: { quote: [{ close: [100, 110] }] },
          },
        ],
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const snapshot = await fetchYahooSnapshot({ symbol: "NVDA", name: "英伟达", group: "tech_stock" });
    assert.equal(snapshot.status, "ok");
    assert.equal(snapshot.changePercent, 10);
    assert.equal(snapshot.asOf, "2026-08-07T20:00:00.000Z");
    assert.equal(snapshot.sourceName, "Yahoo Finance");
    assert.ok(snapshot.fetchedAt);
    assert.match((headers as Record<string, string>)["User-Agent"], /Mozilla/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchYahooSnapshot uses chartPreviousClose only for a single intraday point", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    chart: {
      result: [{
        meta: {
          regularMarketPrice: 99,
          regularMarketTime: 1786331775,
          chartPreviousClose: 100,
        },
        timestamp: [1786331775],
        indicators: { quote: [{ close: [99] }] },
      }],
    },
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const snapshot = await fetchYahooSnapshot({
      symbol: "000300.SS",
      name: "沪深 300",
      group: "index",
      region: "cn",
    });
    assert.equal(snapshot.status, "ok");
    assert.equal(snapshot.changePercent, -1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
