# Local RSSHub Template

This Compose file is a reusable repository asset. Copy it to a sibling runtime directory before starting it so local runtime state remains separate from the open-source repository.

macOS or Linux shell:

```bash
mkdir -p ../daily-info-radar.local-rsshub
cp deploy/rsshub/docker-compose.yml ../daily-info-radar.local-rsshub/docker-compose.yml
docker compose -f ../daily-info-radar.local-rsshub/docker-compose.yml up -d
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force ..\daily-info-radar.local-rsshub
Copy-Item deploy\rsshub\docker-compose.yml ..\daily-info-radar.local-rsshub\docker-compose.yml
docker compose -f ..\daily-info-radar.local-rsshub\docker-compose.yml up -d
```

Set `RSSHUB_BASE_URL=http://127.0.0.1:1200` in the private `.env` file. Docker volumes hold Redis data outside the Git worktree.
