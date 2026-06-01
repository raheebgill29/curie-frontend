"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useHomeData } from "../lib/hooks/useHomeData";
import type {
  ActiveSessionCard,
  HomeSummaryResponse,
  ParentResponse,
  ToyStatusResponse,
} from "../lib/api/homeApi";
import { useGetChildInsightsChildrenChildIdInsightsGetQuery } from "../lib/api/generated/childrenApi";
import {
  useGetChildSessionsSessionsChildIdGetQuery,
  useGetSessionDetailSessionsSessionIdDetailGetQuery,
} from "../lib/api/generated/sessionsApi";
import Loading, { LoadingSpinner } from "./Loading";
import NudgeTopicModal from "./NudgeTopicModal";
import { SessionEventBody, SessionEventTurnTitle } from "./SessionEventBody";

// ── Theme tokens (locked to spec) ────────────────────────────────────────────
const SCREEN_BG = "#3e4f57"; // slate/teal-grey
const CARD_BG = "#4a5b63"; // slightly lighter slate
const CARD_RADIUS = 12;
const ACCENT_ORANGE = "#f0a043";
const ACCENT_TERRA = "#c95c4a";
const TEXT_PRIMARY = "#f6efe3"; // warm off-white
const TEXT_MUTED = "rgba(246,239,227,0.62)";
const TEXT_DIM = "rgba(246,239,227,0.42)";
const HAIRLINE = "rgba(246,239,227,0.16)";

const FONT_SERIF = '"Lora", "Libre Caslon Text", Georgia, "Times New Roman", serif';
const FONT_SANS = '"Inter", "Helvetica Neue", system-ui, -apple-system, sans-serif';

const CAPS_LABEL: CSSProperties = {
  fontFamily: FONT_SANS,
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontWeight: 700,
};

// ── Public props ─────────────────────────────────────────────────────────────
export type HomeScreenProps = {
  parentId: number;
  childId: number;
  /** Display fallback name (e.g. from session) used until /parents fetches. */
  fallbackParentName?: string;
};

// ── Display helpers ──────────────────────────────────────────────────────────
function deriveParentName(parent: ParentResponse | undefined, fallback?: string): string {
  if (parent?.email) {
    const local = parent.email.split("@")[0] ?? "";
    if (local) {
      // "curious_user" -> "Curious User"
      return local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(" ") || local;
    }
  }
  return fallback ?? "Parent";
}

function parentInitial(parent: ParentResponse | undefined, fallback?: string): string {
  const name = deriveParentName(parent, fallback);
  return name.charAt(0).toUpperCase() || "C";
}

function formatElapsedMinutes(elapsedSeconds: number): string {
  if (elapsedSeconds < 60) return "<1 min elapsed";
  return `${Math.floor(elapsedSeconds / 60)} min elapsed`;
}

function formatDelta(delta: number | null | undefined): string | null {
  if (delta == null) return null;
  if (delta === 0) return "same as yesterday";
  const sign = delta > 0 ? "+" : "-";
  return `${sign}${Math.abs(delta)} min vs yesterday`;
}

function humanizeLessonTitle(title: string): string {
  // Spec example "Body Awareness - Song And Movement" → display variant
  // with en-dash and ampersand: "Body Awareness – Songs & Movement"
  if (!title) return "Lesson";
  return title.replace(/\s*-\s*/g, " \u2013 ").replace(/\s+And\s+/g, " & ");
}

// ── Toast (lightweight, no portal) ───────────────────────────────────────────
type ToastState = { id: number; message: string } | null;

function Toast({ state }: { state: ToastState }) {
  if (!state) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 96,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(33,42,46,0.95)",
        color: TEXT_PRIMARY,
        padding: "10px 18px",
        borderRadius: 999,
        fontSize: 13,
        fontFamily: FONT_SANS,
        letterSpacing: "0.02em",
        border: `1px solid ${HAIRLINE}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.32)",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      {state.message}
    </div>
  );
}

function useToast(): { toast: ToastState; show: (msg: string) => void } {
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);
  return {
    toast,
    show: (message: string) => setToast({ id: Date.now(), message }),
  };
}

// ── Skeleton primitives ──────────────────────────────────────────────────────
function Shimmer({ width, height, radius = 8, style }: {
  width: number | string;
  height: number | string;
  radius?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, rgba(246,239,227,0.08) 0%, rgba(246,239,227,0.18) 50%, rgba(246,239,227,0.08) 100%)",
        backgroundSize: "200% 100%",
        animation: "curie-shimmer 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

function ActiveSessionSkeleton() {
  return (
    <div style={cardStyle()}>
      <Shimmer width={170} height={14} radius={999} style={{ marginBottom: 14 }} />
      <Shimmer width="78%" height={22} style={{ marginBottom: 8 }} />
      <Shimmer width="55%" height={14} style={{ marginBottom: 20 }} />
      <Shimmer width="100%" height={46} radius={10} />
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div style={cardStyle({ padding: 18 })}>
      <Shimmer width={120} height={11} radius={999} style={{ marginBottom: 14 }} />
      <Shimmer width={86} height={28} style={{ marginBottom: 10 }} />
      <Shimmer width={120} height={11} radius={999} />
    </div>
  );
}

function cardStyle(extra: Partial<CSSProperties> = {}): CSSProperties {
  return {
    background: CARD_BG,
    borderRadius: CARD_RADIUS,
    padding: 20,
    border: `1px solid ${HAIRLINE}`,
    ...extra,
  };
}

// ── Header ───────────────────────────────────────────────────────────────────
function HomeHeader({
  parent,
  fallbackParentName,
}: {
  parent: ParentResponse | undefined;
  fallbackParentName?: string;
}) {
  const name = deriveParentName(parent, fallbackParentName);
  const initial = parentInitial(parent, fallbackParentName);
  return (
    <div style={{ padding: "20px 22px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ ...CAPS_LABEL, color: ACCENT_ORANGE, margin: 0 }}>Good Morning</p>
          <h1
            style={{
              color: TEXT_PRIMARY,
              fontSize: 30,
              lineHeight: 1.1,
              margin: "6px 0 0",
              fontWeight: 700,
              fontFamily: FONT_SERIF,
              letterSpacing: "-0.01em",
            }}
          >
            {name}
          </h1>
        </div>
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${ACCENT_ORANGE}, ${ACCENT_TERRA})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: SCREEN_BG,
            fontFamily: FONT_SERIF,
            fontWeight: 700,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
      </div>
      <div style={{ height: 1, background: HAIRLINE, marginTop: 18 }} />
    </div>
  );
}

// ── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ toy }: { toy: ToyStatusResponse | undefined }) {
  const online = !!toy?.online;
  // Per spec: dot/colour reflects toy status. Orange when online, dimmed when off.
  const dotColor = online ? ACCENT_ORANGE : "rgba(246,239,227,0.32)";
  const textColor = online ? ACCENT_ORANGE : TEXT_MUTED;
  const label = online ? "Curious Buddy Online" : "Curious Buddy Offline";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: dotColor,
          boxShadow: online ? `0 0 8px ${ACCENT_ORANGE}` : "none",
        }}
      />
      <span style={{ ...CAPS_LABEL, color: textColor }}>{label}</span>
    </div>
  );
}

// ── Active session card ──────────────────────────────────────────────────────
function ActiveSessionCardView({
  toy,
  session,
  elapsedSeconds,
  onNudgePressed,
}: {
  toy: ToyStatusResponse | undefined;
  session: ActiveSessionCard;
  elapsedSeconds: number;
  onNudgePressed: (sessionId: number) => void;
}) {
  const title = humanizeLessonTitle(session.lesson_title);
  const elapsedLabel = formatElapsedMinutes(elapsedSeconds);
  const roundLabel = `Round ${session.round_number} of ${session.total_rounds}`;
  return (
    <div style={cardStyle()}>
      <div style={{ marginBottom: 14 }}>
        <StatusPill toy={toy} />
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <h2
          style={{
            color: TEXT_PRIMARY,
            fontFamily: FONT_SERIF,
            fontWeight: 700,
            fontSize: 22,
            lineHeight: 1.22,
            margin: 0,
          }}
        >
          {title}
        </h2>
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 10,
            background: "rgba(240,160,67,0.16)",
            border: "1px solid rgba(240,160,67,0.32)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
          }}
        >
          {/* Placeholder lesson icon — swap for icon library when chosen. */}
          <span>♪</span>
        </div>
      </div>
      <p
        style={{
          color: TEXT_MUTED,
          fontFamily: FONT_SANS,
          fontSize: 13,
          margin: "4px 0 18px",
          letterSpacing: "0.01em",
        }}
      >
        {elapsedLabel} · {roundLabel}
      </p>
      <button
        type="button"
        onClick={() => onNudgePressed(session.session_id)}
        style={{
          width: "100%",
          padding: "13px 16px",
          borderRadius: 10,
          background: ACCENT_TERRA,
          color: "#fff",
          border: "none",
          fontFamily: FONT_SERIF,
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
          letterSpacing: "0.01em",
        }}
      >
        ✦ Nudge Topic
      </button>
    </div>
  );
}

function NoActiveSessionCard({ toy }: { toy: ToyStatusResponse | undefined }) {
  return (
    <div
      style={cardStyle({
        background: "rgba(74,91,99,0.6)",
        borderStyle: "dashed",
        borderColor: "rgba(246,239,227,0.18)",
      })}
    >
      <div style={{ marginBottom: 12 }}>
        <StatusPill toy={toy} />
      </div>
      <p style={{ ...CAPS_LABEL, color: TEXT_MUTED, margin: "0 0 8px" }}>No Active Session</p>
      <p
        style={{
          color: TEXT_MUTED,
          fontFamily: FONT_SERIF,
          fontSize: 16,
          margin: 0,
          lineHeight: 1.45,
        }}
      >
        Curious Buddy is waiting to play.
      </p>
    </div>
  );
}

// ── Stat cards ───────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  caption,
  valueColor,
}: {
  label: string;
  value: ReactNode;
  caption?: string | null;
  valueColor: string;
}) {
  return (
    <div style={cardStyle({ padding: 18 })}>
      <p style={{ ...CAPS_LABEL, color: TEXT_MUTED, margin: "0 0 14px" }}>{label}</p>
      <p
        style={{
          color: valueColor,
          fontFamily: FONT_SERIF,
          fontWeight: 700,
          fontSize: 30,
          lineHeight: 1,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </p>
      {caption ? (
        <p
          style={{
            color: TEXT_MUTED,
            fontFamily: FONT_SANS,
            fontSize: 12,
            margin: "10px 0 0",
            letterSpacing: "0.01em",
          }}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}

// ── Insight mapping (restored from TabDashboard) ─────────────────────────────
const INSIGHT_ICONS = ["💬", "🧠", "🎨"] as const;
type InsightsApiShape = { insights?: { date?: string; insight: string }[] };

function mapInsights(insightsData: InsightsApiShape | undefined): { icon: string; text: string }[] {
  const apiInsights = insightsData?.insights ?? [];
  return apiInsights.slice(0, 3).map((item, index) => ({
    icon: INSIGHT_ICONS[index % INSIGHT_ICONS.length],
    text: item.insight,
  }));
}

// ── Section header (caps label in accent orange) ─────────────────────────────
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{ ...CAPS_LABEL, color: ACCENT_ORANGE, margin: "0 0 12px" }}>
      {children}
    </p>
  );
}

// ── Latest session detail (restored) ─────────────────────────────────────────
function LatestSessionDetailCard({ childId }: { childId: number }) {
  const { data: sessions } = useGetChildSessionsSessionsChildIdGetQuery({
    childId,
    page: 1,
    pageSize: 5,
  });
  const latestSession = sessions?.items?.[0];
  const { data: latestSessionDetail } = useGetSessionDetailSessionsSessionIdDetailGetQuery(
    latestSession?.id ? { sessionId: latestSession.id } : skipToken,
  );
  const latestEvent = latestSessionDetail?.events?.[(latestSessionDetail.events?.length ?? 0) - 1];
  if (!latestEvent) return null;
  return (
    <div style={cardStyle()}>
      <SectionLabel>Latest Session Detail</SectionLabel>
      <p
        style={{
          color: TEXT_PRIMARY,
          fontFamily: FONT_SERIF,
          fontWeight: 700,
          fontSize: 15,
          margin: "0 0 10px",
        }}
      >
        <SessionEventTurnTitle event={latestEvent} />
      </p>
      <SessionEventBody event={latestEvent} />
    </div>
  );
}

// ── AI insights (restored) ───────────────────────────────────────────────────
function AiInsightsCard({ childId }: { childId: number }) {
  const { data: insightsData, isFetching } = useGetChildInsightsChildrenChildIdInsightsGetQuery({
    childId,
  });
  const insights = mapInsights(insightsData);
  return (
    <div style={cardStyle()}>
      <SectionLabel>Today's AI Insights</SectionLabel>
      {isFetching ? (
        <Loading variant="section" size="sm" message="Loading insights…" />
      ) : insights.length === 0 ? (
        <p style={{ color: TEXT_MUTED, fontFamily: FONT_SANS, fontSize: 13, margin: 0 }}>
          No insights yet.
        </p>
      ) : (
        insights.map((ins, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 13,
              marginBottom: i < insights.length - 1 ? 14 : 0,
              paddingBottom: i < insights.length - 1 ? 14 : 0,
              borderBottom: i < insights.length - 1 ? `1px solid ${HAIRLINE}` : "none",
            }}
          >
            <span style={{ fontSize: 17, lineHeight: 1.4 }}>{ins.icon}</span>
            <p style={{ color: TEXT_MUTED, fontFamily: FONT_SANS, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              {ins.text}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

// ── Quick controls (Mode + Volume) ───────────────────────────────────────────
const MODES = ["Learning", "Sleep", "Free Chat"] as const;

function QuickControlsCard() {
  const [mode, setMode] = useState<(typeof MODES)[number]>("Learning");
  const [vol, setVol] = useState(70);
  return (
    <div style={cardStyle()}>
      <SectionLabel>Quick Controls</SectionLabel>
      <p
        style={{
          ...CAPS_LABEL,
          color: TEXT_MUTED,
          fontSize: 10,
          margin: "0 0 10px",
        }}
      >
        Mode
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {MODES.map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: "9px 4px",
                borderRadius: 10,
                background: active ? ACCENT_ORANGE : "rgba(246,239,227,0.08)",
                color: active ? SCREEN_BG : TEXT_MUTED,
                fontWeight: active ? 700 : 400,
                fontSize: 12,
                border: `1px solid ${active ? ACCENT_ORANGE : HAIRLINE}`,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: FONT_SERIF,
              }}
            >
              {m}
            </button>
          );
        })}
      </div>
      <p
        style={{
          ...CAPS_LABEL,
          color: TEXT_MUTED,
          fontSize: 10,
          margin: "0 0 10px",
        }}
      >
        Volume — {vol}%
      </p>
      <input
        type="range"
        min={0}
        max={100}
        value={vol}
        onChange={(e) => setVol(Number(e.target.value))}
        style={{ width: "100%", accentColor: ACCENT_ORANGE }}
      />
    </div>
  );
}

function StatsRow({ home }: { home: HomeSummaryResponse }) {
  const todayCaption = formatDelta(home.today.delta_minutes_vs_yesterday);
  const weekCaption = home.week.last_completed_day_label || null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <StatCard
        label="Today's Session"
        value={`${home.today.minutes} min`}
        caption={todayCaption}
        valueColor={ACCENT_ORANGE}
      />
      <StatCard
        label="This Week"
        value={`${home.week.completed} / ${home.week.total}`}
        caption={weekCaption}
        valueColor={ACCENT_TERRA}
      />
    </div>
  );
}

// ── Reconnecting pill ────────────────────────────────────────────────────────
function ReconnectingPill() {
  return (
    <div
      role="status"
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: "rgba(33,42,46,0.9)",
        border: `1px solid ${HAIRLINE}`,
        color: TEXT_MUTED,
        fontFamily: FONT_SANS,
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        zIndex: 5,
      }}
    >
      <LoadingSpinner size="sm" style={{ width: 12, height: 12, borderWidth: 2 }} />
      Reconnecting…
    </div>
  );
}

// ── Account-not-found error ──────────────────────────────────────────────────
function AccountNotFound({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: SCREEN_BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        color: TEXT_PRIMARY,
        fontFamily: FONT_SERIF,
      }}
    >
      <div style={{ maxWidth: 320, textAlign: "center" }}>
        <p style={{ ...CAPS_LABEL, color: ACCENT_ORANGE }}>Account</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: "8px 0 14px" }}>
          Account not found
        </h2>
        <p style={{ color: TEXT_MUTED, fontFamily: FONT_SANS, fontSize: 14, lineHeight: 1.5, marginBottom: 22 }}>
          We couldn't load this parent or child profile. Please retry, or sign
          out and back in.
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: "12px 28px",
            borderRadius: 10,
            background: ACCENT_ORANGE,
            color: SCREEN_BG,
            border: "none",
            fontFamily: FONT_SERIF,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ parentId, childId, fallbackParentName }: HomeScreenProps) {
  const {
    parent,
    home,
    toy,
    activeSession,
    elapsedSeconds,
    isInitialLoading,
    isAccountNotFound,
    isReconnecting,
    refetchAll,
  } = useHomeData({ parentId, childId });

  const { toast, show: showToast } = useToast();
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeSessionId, setNudgeSessionId] = useState<number | null>(null);

  // Inject shimmer keyframes once on mount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "curie-home-shimmer";
    if (document.getElementById(id)) return;
    const tag = document.createElement("style");
    tag.id = id;
    tag.textContent = `@keyframes curie-shimmer {
      0% { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }`;
    document.head.appendChild(tag);
  }, []);

  const handleNudgePressed = (sessionId: number) => {
    setNudgeSessionId(sessionId);
    setNudgeOpen(true);
  };

  const showSessionSkeleton = isInitialLoading && !home;
  const showStatsSkeleton = isInitialLoading && !home;

  // Show account-not-found view if either /parents/{id} or /children/{id}/...
  // explicitly returned a 404 (or the child isn't in the parent's children).
  if (isAccountNotFound) {
    return <AccountNotFound onRetry={refetchAll} />;
  }

  return (
    <div
      style={{
        position: "relative",
        background: SCREEN_BG,
        minHeight: "100vh",
        color: TEXT_PRIMARY,
        fontFamily: FONT_SERIF,
        paddingBottom: 110,
      }}
    >
      {isReconnecting ? <ReconnectingPill /> : null}

      <HomeHeader parent={parent} fallbackParentName={fallbackParentName} />

      <div
        style={{
          padding: "18px 22px 0",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Block 2: active session card / empty state */}
        {showSessionSkeleton ? (
          <ActiveSessionSkeleton />
        ) : activeSession ? (
          <ActiveSessionCardView
            toy={toy}
            session={activeSession}
            elapsedSeconds={elapsedSeconds}
            onNudgePressed={handleNudgePressed}
          />
        ) : (
          <NoActiveSessionCard toy={toy} />
        )}

        {/* Block 3: stat cards */}
        {showStatsSkeleton ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : home ? (
          <StatsRow home={home} />
        ) : null}

        {/* Restored extras (from previous Home/TabDashboard) */}
        <LatestSessionDetailCard childId={childId} />
        <AiInsightsCard childId={childId} />
        {/* <QuickControlsCard /> */}
      </div>

      {nudgeOpen && nudgeSessionId != null && childId != null ? (
        <NudgeTopicModal
          childId={childId}
          sessionId={nudgeSessionId}
          onClose={() => {
            setNudgeOpen(false);
            setNudgeSessionId(null);
          }}
          onSent={(label, message) => showToast(message || `Nudged to ${label}`)}
        />
      ) : null}

      <Toast state={toast} />
    </div>
  );
}

/** Optional: pick a child for parents who haven't selected one yet. */
export function pickDefaultChildId(
  candidates: { id: number }[],
  preferred: number | null | undefined,
): number | null {
  if (preferred != null && candidates.some((c) => c.id === preferred)) return preferred;
  return candidates[0]?.id ?? null;
}
