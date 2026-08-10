import path from "node:path";
import { readFile } from "node:fs/promises";

import type { DailyIncident } from "./types.ts";
import { ensureStorage, writeJson } from "./storage.ts";
import { appendFile } from "node:fs/promises";

export async function writeDailyIncident(dataDir: string, incident: DailyIncident): Promise<void> {
  await ensureStorage(dataDir);
  await appendFile(
    path.join(dataDir, "logs", "incidents.jsonl"),
    `${JSON.stringify(incident)}\n`,
    "utf8",
  );
  await writeJson(path.join(dataDir, "state", "latest-incident.json"), incident);
}

export async function readLatestIncident(dataDir: string): Promise<DailyIncident | undefined> {
  try {
    return JSON.parse(
      await readFile(path.join(dataDir, "state", "latest-incident.json"), "utf8"),
    ) as DailyIncident;
  } catch {
    return undefined;
  }
}

export async function resolveLatestIncident(
  dataDir: string,
  now = new Date(),
): Promise<DailyIncident | undefined> {
  const incident = await readLatestIncident(dataDir);
  if (!incident || incident.status === "resolved") return incident;
  const resolved = { ...incident, status: "resolved" as const, updatedAt: now.toISOString() };
  await writeDailyIncident(dataDir, resolved);
  return resolved;
}
