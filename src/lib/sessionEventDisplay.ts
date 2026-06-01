/** Parsed camera observation stored on SessionEvent.text (actor: "camera"). */
export type CameraObservation = {
  movement_detected?: boolean;
  movement_type?: string;
  activity?: string;
  engagement?: string;
  confidence?: string;
  lesson_relevant?: string;
  description?: string;
  matches_expected?: boolean | null;
  performance_quality?: string | null;
  frames_analyzed?: number;
};

export type ParsedSessionEvent =
  | { kind: "camera"; data: CameraObservation }
  | { kind: "text"; text: string };

export function parseSessionEventText(raw: string): ParsedSessionEvent {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { kind: "text", text: "" };

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (
          "movement_detected" in obj ||
          "engagement" in obj ||
          "movement_type" in obj ||
          "description" in obj
        ) {
          return { kind: "camera", data: obj as CameraObservation };
        }
      }
    } catch {
      /* fall through */
    }
  }

  return { kind: "text", text: trimmed };
}

export function humanizeToken(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function cameraHeadline(data: CameraObservation): string {
  const primary =
    (typeof data.description === "string" && data.description.trim()) ||
    (typeof data.activity === "string" && data.activity.trim()) ||
    "";
  if (primary) return primary;
  if (data.movement_detected) return "Movement detected";
  return "No movement detected";
}

export function cameraSecondary(data: CameraObservation): string | null {
  const activity = typeof data.activity === "string" ? data.activity.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  if (activity && activity !== description) return activity;
  return null;
}
