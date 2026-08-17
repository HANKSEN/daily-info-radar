# Daily Info Radar: Setup from Zero

This guide supports macOS and Windows 10/11. The information pipeline is cross-platform; macOS uses launchd and Windows uses Task Scheduler.

## 1. Prerequisites

Install Git and Node.js 25 or newer. Prepare an OpenAI-compatible API key and a Feishu/Lark custom app. Docker Desktop is optional but recommended for a reliable local RSSHub instance.

```bash
git --version
node --version
npm --version
```

## 2. Clone and initialize

```bash
git clone https://github.com/HANKSEN/daily-info-radar.git
cd daily-info-radar
npm test
npm run setup
```

Setup creates `.env` only when it is absent and initializes a sibling `daily-info-radar.local-data` directory outside the repository.

## 3. Configure AI and schedule

Edit `.env` locally. Never paste secrets into chat, issues, or GitHub:

```dotenv
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=your-real-key
AI_MODEL=deepseek-v4-flash
RADAR_AI_MODE=openai
RADAR_TIMEZONE=Asia/Shanghai
RADAR_DAILY_HOUR=8
RADAR_DAILY_MINUTE=0
RADAR_ALERTS_ENABLED=true
RADAR_MIN_HEALTHY_SOURCES=10
RADAR_MAX_SOURCE_FAILURE_RATIO=0.5
RADAR_ALERT_ON_PARTIAL_SOURCE_FAILURE=false
```

Use `deepseek-v4-pro` when stronger analysis is worth the additional latency and cost.

Use `RADAR_AI_MODE=heuristic` to run without an external model. Reinstall the scheduler after changing the time.

## 4. Check sources

```bash
npm run sources
npm run sources:check
```

Individual source failures do not stop the brief. To customize sources, copy `config/sources.example.json` to the Git-ignored `config/sources.json`. For local RSSHub set `RSSHUB_BASE_URL=http://127.0.0.1:1200` and verify the LatePost, 36Kr, and Huxiu routes.

Use the reusable Compose template in `deploy/rsshub/README.md`; copy it to the sibling `daily-info-radar.local-rsshub` runtime directory before starting Docker.

## 5. Configure the Feishu/Lark bot

Create a custom app, enable bot capability, and grant `im:message:send_as_bot` and `im:message.p2p_msg:readonly`.

```bash
npm install -g @larksuite/cli
lark-cli config init --new
lark-cli auth login --recommend
lark-cli auth status
lark-cli doctor
lark-cli event consume im.message.receive_v1 --max-events 1 --timeout 10m --as bot
```

Keep the final command running. In the developer console, select long-connection event delivery, subscribe to `im.message.receive_v1`, set an availability range that includes your account, and publish the app version. Send the bot one private message, then store the returned IDs in `.env`:

```dotenv
LARK_CHAT_ID=oc_xxx
LARK_ALLOWED_CHAT_IDS=oc_xxx
LARK_ALLOWED_SENDER_IDS=ou_xxx
```

## 6. Verify the real workflow

```bash
npm run daily:dry
npm run doctor
npm run daily
npm run send:latest -- --dry-run
npm run send:latest -- --force
npm run bot -- --dry-run
```

The scheduler runs `npm run daily:scheduled`, which records collection, AI, and delivery failures and attempts to send an incident card through the same bot. Allowlisted users can reply in natural language with `重新生成今天的资讯`, `检查信息源`, `查看今日候选资讯`, or `查看处理指引`. Secrets must never be sent to the bot.

## 7. Install automation

```bash
npm run scheduler:print
npm run scheduler:install
npm run scheduler:status
npm run verify
```

On Windows this registers `DailyInfoRadar-Daily` and `DailyInfoRadar-Bot` for the current interactive user. Locked-screen execution is supported. Wake-from-sleep depends on the Windows wake-timer power policy.

Uninstall with `npm run scheduler:uninstall`.

## 8. Final acceptance

```bash
npm test
npm run sources:check
npm run doctor
npm run setup:check
npm run scheduler:status
```

`pipelineReady`, `deliveryReady`, `interactionReady`, and `automationReady` should all be `true`. Runtime and token logs are stored under the external data directory's `logs/` folder; incident history is stored in `incidents.jsonl`.
