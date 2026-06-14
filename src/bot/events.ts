export type ParsedBotEvent = {
  eventId?: string;
  messageId?: string;
  chatId?: string;
  senderId?: string;
  text: string;
};

export function parseLarkEventLine(line: string): ParsedBotEvent | undefined {
  if (!line.trim()) return undefined;
  const raw = JSON.parse(line) as Record<string, unknown>;
  const event = objectValue(raw.event) ?? raw;
  const message = objectValue(event.message) ?? event;
  const sender = objectValue(event.sender) ?? event;

  const eventId = stringValue(raw.event_id) ?? stringValue(objectValue(raw.header)?.event_id) ?? stringValue(event.event_id);
  const messageId = stringValue(message.message_id) ?? stringValue(event.message_id);
  const chatId = stringValue(message.chat_id) ?? stringValue(event.chat_id);
  const senderId =
    stringValue(objectValue(sender.sender_id)?.open_id) ??
    stringValue(objectValue(sender.sender_id)?.user_id) ??
    stringValue(sender.sender_id) ??
    stringValue(event.sender_id);
  const text = extractText(message.content ?? event.content ?? "");

  return { eventId, messageId, chatId, senderId, text };
}

function extractText(content: unknown): string {
  if (typeof content === "string") {
    try {
      return extractText(JSON.parse(content));
    } catch {
      return content;
    }
  }
  const object = objectValue(content);
  if (!object) return "";
  return (
    stringValue(object.text) ??
    stringValue(object.title) ??
    stringValue(object.content) ??
    ""
  );
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
