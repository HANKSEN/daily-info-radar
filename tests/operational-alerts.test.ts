import test from "node:test";
import assert from "node:assert/strict";

import { aiResponseError, createIncident } from "../src/operationalError.ts";
import { renderIncidentHelp, renderIncidentLarkCard } from "../src/renderers/larkAlertCard.ts";

test("AI balance failures become safe actionable incidents", () => {
  const error = aiResponseError(402, '{"error":"Insufficient Balance","api_key":"secret"}');
  const incident = createIncident({
    error,
    date: "2026-08-10",
    now: new Date("2026-08-10T00:00:00.000Z"),
  });
  const serialized = JSON.stringify(renderIncidentLarkCard(incident));

  assert.equal(incident.code, "AI_INSUFFICIENT_BALANCE");
  assert.equal(incident.message, "API 余额不足");
  assert.match(incident.suggestion, /余额已补充，重新推送今天的资讯/u);
  assert.match(serialized, /今日资讯推送失败/u);
  assert.match(serialized, /请勿在飞书中发送 API Key/u);
  assert.doesNotMatch(serialized, /secret/u);
});

test("incident help describes the latest recovery action in natural language", () => {
  const incident = createIncident({
    error: aiResponseError(429, "rate limited"),
    date: "2026-08-10",
  });

  const help = renderIncidentHelp(incident);
  assert.match(help, /现在重新试一次/u);
  assert.match(help, /不要在飞书中发送 API Key/u);
});
