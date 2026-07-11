export type ClientCopySegment = {
  type: "answer" | "client-copy";
  text: string;
};

export function stripLeadingContextLabel(answer: string): string {
  let sanitized = answer;
  const leadingContextPattern =
    /^\s*(?:Контекст|Context)\s*:\s*[^\r\n]*(?:\r?\n|$)/i;

  while (leadingContextPattern.test(sanitized)) {
    sanitized = sanitized
      .replace(leadingContextPattern, "")
      .replace(/^\s+/, "");
  }

  return sanitized;
}

export function parseClientCopySegments(text: string): ClientCopySegment[] {
  const segments: ClientCopySegment[] = [];
  const markerPattern = /\[CLIENT_COPY_START\]([\s\S]*?)\[CLIENT_COPY_END\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = markerPattern.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) segments.push({ type: "answer", text: before });
    const clientText = match[1].trim();
    if (clientText) segments.push({ type: "client-copy", text: clientText });
    lastIndex = markerPattern.lastIndex;
  }

  const after = text.slice(lastIndex).trim();
  if (after) segments.push({ type: "answer", text: after });
  return segments.length ? segments : [{ type: "answer", text }];
}

export function serializeAnswerForWholeCopy(text: string): string {
  return removeClientCopyMarkerLines(text).trim();
}

export function removeClientCopyMarkerLines(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[CLIENT_COPY_(?:START|END)\]\s*$/.test(line))
    .join("\n");
}

export function cleanAssistantTextForModelContext(text: string): string {
  return stripLeadingContextLabel(removeClientCopyMarkerLines(text)).trim();
}

export function stripMarkdownForPreview(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s{0,3}#{1,6}\s+/, ""))
    .join("\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g, "$1$2")
    .replace(/(^|[^_])_([^_\n]+)_(?=[^_]|$)/g, "$1$2");
}

export function cleanAssistantTextForPreview(text: string): string {
  return stripMarkdownForPreview(cleanAssistantTextForModelContext(text))
    .replace(/\s+/g, " ")
    .trim();
}
