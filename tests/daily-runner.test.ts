import test from "node:test";
import assert from "node:assert/strict";

import { runScheduledDaily } from "../src/dailyRunner.ts";
import { aiResponseError } from "../src/operationalError.ts";
import type { DailyIncident, DailyRunLogEntry, PipelineResult, RuntimeConfig } from "../src/types.ts";

test("scheduled daily alerts when AI balance is insufficient", async () => {
  const cards: unknown[] = [];
  const incidents: DailyIncident[] = [];
  const logs: DailyRunLogEntry[] = [];

  await assert.rejects(
    runScheduledDaily({
      config: createConfig(),
      env: { LARK_CHAT_ID: "oc_test" },
      now: new Date("2026-08-10T00:00:00.000Z"),
      dependencies: {
        runPipeline: async () => { throw aiResponseError(402, "Insufficient Balance"); },
        sendCard: async (options) => {
          cards.push(options.card);
          return { stdout: "", stderr: "" };
        },
        writeIncident: async (_dataDir, incident) => { incidents.push(incident); },
        appendRunLog: async (_dataDir, entry) => { logs.push(entry); },
        resolveIncident: async () => undefined,
      },
    }),
    /API 余额不足/u,
  );

  assert.equal(cards.length, 1);
  assert.match(JSON.stringify(cards[0]), /余额已补充，重新推送今天的资讯/u);
  assert.equal(incidents[0]?.alertSent, true);
  assert.equal(logs[0]?.status, "failed");
  assert.equal(logs[0]?.errorCode, "AI_INSUFFICIENT_BALANCE");
});

test("scheduled daily sends the brief and resolves an earlier incident", async () => {
  let resolved = false;
  const result = await runScheduledDaily({
    config: createConfig(),
    env: { LARK_CHAT_ID: "oc_test" },
    now: new Date("2026-08-10T00:00:00.000Z"),
    dependencies: {
      runPipeline: async () => createPipelineResult(),
      sendCard: async () => ({ stdout: "", stderr: "" }),
      writeIncident: async () => undefined,
      appendRunLog: async () => undefined,
      resolveIncident: async () => {
        resolved = true;
        return undefined;
      },
    },
  });

  assert.equal(result.briefSent, true);
  assert.equal(result.warningSent, false);
  assert.equal(resolved, true);
});

test("scheduled daily attempts a compact alert when the daily card delivery fails", async () => {
  let sendCount = 0;
  const incidents: DailyIncident[] = [];
  await assert.rejects(
    runScheduledDaily({
      config: createConfig(),
      env: { LARK_CHAT_ID: "oc_test" },
      now: new Date("2026-08-10T00:00:00.000Z"),
      dependencies: {
        runPipeline: async () => createPipelineResult(),
        sendCard: async () => {
          sendCount += 1;
          if (sendCount === 1) throw new Error("daily card rejected");
          return { stdout: "", stderr: "" };
        },
        writeIncident: async (_dataDir, incident) => { incidents.push(incident); },
        appendRunLog: async () => undefined,
        resolveIncident: async () => undefined,
      },
    }),
    /飞书消息发送失败/u,
  );

  assert.equal(sendCount, 2);
  assert.equal(incidents[0]?.code, "DELIVERY_FAILED");
  assert.equal(incidents[0]?.alertSent, true);
});

function createConfig(): RuntimeConfig {
  return {
    repoRoot: "/repo",
    dataDir: "/data",
    timezone: "Asia/Shanghai",
    minItems: 1,
    maxItems: 20,
    candidatePoolMax: 80,
    maxPerSource: 8,
    ai: { mode: "openai", baseUrl: "https://api.example.com", apiKey: "local", model: "model" },
    alerts: {
      enabled: true,
      minHealthySources: 10,
      maxSourceFailureRatio: 0.5,
      alertOnPartialSourceFailure: false,
    },
  };
}

function createPipelineResult(): PipelineResult {
  return {
    brief: {
      date: "2026-08-10",
      generatedAt: "2026-08-10T00:00:00.000Z",
      marketSnapshot: [],
      items: [],
      sourceStats: { source: 1 },
    },
    sourceHealth: {
      configured: 12,
      succeeded: 12,
      failed: 0,
      itemCount: 20,
      failures: [],
    },
    paths: {
      raw: "/data/raw.json",
      candidates: "/data/candidates.json",
      analyzed: "/data/analyzed.json",
      briefJson: "/data/brief.json",
      briefMarkdown: "/data/brief.md",
      productionMarkdown: "/data/production.md",
    },
  };
}
