export type SimpleBotIntent =
  | "resend"
  | "retryDaily"
  | "checkSources"
  | "viewCandidates"
  | "failureHelp"
  | "balance"
  | "status"
  | "help";

export type ExecutableBotCommand =
  | { type: "collect"; itemNumbers: number[] }
  | { type: SimpleBotIntent };

export type ClarificationChoice = {
  label: string;
  command: { type: SimpleBotIntent };
};

export type ClarificationCommand = {
  type: "clarify";
  prompt: string;
  choices: ClarificationChoice[];
};

export type BotCommand =
  | ExecutableBotCommand
  | ClarificationCommand
  | { type: "unknown" };

type ScoredIntent = {
  intent: SimpleBotIntent;
  score: number;
};

const EXECUTION_THRESHOLD = 5;
const CLARIFICATION_THRESHOLD = 3;
const MINIMUM_SCORE_MARGIN = 2;

const INTENT_LABELS: Record<SimpleBotIntent, string> = {
  resend: "重发最近一次生成的日报",
  retryDaily: "重新采集并生成截至当前时刻的资讯",
  checkSources: "检查信息源是否正常",
  viewCandidates: "查看最近一次采集的候选资讯",
  failureHelp: "查看最近故障的处理建议",
  balance: "查询 DeepSeek API 余额",
  status: "查看信息雷达运行状态",
  help: "查看机器人使用帮助",
};

const COLLECT_WORDS = [
  "收藏",
  "保存",
  "存到obsidian",
  "放到obsidian",
  "放进obsidian",
  "加入待读",
  "放入待读",
  "放到待读",
  "放进待读",
  "稍后看",
  "记下来",
];

export function parseBotCommand(content: string): BotCommand {
  const text = normalizeBotText(content);
  if (!text) return { type: "unknown" };

  const itemNumbers = extractItemNumbers(content);
  if (hasAny(text, COLLECT_WORDS)) {
    if (itemNumbers.length > 0) return { type: "collect", itemNumbers };
    return {
      type: "clarify",
      prompt: "你想收藏第几条？请带上日报序号，例如“收藏第3条”或“加入待读 3 5”。",
      choices: [],
    };
  }

  const ranked = scoreIntents(text).sort((left, right) => right.score - left.score);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < CLARIFICATION_THRESHOLD) return { type: "unknown" };

  const hasClearWinner = top.score >= EXECUTION_THRESHOLD
    && (!second || top.score - second.score >= MINIMUM_SCORE_MARGIN);
  if (hasClearWinner) return { type: top.intent };

  const closeChoices = ranked
    .filter((item) => item.score >= CLARIFICATION_THRESHOLD && top.score - item.score < MINIMUM_SCORE_MARGIN)
    .slice(0, 2);
  const choices = (closeChoices.length > 0 ? closeChoices : [top]).map((item) => ({
    label: INTENT_LABELS[item.intent],
    command: { type: item.intent },
  }));

  return {
    type: "clarify",
    prompt: buildClarificationPrompt(choices),
    choices,
  };
}

export function resolveClarificationChoice(
  content: string,
  choices: ClarificationChoice[],
): ExecutableBotCommand | undefined {
  const selection = parseSelectionNumber(content);
  if (!selection || selection > choices.length) return undefined;
  return choices[selection - 1]?.command;
}

export function renderClarification(command: ClarificationCommand): string {
  if (command.choices.length === 0) return command.prompt;
  return [
    command.prompt,
    "",
    ...command.choices.map((choice, index) => `${index + 1}. ${choice.label}`),
    "",
    "回复序号即可，例如“1”或“选第一个”。",
  ].join("\n");
}

export function renderUnknownCommand(): string {
  return [
    "我还没判断出你想执行的操作。你可以直接说：",
    "- 给我来一份截至现在的最新资讯",
    "- 把早上的日报再发一下",
    "- 第3条帮我保存到待读",
    "- 今天有哪些信息源异常",
    "- 今天发成功了吗",
    "- API 余额还有多少",
    "",
    "回复“帮助”可以查看全部能力。",
  ].join("\n");
}

export function renderHelp(): string {
  return [
    "你可以直接用自然语言告诉我：",
    "- 给我来一份截至现在的最新资讯",
    "- 把早上的日报再发一下",
    "- 第3条帮我保存到待读",
    "- 把第2条和第6条加入待读",
    "- 今天有哪些信息源异常",
    "- 今天采集到了什么",
    "- 这个报错怎么办",
    "- API 余额还有多少",
    "- 今天发成功了吗",
    "- 你都能做什么",
  ].join("\n");
}

export function normalizeBotText(content: string): string {
  return content
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{Punctuation}\p{Symbol}]+/gu, "")
    .trim();
}

function scoreIntents(text: string): ScoredIntent[] {
  return [
    { intent: "retryDaily", score: scoreRetryDaily(text) },
    { intent: "resend", score: scoreResend(text) },
    { intent: "checkSources", score: scoreCheckSources(text) },
    { intent: "viewCandidates", score: scoreViewCandidates(text) },
    { intent: "failureHelp", score: scoreFailureHelp(text) },
    { intent: "balance", score: scoreBalance(text) },
    { intent: "status", score: scoreStatus(text) },
    { intent: "help", score: scoreHelp(text) },
  ];
}

function scoreRetryDaily(text: string): number {
  if (
    /(?:余额已补充.*重新(?:推送|生成)|重新生成.*(?:今天|今日).*资讯|现在重新试一次|使用可用信源继续生成|重新推送.*(?:今天|今日).*资讯)/u.test(text)
  ) return 10;

  if (
    hasAny(text, ["采集到", "采集结果", "待筛选", "还没筛选"])
    && !hasAny(text, ["重新采集", "继续生成", "重新生成"])
  ) return 0;
  if (
    hasAny(text, ["为什么", "没推送", "没有推送", "没收到", "没有收到", "成功吗", "成功了吗", "状态"])
    && !hasAny(text, ["重新生成", "重新采集", "重新推送", "再试一次"])
  ) return 0;

  const retryPhrase = hasAny(text, [
    "再试一次",
    "重新试一次",
    "重试",
    "继续生成",
    "恢复生成",
    "再跑一次",
    "重新跑",
  ]);
  const action = hasAny(text, [
    "重新生成",
    "重新采集",
    "重新整理",
    "生成",
    "更新",
    "采集",
    "整理",
    "推送",
    "来一份",
    "跑一遍",
    "跑一次",
    "看看",
  ]);
  if (!retryPhrase && !action) return 0;

  let score = retryPhrase ? 6 : 3;
  if (hasAny(text, ["最新", "现在", "当前", "当下", "截止", "截至", "此刻", "目前", "今天", "今日", "刚刚"])) {
    score += 3;
  }
  if (hasAny(text, ["资讯", "新闻", "日报", "消息", "信息"])) score += 2;
  if (hasAny(text, ["再推送", "再发", "重发", "重新发", "发一遍"])) score -= 2;
  return score;
}

function scoreResend(text: string): number {
  if (text === "今天日报" || text === "重发日报") return 10;
  const resend = hasAny(text, ["重发", "再发", "重新发", "发一遍", "再推送"]);
  if (!resend) return 0;
  let score = 4;
  if (hasAny(text, ["日报", "卡片", "资讯", "新闻", "消息", "那份"])) score += 2;
  if (hasAny(text, ["刚才", "早上", "之前", "已有", "原来", "上一份"])) score += 2;
  if (hasAny(text, ["重新生成", "重新采集"])) score -= 3;
  return score;
}

function scoreCheckSources(text: string): number {
  const source = hasAny(text, ["信息源", "信源", "rsshub", "rss", "来源"]);
  if (!source) return 0;
  let score = 4;
  if (hasAny(text, ["检查", "检测", "排查", "看看", "状态", "正常", "失败", "异常", "挂了", "可用", "健康", "恢复"])) {
    score += 3;
  }
  return score;
}

function scoreViewCandidates(text: string): number {
  if (text === "今天有哪些候选资讯" || text === "查看今日候选资讯") return 10;
  const candidate = hasAny(text, ["候选", "采集结果", "采集到", "待筛选", "还没筛选"]);
  if (!candidate) return 0;
  let score = 4;
  if (hasAny(text, ["查看", "看看", "列出", "有哪些", "有什么", "什么", "展示"])) score += 2;
  return score;
}

function scoreFailureHelp(text: string): number {
  if (hasAny(text, ["处理指引", "怎么处理", "如何处理", "怎么解决", "如何解决", "这个报错怎么办", "出错了怎么办", "修复建议"])) {
    return 6;
  }
  if (hasAny(text, ["怎么办", "报错", "故障"])) return 4;
  return 0;
}

function scoreBalance(text: string): number {
  if (text === "余额" || text === "查询余额") return 8;
  const balance = hasAny(text, ["余额", "额度", "欠费", "充值", "费用", "还能用", "可用多久", "剩多少", "还有多少"]);
  const service = hasAny(text, ["deepseek", "api", "接口", "模型"]);
  if (!balance && !(service && hasAny(text, ["正常吗", "可用吗", "能用吗"]))) return 0;
  return (balance ? 4 : 3) + (service ? 2 : 1);
}

function scoreStatus(text: string): number {
  if (text === "状态" || hasAny(text, ["运行状态", "运行情况", "系统状态", "为什么今天没有推送", "今天发成功了吗"])) {
    return 8;
  }
  const status = hasAny(text, ["状态", "正常吗", "成功了吗", "成功吗", "失败了吗", "有没有运行", "有没有推送", "发成功", "跑了吗", "没推送", "没有推送", "没收到", "没有收到", "怎么没发"]);
  if (!status) return 0;
  let score = 4;
  if (hasAny(text, ["系统", "机器人", "任务", "日报", "推送", "今天", "今日", "早上"])) score += 2;
  return score;
}

function scoreHelp(text: string): number {
  if (hasAny(text, ["帮助", "怎么用", "如何使用", "会什么", "能做什么", "有哪些功能", "使用说明", "都能做什么"])) return 6;
  if (text === "指令" || text === "命令") return 5;
  return 0;
}

function buildClarificationPrompt(choices: ClarificationChoice[]): string {
  const intents = new Set(choices.map((choice) => choice.command.type));
  if (intents.has("retryDaily") && intents.has("resend")) {
    return "你希望重新采集最新资讯，还是重发已有日报？";
  }
  return choices.length === 1
    ? `我猜你可能想${choices[0]?.label}。请确认是否执行：`
    : "我识别到多个可能的操作，请选择：";
}

function extractItemNumbers(content: string): number[] {
  const normalized = content.normalize("NFKC");
  const values: number[] = [];

  for (const match of normalized.matchAll(/\d+/gu)) {
    values.push(Number(match[0]));
  }
  for (const match of normalized.matchAll(/(?:第)([零〇一二两三四五六七八九十百]+)(?:条|篇|个)?/gu)) {
    values.push(parseChineseNumber(match[1] ?? ""));
  }
  for (const match of normalized.matchAll(/([零〇一二两三四五六七八九十百]+)(?:条|篇)/gu)) {
    values.push(parseChineseNumber(match[1] ?? ""));
  }

  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value > 0)));
}

function parseSelectionNumber(content: string): number | undefined {
  let text = normalizeBotText(content);
  text = text
    .replace(/^(?:我想|我要|我选|选择|就选|选|就|用|按)/u, "")
    .replace(/^(?:第)/u, "")
    .replace(/(?:个选项|选项|方案|个|项)$/u, "");
  if (/^\d+$/u.test(text)) return Number(text);
  if (/^[零〇一二两三四五六七八九十百]+$/u.test(text)) {
    return parseChineseNumber(text);
  }
  return undefined;
}

function parseChineseNumber(input: string): number {
  const digits: Record<string, number> = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
  };
  if (!input) return Number.NaN;
  if (!input.includes("十") && !input.includes("百")) {
    const joined = Array.from(input).map((character) => digits[character]).join("");
    return Number(joined);
  }

  let total = 0;
  let current = 0;
  for (const character of input) {
    if (character === "百") {
      total += (current || 1) * 100;
      current = 0;
    } else if (character === "十") {
      total += (current || 1) * 10;
      current = 0;
    } else {
      current = digits[character] ?? 0;
    }
  }
  return total + current;
}

function hasAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value));
}
