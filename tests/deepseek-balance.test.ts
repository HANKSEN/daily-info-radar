import test from "node:test";
import assert from "node:assert/strict";

import {
  queryDeepSeekBalance,
  renderDeepSeekBalance,
  resolveDeepSeekBalanceConfig,
} from "../src/ai/deepseekBalance.ts";

test("resolveDeepSeekBalanceConfig reuses an official DeepSeek AI configuration", () => {
  assert.deepEqual(resolveDeepSeekBalanceConfig({
    AI_BASE_URL: "https://api.deepseek.com/v1",
    AI_API_KEY: "secret",
  }), {
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "secret",
  });

  assert.equal(resolveDeepSeekBalanceConfig({
    AI_BASE_URL: "https://api.example.com/v1",
    AI_API_KEY: "secret",
  }), undefined);
});

test("queryDeepSeekBalance calls the balance endpoint and normalizes the response", async () => {
  let requestedUrl = "";
  let authorization = "";
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get("Authorization") ?? "";
    return new Response(JSON.stringify({
      is_available: true,
      balance_infos: [{
        currency: "CNY",
        total_balance: "12.50",
        granted_balance: "2.50",
        topped_up_balance: "10.00",
      }],
    }), { status: 200 });
  }) as typeof fetch;

  const result = await queryDeepSeekBalance({
    apiKey: "secret",
    baseUrl: "https://api.deepseek.com/v1",
    fetchFn,
    now: new Date("2026-08-10T00:00:00.000Z"),
  });

  assert.equal(requestedUrl, "https://api.deepseek.com/user/balance");
  assert.equal(authorization, "Bearer secret");
  assert.deepEqual(result, {
    isAvailable: true,
    balances: [{
      currency: "CNY",
      totalBalance: "12.50",
      grantedBalance: "2.50",
      toppedUpBalance: "10.00",
    }],
    checkedAt: "2026-08-10T00:00:00.000Z",
  });
});

test("renderDeepSeekBalance produces a user-facing response without credentials", () => {
  const output = renderDeepSeekBalance({
    isAvailable: false,
    balances: [{
      currency: "CNY",
      totalBalance: "0.00",
      grantedBalance: "0.00",
      toppedUpBalance: "0.00",
    }],
    checkedAt: "2026-08-10T00:00:00.000Z",
  });

  assert.match(output, /DeepSeek API 状态：不可用/u);
  assert.match(output, /总余额 ¥0\.00/u);
  assert.match(output, /余额已补充/u);
  assert.doesNotMatch(output, /API Key|Bearer/u);
});

test("queryDeepSeekBalance returns a sanitized authentication error", async () => {
  const fetchFn = (async () => new Response("sensitive provider body", { status: 401 })) as typeof fetch;

  await assert.rejects(
    queryDeepSeekBalance({
      apiKey: "secret",
      baseUrl: "https://api.deepseek.com/v1",
      fetchFn,
    }),
    /API Key 是否有效/u,
  );
});
