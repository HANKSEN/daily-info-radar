# Requirements Document

## Introduction

Daily Info Radar currently runs its core workflow on Node.js but only provisions scheduled execution through macOS launchd. This change adds native Windows scheduling and a repository-level setup contract that another coding agent can follow from the public GitHub URL.

## Requirements

### Requirement 1 - Cross-platform scheduling

**User Story:** As a Windows user, I want the daily brief and bot listener to run automatically without installing a third-party process manager.

#### Acceptance Criteria

1. When a user runs the generic scheduler install command on macOS, the system shall install and load the existing launchd jobs.
2. When a user runs the generic scheduler install command on Windows, the system shall register a daily Task Scheduler task and a logon bot task.
3. While a Windows computer is locked, when the daily trigger fires, the system shall run the daily pipeline and send the latest brief.
4. When a scheduled time is missed, the Windows task shall run as soon as practical after the computer becomes available.
5. When the Windows bot process exits unexpectedly, the system shall restart it.
6. When an unsupported operating system requests scheduler installation, the system shall return a clear manual-run message without changing system state.

### Requirement 2 - Agent-guided setup

**User Story:** As a new user, I want to give the GitHub URL to my coding agent and have it complete every automatable setup step.

#### Acceptance Criteria

1. When an agent opens the repository, the repository shall provide root-level instructions describing the required setup order, validation commands, and secret-handling rules.
2. When setup is initialized, the system shall create a local `.env` from `.env.example` only if `.env` does not already exist.
3. When setup is initialized, the system shall create the external production-data directory without placing production data in the repository.
4. When setup readiness is checked, the system shall report pipeline, delivery, interaction, and automation readiness separately.
5. While credentials are required, the setup instructions shall require local secure entry and shall prohibit committing or printing secrets.
6. When browser authorization or a Feishu user action is required, the agent instructions shall pause for that action and resume all remaining work afterward.

### Requirement 3 - Reproducible documentation

**User Story:** As a non-technical user, I want a complete Windows and macOS guide with commands I can verify stage by stage.

#### Acceptance Criteria

1. When a user reads the setup guide, the guide shall cover prerequisites, AI configuration, sources, RSSHub, Feishu, first run, scheduling, logs, sleep behavior, and troubleshooting.
2. When a user changes schedule settings, the guide shall tell the user to reinstall the scheduler.
3. When an external agent follows the agent guide, it shall be able to determine the next unresolved setup step from repository commands rather than guessing.

