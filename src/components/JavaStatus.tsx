import type { JavaAnalysis, JavaStatus as Status } from "../core/java";
import { Badge, type Tone } from "./ui";

const STATUS: Record<Status, { tone: Tone; label: string }> = {
  compatible: { tone: "good", label: "Compatible" },
  "too-old": { tone: "warn", label: "Too old" },
  unreadable: { tone: "warn", label: "Unreadable" },
  failed: { tone: "bad", label: "Could not run" },
};

export function JavaStatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function javaTitle(a: JavaAnalysis): string {
  return a.major !== null ? `Java ${a.major}` : "Unknown Java";
}
