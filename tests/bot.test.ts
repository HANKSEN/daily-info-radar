import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { parseBotCommand } from "../src/bot/commands.ts";
import { rememberEventIfNew } from "../src/bot/eventDedupe.ts";
import { parseLarkEventLine } from "../src/bot/events.ts";

test("parseBotCommand recognizes collect commands", () => {
  assert.deepEqual(parseBotCommand("收藏第3条"), { type: "collect", itemNumbers: [3] });
  assert.deepEqual(parseBotCommand("加入待读 3 5"), { type: "collect", itemNumbers: [3, 5] });
});

test("parseBotCommand recognizes utility commands", () => {
  assert.deepEqual(parseBotCommand("重发日报"), { type: "resend" });
  assert.deepEqual(parseBotCommand("余额已补充，重新推送今天的资讯"), { type: "retryDaily" });
  assert.deepEqual(parseBotCommand("现在重新试一次"), { type: "retryDaily" });
  assert.deepEqual(parseBotCommand("使用可用信源继续生成"), { type: "retryDaily" });
  assert.deepEqual(parseBotCommand("检查信息源"), { type: "checkSources" });
  assert.deepEqual(parseBotCommand("查看今日候选资讯"), { type: "viewCandidates" });
  assert.deepEqual(parseBotCommand("查看处理指引"), { type: "failureHelp" });
  assert.deepEqual(parseBotCommand("查询余额"), { type: "balance" });
  assert.deepEqual(parseBotCommand("DeepSeek 还能用吗"), { type: "balance" });
  assert.deepEqual(parseBotCommand("API 余额还有多少"), { type: "balance" });
  assert.deepEqual(parseBotCommand("状态"), { type: "status" });
  assert.deepEqual(parseBotCommand("运行情况"), { type: "status" });
  assert.deepEqual(parseBotCommand("为什么今天没有推送"), { type: "status" });
  assert.deepEqual(parseBotCommand("帮助"), { type: "help" });
  assert.deepEqual(parseBotCommand("随便聊聊"), { type: "unknown" });
});

test("parseLarkEventLine extracts text from lark message events", () => {
  const event = parseLarkEventLine(JSON.stringify({
    header: { event_id: "event-1" },
    event: {
      sender: { sender_id: { open_id: "ou_1" } },
      message: {
        message_id: "om_1",
        chat_id: "oc_1",
        content: JSON.stringify({ text: "收藏第3条" }),
      },
    },
  }));

  assert.deepEqual(event, {
    eventId: "event-1",
    messageId: "om_1",
    chatId: "oc_1",
    senderId: "ou_1",
    text: "收藏第3条",
  });
});

test("rememberEventIfNew tracks duplicate event ids", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "radar-events-"));
  const stateFile = path.join(dir, "events.txt");

  assert.deepEqual(await rememberEventIfNew({ stateFile, eventId: "event-1" }), {
    duplicate: false,
    tracked: true,
  });
  assert.deepEqual(await rememberEventIfNew({ stateFile, eventId: "event-1" }), {
    duplicate: true,
    tracked: true,
  });

  await rm(dir, { recursive: true, force: true });
});
