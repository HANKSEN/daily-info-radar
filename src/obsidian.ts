import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DailyBrief } from "./types.ts";

export type AddReadingListInput = {
  brief: DailyBrief;
  itemNumber: number;
  filePath: string;
  reason?: string;
};

export async function addBriefItemToReadingList(input: AddReadingListInput): Promise<{
  status: "added" | "duplicate";
  filePath: string;
}> {
  const item = input.brief.items[input.itemNumber - 1];
  if (!item) throw new Error(`Brief item #${input.itemNumber} does not exist.`);

  await mkdir(path.dirname(input.filePath), { recursive: true });
  const existing = await readOptional(input.filePath);
  if (existing.includes(`](${item.canonicalUrl})`) || existing.includes(`](${item.url})`)) {
    return { status: "duplicate", filePath: input.filePath };
  }

  const base = existing.trim()
    ? existing.trimEnd()
    : "# 信息待读清单\n";
  const sectionHeader = `## ${input.brief.date}`;
  const entry = [
    `- [ ] [${item.title}](${item.canonicalUrl})`,
    `  - 来源：${item.sourceName}`,
    `  - 分类：${item.domain} / ${item.contentType}`,
    `  - 推荐理由：${item.recommendationReason}`,
    `  - 加入原因：${input.reason ?? "飞书指令"}`,
    `  - 标签：${item.useTags.join(" / ")}`,
  ].join("\n");

  const next = base.includes(sectionHeader)
    ? `${base}\n\n${entry}\n`
    : `${base}\n\n${sectionHeader}\n\n${entry}\n`;

  await writeFile(input.filePath, next, "utf8");
  return { status: "added", filePath: input.filePath };
}

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}
