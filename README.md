# Daily Info Radar

<p align="center">
  <a href="./README.md">简体中文</a> · <a href="./README.en.md">English</a>
</p>

Daily Info Radar 是一个面向 AI、科技与市场信息的每日资讯雷达。它会从多类信息源抓取内容，去重、筛选、评分并生成结构化日报，再通过飞书机器人定时推送。

这个项目适合个人研究者、内容创作者、产品/投资/技术从业者，用来搭建自己的每日信息输入系统：早上固定收到一份高信噪比简报，快速判断哪些信息值得深读、持续关注或转化为选题。

## 解决什么问题

- 信息源分散：统一聚合英文官方博客、技术社区、中文 AI/科技媒体、市场快照。
- 信息噪声高：按来源权重、发布时间、重复度和模型/规则评分筛选。
- 每日流程重复：支持本地归档、飞书推送、Obsidian 待读清单和 launchd 定时运行。
- 数据与代码混在一起：默认把日报、日志、缓存和运行状态写入仓库外的私有数据目录，便于开源代码而不泄露生产数据。

## 核心能力

- 多源采集：RSS、API、网页抓取和市场行情快照。
- 候选去重与公平采样：避免单一来源刷屏。
- AI 分析或本地规则分析：OpenAI-compatible API 模式与 heuristic 模式可切换。
- 飞书推送：默认使用飞书消息卡片，文章标题可点击打开原文。
- 机器人交互：支持「帮助」「状态」「重发日报」「收藏第3条」「加入待读 3 5」。
- Obsidian 待读：可把日报条目追加到本地 Markdown 清单。
- 定时运行：macOS launchd 每日定时推送，另有常驻机器人事件监听。
- 运行日志：记录每日运行状态、模型模式、模型名、token usage、候选数和精选条目数。

## 安装

要求：

- macOS（定时任务使用 launchd）
- Node.js 25+
- `lark-cli`（用于飞书机器人消息和事件）

```bash
git clone https://github.com/HANKSEN/daily-info-radar.git
cd daily-info-radar
cp .env.example .env
npm test
```

## 配置

编辑 `.env`：

```bash
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=replace-with-your-key
AI_MODEL=deepseek-chat
RADAR_AI_MODE=openai

RADAR_TIMEZONE=Asia/Shanghai
RADAR_DAILY_HOUR=8
RADAR_DAILY_MINUTE=30

LARK_CHAT_ID=oc_xxx
LARK_ALLOWED_CHAT_IDS=oc_xxx
LARK_ALLOWED_SENDER_IDS=ou_xxx
OBSIDIAN_READING_LIST_FILE=/path/to/reading-list.md
```

如果暂时没有模型 API key：

```bash
RADAR_AI_MODE=heuristic
```

此模式使用真实采集数据和本地规则完成排序，不调用外部 AI，token 记录为 0。

## 飞书机器人

建议创建一个单独的企业自建应用，并开启机器人能力。

最小权限：

- `im:message:send_as_bot`
- `im:message.p2p_msg:readonly`

事件订阅：

- `im.message.receive_v1`

本机配置：

```bash
lark-cli config init --new
```

拿到私聊或群聊 `chat_id` 后填入 `.env`。如果只做个人推送，机器人不必进群，可以直接使用 P2P 会话的 `chat_id`。

## 使用

本地 dry-run：

```bash
npm run daily:dry
```

真实生成日报：

```bash
npm run daily
```

推送最新日报到飞书：

```bash
npm run send:latest
```

强制重新发送一条新消息（用于测试卡片样式）：

```bash
npm run send:latest -- --force
```

预览发送参数：

```bash
npm run send:latest -- --dry-run
```

飞书消息默认发送为 interactive card。需要回退 Markdown 发送时：

```bash
npm run send:latest -- --markdown
```

添加第 3 条到 Obsidian 待读：

```bash
npm run obsidian:add -- --item 3
```

启动机器人事件监听：

```bash
npm run bot
```

安装并加载定时任务：

```bash
npm run launchd:install -- --load
```

卸载：

```bash
npm run launchd:uninstall -- --unload
```

## 数据目录

默认生产数据目录在仓库同级：

```text
../daily-info-radar.local-data
```

其中保存：

- `raw/` 原始采集结果
- `candidates/` 候选与分析结果
- `briefs/` JSON 与 Markdown 日报
- `logs/daily-runs.jsonl` 每日运行与 token 日志
- `state/` 最新日报、最新运行状态、事件去重状态

不要把该目录提交到 GitHub。

## 安全说明

- `.env` 已被 `.gitignore` 忽略，不应提交。
- `.env.example` 只保留占位符。
- API key、飞书 App Secret、access token 不会写入日志。
- AI 分析输入只包含标题、来源、发布时间、摘要、URL 和本地信号，不发送全文。
- 飞书 launchd 运行环境设置了 `LARK_CLI_NO_PROXY=1`，避免飞书凭据经本地代理转发。

## 休眠与定时

锁屏但电脑仍然醒着时，launchd 会正常运行。电脑真正睡眠时，网络任务无法保证准点执行。若需要在睡眠状态下也尽量准点推送，需要额外配置 macOS 自动唤醒。

## License

MIT
