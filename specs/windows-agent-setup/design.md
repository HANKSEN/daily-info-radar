# Technical Design

## Architecture

The existing collection, analysis, rendering, Lark, and Obsidian modules remain unchanged. A generic scheduler facade selects launchd on macOS and Windows Task Scheduler on Windows.

```text
npm scheduler commands
        |
        +-- darwin --> existing launchd renderer/loader
        |
        +-- win32 --> PowerShell registration scripts
                         +-- daily.ps1: daily -> send:latest
                         +-- bot.ps1: persistent bot listener
```

## Components

- `src/scheduler.ts`: platform selection, generic install/uninstall/status/preview API.
- `src/windowsScheduler.ts`: Windows plan rendering and safe PowerShell process invocation.
- `scripts/windows/`: committed PowerShell entry points for registration and runtime.
- `src/setup.ts`: idempotent local initialization and staged readiness inspection.
- `AGENTS.md`: machine-oriented setup and secret-handling contract.
- `docs/setup-guide/`: human and agent setup documentation.

## Security

- `.env` is created with restrictive permissions where supported and is never overwritten.
- API keys and App Secrets are never returned by setup or doctor output.
- App Secret remains managed by `lark-cli` and the operating-system credential store.
- Windows scheduled tasks reference committed scripts and explicit absolute paths.
- Production data remains outside the repository through the existing data-directory assertion.

## Compatibility

- Existing `launchd:*` commands remain available.
- New `scheduler:*` commands are the documented cross-platform interface.
- Windows PowerShell 5.1 and later are targeted through built-in ScheduledTasks cmdlets.
- Linux remains manually runnable but does not receive a scheduler in this change.

## Test Strategy

- Unit-test platform selection and Windows task plans on macOS without mutating Task Scheduler.
- Unit-test idempotent setup initialization and staged readiness.
- Keep all existing tests green.
- Exercise `setup`, `setup:check`, `scheduler:print`, and legacy launchd preview locally.

