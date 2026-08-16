# Daily Info Radar 零基础配置与使用手册

> 适用系统：macOS、Windows 10/11  
> 项目地址：<https://github.com/HANKSEN/daily-info-radar>  
> 推荐方式：先把 GitHub 链接交给能操作本机终端的 Agent

## 1. 这个工具配好后能做什么

配置完成后，电脑会在每天设定的时间自动：

1. 采集过去 24 小时的 AI、科技和市场资讯。
2. 去重、评分并筛选高价值内容。
3. 生成一份飞书消息卡片。
4. 把日报发送给你的飞书机器人。
5. 保存本地日报、运行日志和 token 消耗。
6. 发生 API 余额不足、超时或推送失败时，通过飞书发送告警。

默认推送时间是每天 8:00，后续可以修改。

## 2. 选择配置方式

| 方式 | 适合谁 | 你要做的事 |
| --- | --- | --- |
| Agent 自动配置（推荐） | 零基础用户 | 把 GitHub 链接和本手册的提示词交给 Agent，在 3 个关键步骤配合操作 |
| 完全手动配置 | 愿意使用终端的用户 | 按本手册逐条执行命令和飞书后台操作 |

Agent 需要具备本机终端和文件访问能力，例如 Codex 桌面端、Claude Code 或其他本地编程 Agent。只能文字对话的网页助手无法直接完成本机安装。

---

# 路径 A：交给 Agent 自动配置（推荐）

## A1. 把这段话发给 Agent

在你的本地 Agent 中新建对话，完整发送下面的内容：

```text
请在这台电脑上从 0 开始安装并配置 Daily Info Radar：
https://github.com/HANKSEN/daily-info-radar

先完整阅读仓库中的 AGENTS.md、docs/setup-guide/agent-setup.md 和 docs/setup-guide/beginner-guide.md，然后按仓库定义的状态检查顺序执行。

要求：
1. 完成系统与 Node.js 检查、克隆仓库、初始化、测试、信源检查、飞书 CLI、日报生成、飞书推送、机器人互动和定时任务。
2. 不要让我在对话里发送 API Key、App Secret、access token 或完整 .env。
3. 需要密钥时，打开本机文件或交互式输入界面，由我在本机直接填写。不要读取、回显或记录密钥。
4. 飞书开放平台需要我点击时，一次只告诉我当前要点哪个菜单、填什么、成功后应该看到什么。
5. 在我发送机器人测试消息后，自动提取 chat_id 和 sender_id，只写入本地配置。
6. 首次真实推送前先让我确认；其他可自动完成的步骤直接继续执行。
7. 配置完成后运行 npm run verify 和 npm run scheduler:status。
8. 只有 pipelineReady、deliveryReady、interactionReady、automationReady 全部为 true，我已收到飞书测试卡片，定时任务已安装，才算完成。
9. 不要提交本地生产数据，不要执行 git push。
```

## A2. Agent 会自动做什么

Agent 应该按以下顺序执行：

1. 确认 macOS 或 Windows，检查 Git、Node.js 和 npm。
2. 克隆 GitHub 仓库并运行测试。
3. 创建本地 `.env` 与仓库外的数据目录。
4. 让你在本机输入 DeepSeek API Key。
5. 检查信息源，需要时安装本地 RSSHub。
6. 安装并配置 `lark-cli`。
7. 引导你完成飞书应用、权限、长连接事件和版本发布。
8. 获取你的飞书会话 ID 和发送者 ID。
9. 生成日报，等待你确认后发送第一张卡片。
10. 安装每日任务和机器人常驻任务。
11. 运行最终验收并向你报告结果。

## A3. 你只需要在 3 类步骤中配合

### 配合 1：在本机输入密钥

Agent 会打开 `.env` 或 `lark-cli` 交互输入界面。你只在这些本地界面填入：

- DeepSeek API Key
- 飞书 App ID
- 飞书 App Secret

不要把这些内容发给 Agent 对话、飞书机器人、GitHub Issue 或截图。

### 配合 2：点击飞书开放平台

Agent 会暂停在当前步骤，告诉你要点击的菜单。你按第 6 章的飞书步骤操作即可。

### 配合 3：发送测试消息并确认首次推送

1. 在飞书里找到你创建的机器人。
2. 私聊发送：`测试`。
3. Agent 捕获 ID 后会继续配置。
4. Agent 询问是否发送第一张卡片时，确认发送。
5. 在飞书确认收到卡片。

## A4. 怎样算配置完成

Agent 的最后报告应包含：

- `pipelineReady: true`
- `deliveryReady: true`
- `interactionReady: true`
- `automationReady: true`
- 每日推送时间
- 本地数据目录
- 日志目录
- 信源健康情况
- 飞书卡片已收到
- 每日任务和机器人任务均已安装

---

# 路径 B：完全手动配置

## 3. 开始前准备

请准备：

| 内容 | 是否必需 | 用途 |
| --- | --- | --- |
| macOS 或 Windows 10/11 电脑 | 必需 | 运行采集、AI 分析和定时任务 |
| Git | 必需 | 下载和更新项目 |
| Node.js 25 或更高版本 | 必需 | 运行项目 |
| DeepSeek API Key | 推荐 | 完成 AI 筛选和分析 |
| 飞书企业账号 | 必需 | 创建企业自建应用 |
| Docker Desktop | 可选 | 运行本地 RSSHub，增强晚点、36Kr、虎嗅等信源 |
| Obsidian | 可选 | 把文章收藏到待读清单 |

官方下载地址：

- Node.js：<https://nodejs.org/>
- Git：<https://git-scm.com/downloads>
- Docker Desktop：<https://www.docker.com/products/docker-desktop/>
- DeepSeek 开放平台：<https://platform.deepseek.com/>
- 飞书开放平台：<https://open.feishu.cn/>

### 检查安装结果

macOS 打开「终端」，Windows 打开 PowerShell，逐行输入：

```bash
git --version
node --version
npm --version
```

成功标志：三条命令都显示版本号，`node --version` 为 `v25` 或更高。

## 4. 下载项目

选择一个容易找到的目录，在终端或 PowerShell 输入：

```bash
git clone https://github.com/HANKSEN/daily-info-radar.git
cd daily-info-radar
npm test
npm run setup
```

成功标志：

- `npm test` 最后显示 `fail 0`。
- `npm run setup` 返回 `ok: true`。
- 项目目录中出现 `.env`。
- 项目同级出现 `daily-info-radar.local-data`。

`daily-info-radar.local-data` 用于保存你的私有日报和日志，它不会进入 GitHub 仓库。

## 5. 配置 DeepSeek API

### 5.1 创建 API Key

1. 打开 <https://platform.deepseek.com/>。
2. 登录后进入 API Keys 页面。
3. 点击创建 API Key。
4. 立即把 Key 保存在本机安全位置。

API Key 通常以 `sk-` 开头。页面可能只展示一次完整 Key。

### 5.2 在本机编辑 `.env`

macOS：

```bash
open -e .env
```

Windows：

```powershell
notepad .env
```

填写：

```dotenv
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=在这里填写你的真实Key
AI_MODEL=deepseek-v4-flash
RADAR_AI_MODE=openai
RADAR_TIMEZONE=Asia/Shanghai
RADAR_DAILY_HOUR=8
RADAR_DAILY_MINUTE=0
```

模型选择：

- `deepseek-v4-flash`：适合每日日报，速度和成本更友好，推荐新用户使用。
- `deepseek-v4-pro`：分析能力更强，速度和成本更高。

保存文件后运行：

```bash
npm run setup:check
```

成功标志：AI 配置项不再提示缺失。

暂时没有 API Key 时，可以填写 `RADAR_AI_MODE=heuristic`。该模式使用本地规则，适合测试安装流程。

## 6. 配置飞书机器人

本节的结果是：你拥有一个独立的企业自建机器人，它可以向你发日报，也可以接收你的私聊指令。

### 6.1 创建企业自建应用

1. 打开 <https://open.feishu.cn/>并登录。
2. 进入「开发者后台」。
3. 点击「创建企业自建应用」。
4. 应用名称可填：`Daily Info Radar`。
5. 应用描述可填：`每日 AI、科技与市场资讯推送`。
6. 选择一个图标并创建应用。

成功标志：进入应用的管理页面，左侧可以看到「凭证与基础信息」「应用能力」「权限管理」等菜单。

### 6.2 添加机器人能力

1. 打开「应用能力」→「添加应用能力」。
2. 找到「机器人」。
3. 点击「添加」。

成功标志：应用能力列表中已经包含机器人。

### 6.3 开通最小权限

1. 打开「开发配置」→「权限管理」。
2. 搜索并开通：`以应用的身份发消息`（`im:message:send_as_bot`）。
3. 搜索并开通：`获取用户发给机器人的单聊消息`（`im:message.p2p_msg:readonly`）。

这两项是本项目的最小权限。个人私聊场景无需把机器人加入群聊。

### 6.4 查看 App ID 和 App Secret

1. 打开「基础信息」→「凭证与基础信息」。
2. 找到 App ID 和 App Secret。
3. 保持浏览器页面打开，下一步会在本机交互界面中输入。

安全规则：App Secret 只在本机 `lark-cli` 交互流程输入，不写入文档、聊天和 GitHub。

### 6.5 安装并配置飞书 CLI

在项目终端中输入：

```bash
npm install -g @larksuite/cli
lark-cli --version
lark-cli config init --new
```

`config init --new` 询问应用凭证时，在终端里直接输入 App ID 和 App Secret。

然后运行：

```bash
lark-cli auth login --recommend
lark-cli auth status
lark-cli doctor
```

`auth login --recommend` 会显示浏览器授权链接。打开链接，登录飞书并完成授权。

成功标志：`lark-cli auth status` 显示已登录，`lark-cli doctor` 没有阻断性错误。

### 6.6 先启动一次长连接监听

保持以下命令运行：

```bash
lark-cli event consume im.message.receive_v1 --max-events 1 --timeout 10m --as bot
```

该命令会等待飞书消息事件。暂时不要关闭这个终端。

### 6.7 在飞书后台配置长连接事件

1. 回到飞书开发者后台。
2. 打开「开发配置」→「事件与回调」→「事件配置」。
3. 点击编辑订阅方式。
4. 选择「使用长连接收事件」。
5. 点击保存。
6. 在「已添加事件」中点击「添加事件」。
7. 搜索「接收消息」或 `im.message.receive_v1`。
8. 添加该事件。

飞书只会在检测到本地长连接在线时保存长连接订阅方式。保存失败时，先确认第 6.6 节的命令仍在运行。

### 6.8 设置可用范围并发布版本

1. 打开「应用发布」→「版本管理与发布」。
2. 点击「创建版本」。
3. 版本号可填：`1.0.0`。
4. 更新说明可填：`初始版本`。
5. 把应用可用范围至少设置为包含你自己。
6. 保存并申请发布。
7. 如果企业需要管理员审批，请联系管理员通过。

权限、机器人能力和事件订阅变更后，需要发布新版本才会对用户生效。

### 6.9 给机器人发送测试消息

1. 打开飞书客户端。
2. 在顶部搜索你的机器人名称。
3. 进入机器人私聊。
4. 发送：`测试`。
5. 回到运行 `lark-cli event consume` 的终端。

成功标志：终端输出一条消息事件，其中包含：

- `chat_id`：通常以 `oc_` 开头。
- `sender_id.open_id` 或 `open_id`：通常以 `ou_` 开头。

### 6.10 写入本地飞书配置

再次打开 `.env`，填写：

```dotenv
LARK_CHAT_ID=oc_替换为你的chat_id
LARK_ALLOWED_CHAT_IDS=oc_替换为你的chat_id
LARK_ALLOWED_SENDER_IDS=ou_替换为你的open_id
```

三项用途：

- `LARK_CHAT_ID`：日报发送到哪个会话。
- `LARK_ALLOWED_CHAT_IDS`：允许哪些会话控制机器人。
- `LARK_ALLOWED_SENDER_IDS`：允许哪些人向机器人下指令。

## 7. 检查信息源

运行：

```bash
npm run sources
npm run sources:check
```

结果中有多数信源成功即可继续。少量可选信源失败会被记录，不会阻断日报。

### 可选：本机启动 RSSHub

需要稳定获取晚点、36Kr 和虎嗅时，先安装 Docker Desktop，然后执行：

macOS：

```bash
mkdir -p ../daily-info-radar.local-rsshub
cp deploy/rsshub/docker-compose.yml ../daily-info-radar.local-rsshub/docker-compose.yml
docker compose -f ../daily-info-radar.local-rsshub/docker-compose.yml up -d
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force ..\daily-info-radar.local-rsshub
Copy-Item deploy\rsshub\docker-compose.yml ..\daily-info-radar.local-rsshub\docker-compose.yml
docker compose -f ..\daily-info-radar.local-rsshub\docker-compose.yml up -d
```

在 `.env` 中填写：

```dotenv
RSSHUB_BASE_URL=http://127.0.0.1:1200
```

## 8. 生成并发送第一份日报

按顺序执行：

```bash
npm run setup:check
npm run daily:dry
npm run doctor
npm run daily
npm run send:latest -- --dry-run
npm run send:latest -- --force
npm run bot -- --dry-run
```

每条命令的作用：

| 命令 | 作用 | 成功标志 |
| --- | --- | --- |
| `npm run setup:check` | 检查配置进度 | 显示各阶段状态 |
| `npm run daily:dry` | 用测试数据跑流程 | 不消耗 AI token，不发飞书 |
| `npm run doctor` | 检查真实运行环境 | 没有阻断性错误 |
| `npm run daily` | 采集并生成真实日报 | 返回日报文件路径 |
| `npm run send:latest -- --dry-run` | 预览发送参数 | 不实际发送 |
| `npm run send:latest -- --force` | 发送最新日报 | 飞书收到卡片 |
| `npm run bot -- --dry-run` | 检查事件模式 | 显示 `im.message.receive_v1` |

打开飞书，确认卡片中包含市场快照、精选资讯和可点击的原文链接。

## 9. 安装每日自动推送

先确认 `.env` 中的时间：

```dotenv
RADAR_TIMEZONE=Asia/Shanghai
RADAR_DAILY_HOUR=8
RADAR_DAILY_MINUTE=0
```

然后执行：

```bash
npm run scheduler:print
npm run scheduler:install
npm run scheduler:status
npm run verify
```

成功标志：

- macOS：`daily` 和 `bot` 两个 launchd 任务已安装。
- Windows：`DailyInfoRadar-Daily` 和 `DailyInfoRadar-Bot` 两个任务已注册。
- `npm run verify` 完成且没有阻断性错误。

修改推送时间后，必须再次运行：

```bash
npm run scheduler:install
```

## 10. 日常使用

### 每天自动使用

配置完成后无需每天手动操作。电脑在设定时间处于开机和可运行状态时，会自动发送飞书卡片。

### 可以直接私聊机器人

常用说法：

- `帮助`
- `状态`
- `为什么今天没有推送`
- `查询余额`
- `重新生成今天的资讯`
- `重发日报`
- `检查信息源`
- `查看今日候选资讯`
- `收藏第3条`
- `加入待读 3 5`

查询余额和查询运行状态使用本地确定性逻辑，不消耗模型 token。

### 常用本地命令

```bash
# 手动生成今日日报
npm run daily

# 发送最新日报
npm run send:latest

# 查看定时任务
npm run scheduler:status

# 检查整体配置
npm run setup:check

# 完整验收
npm run verify
```

## 11. 电脑锁屏、休眠和关机

- 锁屏：电脑仍然醒着时可正常运行。
- 关闭显示器：系统仍然醒着时可正常运行。
- 真正休眠：macOS 可能延迟到唤醒后运行；Windows 是否唤醒取决于「允许唤醒定时器」电源设置。
- 关机：无法运行。

需要每天稳定在固定时间推送时，请保持电脑开机并禁止在该时段进入深度休眠。

## 12. 日报和日志保存在哪里

默认数据目录位于项目同级：

```text
daily-info-radar.local-data/
├─ raw/                  原始采集数据
├─ candidates/           候选与 AI 分析结果
├─ briefs/                日报 JSON 和 Markdown
├─ logs/                  每日运行、token 和故障日志
└─ state/                 最新运行状态
```

该目录和公开代码仓库分开管理，更新或开源代码时不会上传你的生产数据。

## 13. 更新项目

推荐直接对 Agent 说：

```text
请把我本机的 Daily Info Radar 更新到 GitHub main 最新版本。
先保护 .env 和仓库外的本地数据，更新后运行测试、setup:check，并重新安装 scheduler。
不要读取或输出密钥，不要推送任何本地修改。
```

手动更新：

```bash
git switch main
git pull --ff-only
npm test
npm run setup:check
npm run scheduler:install
npm run scheduler:status
```

## 14. 常见问题

| 现象 | 先做什么 | 常见原因 |
| --- | --- | --- |
| `node` 命令不存在 | 重新安装 Node.js，然后重启终端 | Node.js 没安装或没进入 PATH |
| Node.js 版本低 | 升级到 25 或更高 | 系统使用旧版 Node.js |
| `lark-cli` 命令不存在 | 运行 `npm install -g @larksuite/cli` | CLI 未全局安装 |
| 无法保存长连接 | 先运行第 6.6 节的事件监听命令 | 飞书未检测到在线长连接 |
| 飞书搜不到机器人 | 检查版本是否已发布、可用范围是否包含你 | 版本未发布或应用不可见 |
| 发消息后终端没有事件 | 检查 `im.message.receive_v1`、单聊读取权限和长连接 | 事件、权限或长连接缺失 |
| 日报能生成但发不到飞书 | 运行 `lark-cli doctor` 和 `npm run setup:check` | 飞书凭证、权限或 `LARK_CHAT_ID` 错误 |
| 提示 API 余额不足 | 在 DeepSeek 平台充值，然后对机器人说「余额已补充，重新推送今天的资讯」 | API 账户余额不足 |
| 提示 AI 超时 | 稍等后对机器人说「现在重新试一次」 | 网络或 AI 服务短暂波动，系统已自动重试 |
| 少量信源失败 | 先查看日报是否仍能生成 | 可选信源临时无法访问 |
| 修改时间后没生效 | 重新运行 `npm run scheduler:install` | 定时任务仍使用旧配置 |
| 今天没有自动推送 | 对机器人说「为什么今天没有推送」，再运行 `npm run scheduler:status` | 电脑休眠、网络、AI 或定时任务异常 |

## 15. 安全清单

- [ ] API Key 只写在本机 `.env`。
- [ ] App Secret 只通过本机 `lark-cli` 配置。
- [ ] 没有在聊天、Issue、截图或日志中暴露密钥。
- [ ] `daily-info-radar.local-data` 位于仓库外。
- [ ] 机器人已配置会话白名单和发送者白名单。
- [ ] 飞书只开通了必需权限。

## 16. 最终验收清单

- [ ] `npm test` 全部通过。
- [ ] `npm run sources:check` 有多个信源成功。
- [ ] `npm run daily` 生成今日日报。
- [ ] 飞书已收到可点击原文的卡片。
- [ ] 私聊机器人发送「状态」能收到回复。
- [ ] `npm run scheduler:status` 显示每日任务和机器人任务已安装。
- [ ] `pipelineReady` 为 `true`。
- [ ] `deliveryReady` 为 `true`。
- [ ] `interactionReady` 为 `true`。
- [ ] `automationReady` 为 `true`。

## 17. 官方参考

- [飞书：创建并配置企业自建应用](https://open.feishu.cn/document/home/quickly-develop-interactive-cards/step-one-create-and-configure-the-application)
- [飞书：应用配置说明](https://open.feishu.cn/document/develop-an-echo-bot/faq?lang=zh-CN)
- [飞书：使用长连接接收事件](https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/request-url-configuration-case?lang=zh-CN)
- [飞书 CLI 安装指南](https://open.feishu.cn/document/no_class/mcp-archive/feishu-cli-installation-guide)
- [DeepSeek API 文档](https://api-docs.deepseek.com/)
- [DeepSeek 模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)
