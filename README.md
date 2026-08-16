# Daily Info Radar

<p align="center">
  <a href="./README.md">简体中文</a> · <a href="./README.en.md">English</a>
</p>

Daily Info Radar 是一个面向 AI、科技与市场信息的每日资讯雷达。它会从多类信息源抓取内容，去重、筛选、评分并生成结构化日报，再通过飞书机器人定时推送。

这个项目适合个人研究者、内容创作者、产品/投资/技术从业者，用来搭建自己的每日信息输入系统：早上固定收到一份高信噪比简报，快速判断哪些信息值得深读、持续关注或转化为选题。

## 解决什么问题

- 信息源分散：统一聚合英文官方博客、技术社区、中文 AI/科技媒体、市场快照。
- 信息噪声高：只保留前 24 小时内发布的内容，并按来源权重、重复度和模型/规则评分筛选。
- 每日流程重复：支持本地归档、飞书推送、Obsidian 待读清单和跨平台定时运行。
- 数据与代码混在一起：默认把日报、日志、缓存和运行状态写入仓库外的私有数据目录，便于开源代码而不泄露生产数据。

## 核心能力

- 多源采集：RSS、API、网页抓取和市场行情快照。
- 24 小时时效窗口：只让最近 24 小时发布的资讯进入候选池。
- 候选去重与公平采样：避免单一来源刷屏。
- AI 分析或本地规则分析：OpenAI-compatible API 模式与 heuristic 模式可切换。
- 认知生产线视图：为每条精选信息生成认知优先级、增量假设和内容角度。
- 飞书推送：默认使用飞书消息卡片，文章标题可点击打开原文。
- 机器人交互：支持「给我来一份截至现在的最新资讯」「把早上的日报再发一下」「第3条帮我保存」等自然表达。本地意图路由会进行关键词评分、中文序号提取和歧义确认，不消耗模型 token。
- Obsidian 待读：可把日报条目追加到本地 Markdown 清单。
- 定时运行：macOS launchd 与 Windows Task Scheduler 每日定时推送，另有常驻机器人事件监听。
- 运行日志：记录每日运行状态、模型模式、模型名、token usage、候选数和精选条目数。

## 安装

要求：

- macOS 或 Windows 10/11
- Node.js 25+
- `lark-cli`（用于飞书机器人消息和事件）
- Windows 使用 PowerShell 5.1+ 和系统任务计划程序

```bash
git clone https://github.com/HANKSEN/daily-info-radar.git
cd daily-info-radar
npm test
npm run setup
```

零基础用户请从 [零基础配置与使用手册](./docs/setup-guide/beginner-guide.md) 开始。需要快速查看技术步骤时，参见 [从 0 到 1 手动配置](./docs/setup-guide/manual-setup.md)。

## 交给 Agent 配置

项目提供根目录 `AGENTS.md`、分阶段检查命令和 [Agent 执行指南](./docs/setup-guide/agent-setup.md)。把仓库链接和下面的提示词交给拥有本机终端权限的 Agent：

> 请克隆并配置 https://github.com/HANKSEN/daily-info-radar 。先完整阅读 AGENTS.md、docs/setup-guide/agent-setup.md 和 docs/setup-guide/beginner-guide.md；不要让我在聊天里发送密钥，需要密钥时让我在本机安全输入。完成所有自动化步骤，直到四项 readiness、飞书卡片和定时任务全部验证通过。

Agent 可以完成克隆、环境检查、信源诊断、飞书事件取 ID、真实流程验证和调度安装；用户只需完成本机密钥输入、必要的飞书浏览器授权、发送一条测试消息，以及确认首次真实推送。

配置完成后可运行 `npm run verify`，一次完成测试、信源诊断、分阶段就绪检查和 dry-run 产物验证。自建 RSSHub 模板位于 [`deploy/rsshub/`](./deploy/rsshub/README.md)。

## 配置

编辑 `.env`：

```bash
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=replace-with-your-key
AI_MODEL=deepseek-v4-flash
RADAR_AI_MODE=openai

RADAR_TIMEZONE=Asia/Shanghai
RADAR_DAILY_HOUR=8
RADAR_DAILY_MINUTE=0
RADAR_ALERTS_ENABLED=true
RADAR_MIN_HEALTHY_SOURCES=10
RADAR_MAX_SOURCE_FAILURE_RATIO=0.5
RADAR_ALERT_ON_PARTIAL_SOURCE_FAILURE=false

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
npm install -g @larksuite/cli
lark-cli config init --new
lark-cli auth login --recommend
```

长连接配置前，先启动 `lark-cli event consume im.message.receive_v1 --max-events 1 --timeout 10m --as bot`，再在开发者后台保存「使用长连接收事件」并发布版本。完整点击步骤见 [零基础手册](./docs/setup-guide/beginner-guide.md#6-配置飞书机器人)。

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

生成或重建认知生产线 Markdown：

```bash
npm run production
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

定时任务使用 `npm run daily:scheduled` 统一完成采集、AI 分析和飞书发送。关键步骤失败时，机器人会发送告警卡片并提供可直接回复的自然语言建议，例如：

- `余额已补充，重新推送今天的资讯`
- `现在重新试一次`
- `检查信息源`
- `查看今日候选资讯`
- `查看处理指引`

`重发日报` 只重新发送已有日报；“重新生成今天的资讯”会重新执行完整流程。默认仅对阻断性故障告警，少量非关键源失败只写日志。不要通过飞书发送 API Key、App Secret 或完整 `.env`。

机器人会对模糊表达进行本地意图匹配。当「重新采集」和「重发已有日报」同时有可能时，它会返回编号选项，用户可以回复 `1`、`2` 或「选第一个」。

跨平台安装并加载定时任务：

```bash
npm run scheduler:print
npm run scheduler:install
npm run scheduler:status
```

卸载：

```bash
npm run scheduler:uninstall
```

原有 `launchd:*` 命令继续保留，供 macOS 调试和兼容使用。

## 数据目录

默认生产数据目录在仓库同级：

```text
../daily-info-radar.local-data
```

其中保存：

- `raw/` 原始采集结果
- `candidates/` 候选与分析结果
- `briefs/json/` JSON 日报
- `briefs/markdown/` 普通 Markdown 日报
- `briefs/production/` 认知生产线 Markdown，用于精读、认知卡片和创作输出
- `logs/daily-runs.jsonl` 每日运行与 token 日志
- `logs/incidents.jsonl` 告警与恢复记录
- `state/` 最新日报、最新运行状态、事件去重状态
- `dry-run/`、`verification/` 测试与验收产物，不覆盖生产状态

不要把该目录提交到 GitHub。

## 安全说明

- `.env` 已被 `.gitignore` 忽略，不应提交。
- `.env.example` 只保留占位符。
- API key、飞书 App Secret、access token 不会写入日志。
- AI 分析输入只包含标题、来源、发布时间、摘要、URL 和本地信号，不发送全文。
- 飞书 CLI 子进程设置了 `LARK_CLI_NO_PROXY=1`，避免飞书凭据经本地代理转发。

## 休眠与定时

macOS 锁屏但仍醒着时可正常运行；真正睡眠时可能延迟。Windows 任务支持锁屏运行、错过时间后补跑并请求唤醒，但是否能从睡眠唤醒仍取决于系统电源计划中的唤醒定时器设置。

## License

MIT
