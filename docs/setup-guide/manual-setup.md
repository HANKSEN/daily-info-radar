# Daily Info Radar 从 0 到 1 手动配置

本教程适用于 macOS 和 Windows 10/11。核心资讯流程跨平台；macOS 使用 launchd，Windows 使用系统任务计划程序。

## 1. 准备

安装 Git、Node.js 25+，并准备一个 OpenAI-compatible API Key。飞书推送需要企业自建应用；LatePost、36Kr、虎嗅的稳定接入建议准备 Docker Desktop 自建 RSSHub。

```bash
git --version
node --version
npm --version
```

## 2. 下载和初始化

```bash
git clone https://github.com/HANKSEN/daily-info-radar.git
cd daily-info-radar
npm test
npm run setup
```

`setup` 只会在 `.env` 不存在时从示例创建，不会覆盖现有配置；生产数据默认创建在仓库同级的 `daily-info-radar.local-data`。

## 3. 配置 AI、时区和时间

在本机编辑 `.env`。不要把 API Key 发到聊天、Issue 或 GitHub：

```dotenv
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=填写实际密钥
AI_MODEL=deepseek-chat
RADAR_AI_MODE=openai
RADAR_TIMEZONE=Asia/Shanghai
RADAR_DAILY_HOUR=8
RADAR_DAILY_MINUTE=0
RADAR_ALERTS_ENABLED=true
RADAR_MIN_HEALTHY_SOURCES=10
RADAR_MAX_SOURCE_FAILURE_RATIO=0.5
RADAR_ALERT_ON_PARTIAL_SOURCE_FAILURE=false
```

没有 API Key 时可以先设置 `RADAR_AI_MODE=heuristic`。修改时间后必须重新运行 `npm run scheduler:install`。

检查当前阶段：

```bash
npm run setup:check
```

## 4. 配置信息源

```bash
npm run sources
npm run sources:check
```

部分来源失败不会中断日报。需要自定义时复制 `config/sources.example.json` 为 `config/sources.json`；本地文件已被 Git 忽略。

自建 RSSHub 后设置：

```bash
mkdir -p ../daily-info-radar.local-rsshub
cp deploy/rsshub/docker-compose.yml ../daily-info-radar.local-rsshub/docker-compose.yml
docker compose -f ../daily-info-radar.local-rsshub/docker-compose.yml up -d
```

Windows PowerShell 使用：

```powershell
New-Item -ItemType Directory -Force ..\daily-info-radar.local-rsshub
Copy-Item deploy\rsshub\docker-compose.yml ..\daily-info-radar.local-rsshub\docker-compose.yml
docker compose -f ..\daily-info-radar.local-rsshub\docker-compose.yml up -d
```

然后设置：

```dotenv
RSSHUB_BASE_URL=http://127.0.0.1:1200
```

并检查 `/latepost`、`/36kr/newsflashes`、`/huxiu/article` 三条路由。

## 5. 配置飞书机器人

在飞书开放平台创建企业自建应用，开启机器人能力和以下权限：

- `im:message:send_as_bot`
- `im:message.p2p_msg:readonly`

事件订阅选择长连接并添加 `im.message.receive_v1`，设置应用可用范围，然后创建并发布版本。

安装和配置 CLI：

```bash
npx @larksuite/cli@latest install
lark-cli config init --new
lark-cli doctor
```

App Secret 通过交互流程输入并由本机凭据存储管理，不要写入仓库。

获取机器人会话 ID：

```bash
lark-cli event consume im.message.receive_v1 --max-events 1 --timeout 2m --as bot
```

命令等待期间给机器人发一条私聊消息，然后把输出中的值写入 `.env`：

```dotenv
LARK_CHAT_ID=oc_xxx
LARK_ALLOWED_CHAT_IDS=oc_xxx
LARK_ALLOWED_SENDER_IDS=ou_xxx
```

## 6. 首次真实运行

```bash
npm run daily:dry
npm run doctor
npm run daily
npm run send:latest -- --dry-run
npm run send:latest -- --force
npm run bot -- --dry-run
```

确认飞书收到可点击原文的消息卡片。真实日报、token 日志和状态都在仓库外的数据目录。

定时任务实际调用 `npm run daily:scheduled`。它会在采集、AI 分析或发送失败时记录故障，并尽力通过同一机器人发送告警。收到告警后可以直接回复：

- `余额已补充，重新推送今天的资讯`
- `现在重新试一次`
- `检查信息源`
- `查看今日候选资讯`
- `查看处理指引`

机器人只接受白名单用户触发这些操作。密钥配置问题只能给出安全处理指引，不允许用户把密钥发给机器人。

## 7. 可选：Obsidian

```dotenv
OBSIDIAN_READING_LIST_FILE=C:\Users\name\Documents\Obsidian\待读清单.md
```

macOS 使用对应的绝对路径。测试：

```bash
npm run obsidian:add -- --item 3
```

## 8. 安装自动运行

两个系统统一使用：

```bash
npm run scheduler:print
npm run scheduler:install
npm run scheduler:status
npm run verify
```

macOS 会安装每日 launchd 任务和常驻机器人任务。Windows 会注册 `DailyInfoRadar-Daily` 与 `DailyInfoRadar-Bot`：每日任务按配置时间运行，登录任务保持机器人监听，并在失败时重启。

卸载：

```bash
npm run scheduler:uninstall
```

Windows 任务以当前登录用户身份运行，不要求管理员权限。锁屏可以运行；从睡眠唤醒还取决于 Windows 电源计划中的“允许唤醒定时器”。

## 9. 最终验收

```bash
npm test
npm run sources:check
npm run doctor
npm run setup:check
npm run scheduler:status
```

`setup:check` 中的 `pipelineReady`、`deliveryReady`、`interactionReady`、`automationReady` 应全部为 `true`。

日志位于外部数据目录的 `logs/`：macOS 使用 `launchd-*.log`，Windows 使用 `task-scheduler-*.log`，每日 token 消耗记录在 `daily-runs.jsonl`，告警与恢复记录在 `incidents.jsonl`。
