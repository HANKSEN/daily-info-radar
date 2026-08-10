import type { LarkTarget } from "./send.ts";

export function larkTargetFromEnv(
  env: Record<string, string | undefined>,
): LarkTarget {
  if (env.LARK_CHAT_ID) return { chatId: env.LARK_CHAT_ID };
  if (env.LARK_USER_ID) return { userId: env.LARK_USER_ID };
  throw new Error("Missing LARK_CHAT_ID or LARK_USER_ID in .env.");
}
