export type BotCommand =
  | { type: "collect"; itemNumbers: number[] }
  | { type: "resend" }
  | { type: "status" }
  | { type: "help" }
  | { type: "unknown" };

export function parseBotCommand(content: string): BotCommand {
  const text = content.trim();
  const numbers = Array.from(text.matchAll(/\d+/gu)).map((match) => Number(match[0]));

  if (/^(收藏|加入待读)/u.test(text) && numbers.length > 0) {
    return { type: "collect", itemNumbers: numbers };
  }
  if (/^(今天日报|重发日报)$/u.test(text)) return { type: "resend" };
  if (/^状态$/u.test(text)) return { type: "status" };
  if (/^帮助$/u.test(text)) return { type: "help" };
  return { type: "unknown" };
}

export function renderHelp(): string {
  return [
    "可用指令：",
    "- 收藏第3条",
    "- 加入待读 3 5",
    "- 重发日报",
    "- 状态",
    "- 帮助",
  ].join("\n");
}
