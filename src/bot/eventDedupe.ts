import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export type RememberEventResult = {
  duplicate: boolean;
  tracked: boolean;
};

export async function rememberEventIfNew(options: {
  stateFile: string;
  eventId?: string;
  maxIds?: number;
}): Promise<RememberEventResult> {
  if (!options.eventId) return { duplicate: false, tracked: false };

  const maxIds = options.maxIds ?? 1000;
  const ids = await readKnownIds(options.stateFile);
  if (ids.includes(options.eventId)) return { duplicate: true, tracked: true };

  const nextIds = [...ids, options.eventId].slice(-maxIds);
  await mkdir(path.dirname(options.stateFile), { recursive: true });
  await writeFile(options.stateFile, `${nextIds.join("\n")}\n`, "utf8");
  return { duplicate: false, tracked: true };
}

async function readKnownIds(stateFile: string): Promise<string[]> {
  try {
    const content = await readFile(stateFile, "utf8");
    return content.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}
