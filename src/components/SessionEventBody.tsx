"use client";

import type { CSSProperties } from "react";
import type { SessionEventSchema } from "../lib/api/generated/sessionsApi";
import {
  cameraHeadline,
  cameraSecondary,
  humanizeToken,
  parseSessionEventText,
  type CameraObservation,
} from "../lib/sessionEventDisplay";

const ACCENT_ORANGE = "#f0a043";
const ACCENT_TERRA = "#c95c4a";
const TEXT_PRIMARY = "#f6efe3";
const TEXT_MUTED = "rgba(246,239,227,0.62)";
const HAIRLINE = "rgba(246,239,227,0.16)";
const FONT_SANS = '"Inter", "Helvetica Neue", system-ui, -apple-system, sans-serif';

function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "gold" | "terra" | "neutral";
}) {
  const color = tone === "gold" ? ACCENT_ORANGE : tone === "terra" ? ACCENT_TERRA : TEXT_MUTED;
  const bg =
    tone === "gold"
      ? "rgba(240,160,67,0.14)"
      : tone === "terra"
        ? "rgba(201,92,74,0.14)"
        : "rgba(246,239,227,0.08)";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "4px 9px",
        borderRadius: 99,
        color,
        background: bg,
        border: `1px solid ${HAIRLINE}`,
        fontFamily: FONT_SANS,
      }}
    >
      {label}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
      <span
        style={{
          color: TEXT_MUTED,
          fontSize: 11,
          fontFamily: FONT_SANS,
          minWidth: 88,
          flexShrink: 0,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ color: TEXT_PRIMARY, fontSize: 13, fontFamily: FONT_SANS, lineHeight: 1.5 }}>
        {value}
      </span>
    </div>
  );
}

function CameraObservationView({ data }: { data: CameraObservation }) {
  const secondary = cameraSecondary(data);
  const engagement = data.engagement ? humanizeToken(data.engagement) : null;
  const movementType =
    data.movement_type && data.movement_type !== "unknown"
      ? humanizeToken(data.movement_type)
      : null;
  const confidence = data.confidence ? humanizeToken(data.confidence) : null;
  const lessonNote =
    typeof data.lesson_relevant === "string" ? data.lesson_relevant.trim() : "";

  const engagementTone =
    data.engagement === "engaged"
      ? "gold"
      : data.engagement === "distracted" || data.engagement === "absent"
        ? "terra"
        : "neutral";

  return (
    <div>
      <p
        style={{
          color: TEXT_PRIMARY,
          fontSize: 15,
          lineHeight: 1.55,
          margin: "0 0 10px",
          fontFamily: FONT_SANS,
        }}
      >
        {cameraHeadline(data)}
      </p>
      {secondary ? (
        <p style={{ color: TEXT_MUTED, fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
          {secondary}
        </p>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {engagement ? <Badge label={engagement} tone={engagementTone} /> : null}
        {movementType ? <Badge label={movementType} /> : null}
        {confidence ? <Badge label={`${confidence} confidence`} /> : null}
        {data.movement_detected === false ? <Badge label="Still" tone="neutral" /> : null}
      </div>
      {lessonNote ? <DetailRow label="Lesson" value={lessonNote} /> : null}
      {typeof data.frames_analyzed === "number" && data.frames_analyzed > 0 ? (
        <DetailRow label="Frames" value={`${data.frames_analyzed} analyzed`} />
      ) : null}
      {data.matches_expected != null ? (
        <DetailRow
          label="On track"
          value={data.matches_expected ? "Matches expected movement" : "Different from prompt"}
        />
      ) : null}
      {data.performance_quality ? (
        <DetailRow label="Quality" value={humanizeToken(data.performance_quality)} />
      ) : null}
    </div>
  );
}

export function SessionEventTurnTitle({ event }: { event: SessionEventSchema }) {
  const actorLabel =
    event.actor === "camera"
      ? "Camera"
      : event.actor === "child"
        ? "Child"
        : event.actor === "toy"
          ? "Curious Buddy"
          : humanizeToken(event.actor);
  return (
    <>
      Turn {event.turn_number} · {actorLabel}
    </>
  );
}

export function SessionEventBody({
  event,
  textStyle,
}: {
  event: SessionEventSchema;
  textStyle?: CSSProperties;
}) {
  const parsed = parseSessionEventText(event.text);
  if (parsed.kind === "camera") {
    return <CameraObservationView data={parsed.data} />;
  }
  return (
    <p
      style={{
        color: TEXT_MUTED,
        fontFamily: FONT_SANS,
        fontSize: 13,
        lineHeight: 1.6,
        margin: 0,
        ...textStyle,
      }}
    >
      {parsed.text || "No details recorded for this turn."}
    </p>
  );
}
