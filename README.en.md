# Daily Info Radar

<p align="center">
  <a href="./README.md">简体中文</a> · <a href="./README.en.md">English</a>
</p>

Daily Info Radar is a local-first daily briefing tool for AI, technology, and market intelligence. It collects information from multiple sources, deduplicates and ranks candidates, renders a structured daily brief, and sends it to Lark/Feishu through a bot.

It is designed for researchers, creators, product builders, investors, and engineers who want a repeatable daily signal pipeline instead of scanning scattered feeds manually.

## What It Solves

- Fragmented sources: aggregate official blogs, technical communities, Chinese tech media, and market snapshots.
- High noise: only keep items published in the previous 24 hours, then rank by source quality, duplication, and AI/rule-based analysis.
- Repetitive routine: archive locally, push to Lark, add selected items to Obsidian, and run on a schedule.
- Data/code separation: production data is written outside the repository, so reusable code can be open-sourced safely.

## Features

- RSS, API, scraping, and market data collectors.
- 24-hour freshness window: only items published in the previous 24 hours enter the candidate pool.
- Candidate deduplication and fair source sampling.
- OpenAI-compatible analysis mode or local heuristic mode.
- Lark/Feishu push using interactive message cards with clickable article links.
- Bot commands: `帮助`, `状态`, `重发日报`, `收藏第3条`, `加入待读 3 5`.
- Obsidian reading-list integration.
- macOS launchd scheduling and long-running bot event listener.
- Daily run logs with model mode, model name, token usage, source count, candidate count, and selected item count.

## Installation

Requirements:

- macOS for launchd scheduling
- Node.js 25+
- `lark-cli` for Lark/Feishu bot messaging and events

```bash
git clone https://github.com/HANKSEN/daily-info-radar.git
cd daily-info-radar
cp .env.example .env
npm test
```

## Configuration

Edit `.env`:

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

Without an API key, use local ranking:

```bash
RADAR_AI_MODE=heuristic
```

In heuristic mode, no external AI API is called and token usage is recorded as 0.

## Lark/Feishu Bot

Create a dedicated custom app and enable bot capability.

Minimum scopes:

- `im:message:send_as_bot`
- `im:message.p2p_msg:readonly`

Event subscription:

- `im.message.receive_v1`

Configure the local CLI:

```bash
lark-cli config init --new
```

Fill `LARK_CHAT_ID` in `.env` with the P2P or group `chat_id`. For personal delivery, the bot does not need to join a group.

## Usage

Dry-run locally:

```bash
npm run daily:dry
```

Generate a real daily brief:

```bash
npm run daily
```

Send the latest brief to Lark:

```bash
npm run send:latest
```

Force a new message, useful when testing card rendering:

```bash
npm run send:latest -- --force
```

Preview the send request:

```bash
npm run send:latest -- --dry-run
```

Messages are sent as interactive cards by default. To send Markdown instead:

```bash
npm run send:latest -- --markdown
```

Add item 3 to an Obsidian reading list:

```bash
npm run obsidian:add -- --item 3
```

Run the bot event listener:

```bash
npm run bot
```

Install and load launchd jobs:

```bash
npm run launchd:install -- --load
```

Uninstall:

```bash
npm run launchd:uninstall -- --unload
```

## Data Directory

Production data is stored outside the repository by default:

```text
../daily-info-radar.local-data
```

It contains:

- `raw/` collected source data
- `candidates/` candidate and analysis outputs
- `briefs/` JSON and Markdown briefs
- `logs/daily-runs.jsonl` daily run and token usage logs
- `state/` latest brief, latest run status, and event dedupe state

Do not commit this directory.

## Security

- `.env` is ignored by Git and must not be committed.
- `.env.example` only contains placeholders.
- API keys, Lark App Secrets, and access tokens are not written to logs.
- AI input contains only titles, source names, publish times, summaries, URLs, and local signals, not full article bodies.
- launchd uses `LARK_CLI_NO_PROXY=1` to avoid sending Lark credentials through local proxies.

## Sleep and Scheduling

launchd runs normally when the Mac is locked but awake. It cannot guarantee on-time delivery while the Mac is fully asleep. Configure macOS wake scheduling separately if strict delivery time matters.

## License

MIT
