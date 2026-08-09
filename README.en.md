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
- Cognitive production view with reading priority, cognitive-increment hypotheses, and creation angles.
- Lark/Feishu push using interactive message cards with clickable article links.
- Bot commands: `帮助`, `状态`, `重发日报`, `收藏第3条`, `加入待读 3 5`.
- Obsidian reading-list integration.
- macOS launchd and Windows Task Scheduler support, plus a long-running bot event listener.
- Daily run logs with model mode, model name, token usage, source count, candidate count, and selected item count.

## Installation

Requirements:

- macOS or Windows 10/11
- Node.js 25+
- `lark-cli` for Lark/Feishu bot messaging and events
- Windows PowerShell 5.1+ and Task Scheduler

```bash
git clone https://github.com/HANKSEN/daily-info-radar.git
cd daily-info-radar
npm test
npm run setup
```

See the [complete setup guide](./docs/setup-guide/manual-setup.en.md) for the end-to-end workflow.

## Agent-guided Setup

The repository includes a root `AGENTS.md`, staged readiness checks, and an [agent execution guide](./docs/setup-guide/agent-setup.md). Give the repository URL to a local coding agent with terminal access and ask it to follow those files completely. Secrets must be entered locally, never pasted into chat.

After setup, `npm run verify` runs tests, source diagnostics, staged readiness checks, and a dry-run artifact verification. A reusable local RSSHub template is available under [`deploy/rsshub/`](./deploy/rsshub/README.md).

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

Generate or rebuild the cognitive production Markdown:

```bash
npm run production
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

Install and load cross-platform scheduled jobs:

```bash
npm run scheduler:print
npm run scheduler:install
npm run scheduler:status
```

Uninstall:

```bash
npm run scheduler:uninstall
```

The legacy `launchd:*` commands remain available for macOS compatibility and debugging.

## Data Directory

Production data is stored outside the repository by default:

```text
../daily-info-radar.local-data
```

It contains:

- `raw/` collected source data
- `candidates/` candidate and analysis outputs
- `briefs/json/` JSON briefs
- `briefs/markdown/` regular Markdown briefs
- `briefs/production/` cognitive production Markdown for deep reading, insight cards, and content creation
- `logs/daily-runs.jsonl` daily run and token usage logs
- `state/` latest brief, latest run status, and event dedupe state

Do not commit this directory.

## Security

- `.env` is ignored by Git and must not be committed.
- `.env.example` only contains placeholders.
- API keys, Lark App Secrets, and access tokens are not written to logs.
- AI input contains only titles, source names, publish times, summaries, URLs, and local signals, not full article bodies.
- Lark CLI subprocesses use `LARK_CLI_NO_PROXY=1` to avoid sending credentials through local proxies.

## Sleep and Scheduling

macOS runs normally while locked but may delay work during true sleep. Windows tasks run while locked, start missed runs when available, and request wake-to-run; actual wake behavior still depends on the Windows wake-timer power policy.

## License

MIT
