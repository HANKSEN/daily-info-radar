# Daily Info Radar Agent Setup Contract

This repository is designed to be configured by a local coding agent on macOS or Windows. Read this file and `docs/setup-guide/agent-setup.md` before changing files or running setup commands.

## Safety Rules

- Never ask the user to paste an API key, App Secret, access token, or complete `.env` file into chat.
- Let the user enter secrets locally in `.env` or the interactive `lark-cli` flow.
- Never print `.env`, credential-store contents, or secret-bearing process environments.
- Never commit `.env`, `config/sources.json`, local data, logs, caches, or local RSSHub runtime data.
- Never push to GitHub unless the user explicitly asks after local verification.
- Preserve unrelated worktree changes.
- Keep `RADAR_DATA_DIR` outside the repository.

## Required Workflow

1. Confirm the operating system and verify Node.js 25 or newer.
2. Run `npm test`.
3. Run `npm run setup`; this creates `.env` only when absent and initializes external storage.
4. Run `npm run setup:check` and use its staged readiness fields as the source of truth.
5. Ask the user to enter missing AI credentials locally, or set `RADAR_AI_MODE=heuristic` with their consent.
6. Install `lark-cli` when missing with `npx @larksuite/cli@latest install`.
7. Run `lark-cli config init --new` for a new app, or bind the user's existing app. Forward the browser URL and wait for the user to finish the browser action.
8. Ensure the Feishu app has bot capability, `im:message:send_as_bot`, `im:message.p2p_msg:readonly`, long-connection event delivery, and `im.message.receive_v1`; the user may need to publish the app version.
9. Capture one private-message event with `lark-cli event consume im.message.receive_v1 --max-events 1 --timeout 2m --as bot`. Ask the user to message the bot, then write the returned `chat_id` and `sender_id` into the non-secret allowlist fields in `.env`.
10. Run `npm run sources:check`, then `npm run doctor`. Resolve required failures; individual source failures are allowed when at least one source remains reachable. When the RSSHub-backed key sources fail and Docker is available, copy `deploy/rsshub/docker-compose.yml` to the sibling `daily-info-radar.local-rsshub` directory and start it there.
11. Run `npm run daily:dry`, `npm run daily`, and `npm run send:latest -- --dry-run`. Scheduled execution uses `npm run daily:scheduled` after the first-send checkpoint.
12. Ask for confirmation immediately before the first real Feishu send, then run `npm run send:latest -- --force`.
13. Verify `npm run bot -- --dry-run`. Configure Obsidian only when requested.
14. Run `npm run scheduler:print`, then `npm run scheduler:install`, and verify with `npm run scheduler:status`.
15. Finish with `npm run verify` and `npm run scheduler:status`, then report the four readiness fields, failed sources, data/log paths, schedule, and sleep limitations.

## Platform Notes

- macOS uses launchd. Locking the screen is fine; true sleep may delay network work.
- Windows uses Task Scheduler. The tasks run for the current interactive user, support locked-screen execution, start missed runs when available, and request wake-to-run. Windows wake timers and power policy still control whether the machine wakes.
- Linux supports manual commands but has no scheduler adapter in this version.
- Reinstall the scheduler after upgrading so existing jobs use the alert-aware `daily:scheduled` command.

## Completion Criteria

Configuration is complete only when `pipelineReady`, `deliveryReady`, `interactionReady`, and `automationReady` are all true, a real daily brief has been generated, the user has confirmed receipt of a Feishu card, and the scheduler status shows both jobs installed.
