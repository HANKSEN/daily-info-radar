export type BotCommand =
  | { type: "collect"; itemNumbers: number[] }
  | { type: "resend" }
  | { type: "retryDaily" }
  | { type: "checkSources" }
  | { type: "viewCandidates" }
  | { type: "failureHelp" }
  | { type: "balance" }
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
  if (
    /余额已补充.*重新(推送|生成)|重新生成.*(今天|今日).*资讯|现在重新试一次|使用可用信源继续生成|重新推送.*(今天|今日).*资讯/u.test(text)
  ) return { type: "retryDaily" };
  if (/^(检查信息源|重新检查信息源|检测信息源)$/u.test(text)) return { type: "checkSources" };
  if (/^(查看今日候选资讯|查看候选资讯|今天有哪些候选资讯)$/u.test(text)) {
    return { type: "viewCandidates" };
  }
  if (/^(查看处理指引|怎么处理|如何处理这个问题)$/u.test(text)) {
    return { type: "failureHelp" };
  }
  if (
    /^(查询|查看|检查).*(余额|DeepSeek)|^(DeepSeek|API).*(余额|还能用|是否可用|可用吗)|^(余额).*(多少|查询|还有)/iu.test(text)
  ) return { type: "balance" };
  if (
    /^(状态|运行状态|运行情况|系统状态|系统正常吗)$/u.test(text) ||
    /为什么.*(没|没有).*(推送|日报)|今天.*(推送|日报).*(状态|情况|成功|失败)|今天.*(没|没有).*(推送|日报)/u.test(text)
  ) return { type: "status" };
  if (/^帮助$/u.test(text)) return { type: "help" };
  return { type: "unknown" };
}

export function renderHelp(): string {
  return [
    "可用指令：",
    "- 收藏第3条",
    "- 加入待读 3 5",
    "- 重发日报",
    "- 重新生成今天的资讯",
    "- 检查信息源",
    "- 查看今日候选资讯",
    "- 查看处理指引",
    "- 查询余额",
    "- 状态 / 为什么今天没有推送",
    "- 帮助",
  ].join("\n");
}
