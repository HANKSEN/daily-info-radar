import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  parseBotCommand,
  renderClarification,
  resolveClarificationChoice,
} from "../src/bot/commands.ts";
import { rememberEventIfNew } from "../src/bot/eventDedupe.ts";
import { parseLarkEventLine } from "../src/bot/events.ts";

test("parseBotCommand recognizes collect commands", () => {
  assert.deepEqual(parseBotCommand("收藏第3条"), { type: "collect", itemNumbers: [3] });
  assert.deepEqual(parseBotCommand("加入待读 3 5"), { type: "collect", itemNumbers: [3, 5] });
  assert.deepEqual(parseBotCommand("第三条帮我保存"), { type: "collect", itemNumbers: [3] });
  assert.deepEqual(parseBotCommand("把第2条和第六条放进待读清单"), {
    type: "collect",
    itemNumbers: [2, 6],
  });
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

test("parseBotCommand recognizes fuzzy natural-language actions", () => {
  for (const content of [
    "麻烦帮我推送一下截止现在的最新资讯",
    "给我看看现在有什么新消息",
    "更新一下今天的日报",
    "现在再跑一次",
  ]) {
    assert.deepEqual(parseBotCommand(content), { type: "retryDaily" });
  }

  assert.deepEqual(parseBotCommand("把早上的日报再发一下"), { type: "resend" });
  assert.deepEqual(parseBotCommand("今天有哪些信息源挂了"), { type: "checkSources" });
  assert.deepEqual(parseBotCommand("今天采集到了什么"), { type: "viewCandidates" });
  assert.deepEqual(parseBotCommand("接口还能用多久"), { type: "balance" });
  assert.deepEqual(parseBotCommand("今天发成功了吗"), { type: "status" });
  assert.deepEqual(parseBotCommand("为什么今天没推送"), { type: "status" });
  assert.deepEqual(parseBotCommand("这个报错怎么办"), { type: "failureHelp" });
  assert.deepEqual(parseBotCommand("你都能做什么"), { type: "help" });
});

test("parseBotCommand asks for clarification when intent or parameters are ambiguous", () => {
  const ambiguous = parseBotCommand("再推送一下今天的资讯");
  assert.equal(ambiguous.type, "clarify");
  if (ambiguous.type !== "clarify") return;
  assert.deepEqual(ambiguous.choices.map((choice) => choice.command.type), ["retryDaily", "resend"]);
  assert.match(renderClarification(ambiguous), /回复序号/u);
  assert.deepEqual(resolveClarificationChoice("选第一个", ambiguous.choices), { type: "retryDaily" });
  assert.deepEqual(resolveClarificationChoice("2", ambiguous.choices), { type: "resend" });

  const missingItem = parseBotCommand("收藏一下");
  assert.equal(missingItem.type, "clarify");
  if (missingItem.type === "clarify") {
    assert.equal(missingItem.choices.length, 0);
    assert.match(missingItem.prompt, /第几条/u);
  }
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
