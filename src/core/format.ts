/** 4096 -> "4 GB", 1536 -> "1.5 GB", 512 -> "512 MB". */
export function formatMemory(mb: number): string {
  if (!Number.isFinite(mb) || mb < 0) return "unknown";
  if (mb < 1024) return `${Math.round(mb)} MB`;
  const gb = mb / 1024;
  return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
}

export function joinParts(parts: Array<string | null | undefined>, separator = " · "): string {
  return parts.filter((p): p is string => typeof p === "string" && p.trim() !== "").join(separator);
}
