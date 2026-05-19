"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { B } from "../lib/brandPalette.js";
import { LoadingSpinner } from "./Loading";
import {
  classifyGenerateError,
  isActivateConflict,
  isChildNotFound,
  useActivateCurriculumMutation,
  useGenerateCurriculumMutation,
  type ActivateCurriculumResponse,
  type CurriculumDraft,
  type GenerateBlockerInfo,
  type GenerateCurriculumResponse,
} from "../lib/api/curriculumGenApi";

// ── Public props ─────────────────────────────────────────────────────────────
export type CurriculumGeneratorProps = {
  childId: number;
  childName?: string;
  /** Default `week_number` to pre-fill in the form. Optional. */
  defaultWeekNumber?: number;
  onClose: () => void;
  /** Called after a successful activation (201). Use to refetch the board. */
  onActivated?: (result: ActivateCurriculumResponse) => void;
  /** Called when the user taps "Go to Profile" from a missing_goals / missing_interests error. */
  onGoToProfile?: () => void;
};

// ── Local state machine ──────────────────────────────────────────────────────
type Phase = "form" | "draft" | "done";

const HUMANIZE_LESSON_TYPE: Record<string, string> = {
  story_and_discussion: "Story & Discussion",
  song_and_movement: "Song & Movement",
  drama_and_role_play: "Drama & Role Play",
  science_exploration: "Science Exploration",
  mathematics: "Mathematics",
  creative_arts: "Creative Arts",
  reflection: "Reflection",
};

function humanizeLessonType(value: string): string {
  if (HUMANIZE_LESSON_TYPE[value]) return HUMANIZE_LESSON_TYPE[value];
  return value
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CurriculumGenerator({
  childId,
  childName,
  defaultWeekNumber,
  onClose,
  onActivated,
  onGoToProfile,
}: CurriculumGeneratorProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [durationDays, setDurationDays] = useState<number>(7);
  const [weekNumber, setWeekNumber] = useState<number | null>(
    defaultWeekNumber != null ? defaultWeekNumber : null,
  );
  const [draftEnvelope, setDraftEnvelope] = useState<GenerateCurriculumResponse | null>(null);
  const [activated, setActivated] = useState<ActivateCurriculumResponse | null>(null);

  const [generate, generateState] = useGenerateCurriculumMutation();
  const [activate, activateState] = useActivateCurriculumMutation();

  const generateBlocker: GenerateBlockerInfo | null = useMemo(
    () => (generateState.error ? classifyGenerateError(generateState.error) : null),
    [generateState.error],
  );
  const generateChildMissing = isChildNotFound(generateState.error);
  const activateConflict = isActivateConflict(activateState.error);
  const activateChildMissing = isChildNotFound(activateState.error);

  const draft: CurriculumDraft | null = draftEnvelope?.draft ?? null;

  const runGenerate = async () => {
    const body: { duration_days?: number; week_number?: number } = {};
    if (Number.isFinite(durationDays) && durationDays > 0) body.duration_days = durationDays;
    if (weekNumber != null && Number.isFinite(weekNumber) && weekNumber > 0) {
      body.week_number = weekNumber;
    }
    try {
      const result = await generate({ childId, body }).unwrap();
      setDraftEnvelope(result);
      setPhase("draft");
    } catch {
      // Error rendered inline via generateState.error
    }
  };

  const runActivate = async () => {
    if (!draft) return;
    try {
      const result = await activate({ childId, draft }).unwrap();
      setActivated(result);
      setPhase("done");
      onActivated?.(result);
    } catch {
      // Error rendered inline via activateState.error
    }
  };

  const regenerate = async () => {
    setDraftEnvelope(null);
    // Reset both error states so the regenerate-after-conflict path is clean.
    activateState.reset?.();
    generateState.reset?.();
    setPhase("form");
    // Trigger immediately with the same params.
    await runGenerate();
  };

  return (
    <Sheet onClose={onClose} title="Generate Curriculum" subtitle={childName ? `For ${childName}` : undefined}>
      {phase === "form" && (
        <FormPhase
          durationDays={durationDays}
          onDurationChange={setDurationDays}
          weekNumber={weekNumber}
          onWeekChange={setWeekNumber}
          onSubmit={runGenerate}
          isLoading={generateState.isLoading}
          blocker={generateBlocker}
          childMissing={generateChildMissing}
          onGoToProfile={onGoToProfile}
        />
      )}

      {phase === "draft" && draft && (
        <DraftPhase
          draft={draft}
          onActivate={runActivate}
          onRegenerate={regenerate}
          onCancel={onClose}
          isActivating={activateState.isLoading}
          isRegenerating={generateState.isLoading}
          conflict={activateConflict}
          childMissing={activateChildMissing}
          unknownError={
            activateState.error && !activateConflict && !activateChildMissing
              ? (classifyGenerateError(activateState.error)?.message ??
                  "Could not activate the curriculum. Please try again.")
              : null
          }
        />
      )}

      {phase === "done" && activated && (
        <DonePhase activated={activated} onClose={onClose} />
      )}
    </Sheet>
  );
}

// ── Sheet shell ──────────────────────────────────────────────────────────────
function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(63,77,81,0.85)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 999,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          width: "100%",
          background: B.bgDeep,
          borderRadius: "22px 22px 0 0",
          padding: "24px 22px 44px",
          maxHeight: "90vh",
          overflowY: "auto",
          border: `1px solid ${B.creamLow}`,
          borderBottom: "none",
          maxWidth: 430,
          margin: "0 auto",
        }}
      >
        <div style={{ width: 40, height: 4, background: B.creamLow, borderRadius: 99, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <p
              style={{
                color: B.gold,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                margin: 0,
                fontFamily: "Georgia, serif",
              }}
            >
              Curriculum
            </p>
            <p
              style={{
                color: B.cream,
                fontSize: 20,
                fontWeight: 700,
                margin: "4px 0 0",
                fontFamily: "Georgia, serif",
              }}
            >
              {title}
            </p>
            {subtitle && (
              <p style={{ color: B.creamMid, fontSize: 12, marginTop: 4 }}>{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: B.creamMid,
              fontSize: 22,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Phase: form ──────────────────────────────────────────────────────────────
function FormPhase({
  durationDays,
  onDurationChange,
  weekNumber,
  onWeekChange,
  onSubmit,
  isLoading,
  blocker,
  childMissing,
  onGoToProfile,
}: {
  durationDays: number;
  onDurationChange: (v: number) => void;
  weekNumber: number | null;
  onWeekChange: (v: number | null) => void;
  onSubmit: () => void;
  isLoading: boolean;
  blocker: GenerateBlockerInfo | null;
  childMissing: boolean;
  onGoToProfile?: () => void;
}) {
  return (
    <div>
      <p style={{ color: B.creamMid, fontSize: 13, lineHeight: 1.55, marginBottom: 18 }}>
        Curi will draft a 7-day plan from your child's goals and interests. You'll see
        a preview before anything is saved.
      </p>

      <FieldRow label="Duration (days)">
        <input
          type="number"
          min={1}
          max={31}
          value={durationDays}
          onChange={(e) => onDurationChange(Number(e.target.value) || 7)}
          style={fieldStyle}
        />
      </FieldRow>

      <FieldRow label="Week number (optional)" hint="Leave blank to use the next available week.">
        <input
          type="number"
          min={1}
          value={weekNumber ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onWeekChange(raw === "" ? null : Number(raw));
          }}
          placeholder="auto"
          style={fieldStyle}
        />
      </FieldRow>

      <ErrorBlock
        childMissing={childMissing}
        blocker={blocker}
        defaultMessage="Could not generate a curriculum. Please try again."
        onGoToProfile={onGoToProfile}
      />

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || childMissing}
        style={{
          ...primaryButtonStyle,
          background: isLoading || childMissing ? B.creamFade : B.gold,
          color: isLoading || childMissing ? B.creamMid : B.dark,
          cursor: isLoading || childMissing ? "default" : "pointer",
          marginTop: 6,
        }}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" />
            <span>Drafting…</span>
          </>
        ) : (
          "✦ Generate Draft"
        )}
      </button>
    </div>
  );
}

// ── Phase: draft preview ─────────────────────────────────────────────────────
function DraftPhase({
  draft,
  onActivate,
  onRegenerate,
  onCancel,
  isActivating,
  isRegenerating,
  conflict,
  childMissing,
  unknownError,
}: {
  draft: CurriculumDraft;
  onActivate: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
  isActivating: boolean;
  isRegenerating: boolean;
  conflict: boolean;
  childMissing: boolean;
  unknownError: string | null;
}) {
  return (
    <div>
      <div
        style={{
          background: B.goldFade,
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
          border: "1px solid rgba(201,139,44,0.25)",
        }}
      >
        <p
          style={{
            color: B.gold,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            margin: 0,
            fontFamily: "Georgia, serif",
          }}
        >
          Theme
        </p>
        <p
          style={{
            color: B.cream,
            fontSize: 19,
            fontWeight: 700,
            margin: "4px 0 8px",
            fontFamily: "Georgia, serif",
          }}
        >
          {draft.title}
        </p>
        <p style={{ color: B.creamMid, fontSize: 13, lineHeight: 1.6, margin: 0 }}>{draft.description}</p>
        <p
          style={{
            color: B.creamMid,
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginTop: 12,
          }}
        >
          Week {draft.week_number} · {draft.duration_days} days · {draft.lessons.length} lessons
        </p>
      </div>

      <p
        style={{
          color: B.gold,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          margin: "0 0 10px",
          fontFamily: "Georgia, serif",
        }}
      >
        Lesson Preview
      </p>
      <div style={{ marginBottom: 18 }}>
        {[...draft.lessons]
          .sort((a, b) => a.day_number - b.day_number)
          .map((lesson) => (
            <div
              key={lesson.day_number}
              style={{
                background: B.creamFade,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                border: `1px solid ${B.creamLow}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <p
                  style={{
                    color: B.cream,
                    fontSize: 14,
                    fontWeight: 700,
                    margin: 0,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  Day {lesson.day_number}
                </p>
                <p style={{ color: B.gold, fontSize: 11, fontFamily: "Georgia, serif" }}>
                  {humanizeLessonType(lesson.lesson_type)}
                </p>
              </div>
              <p
                style={{
                  color: B.creamMid,
                  fontSize: 13,
                  lineHeight: 1.5,
                  margin: "0 0 8px",
                }}
              >
                {lesson.learning_goals?.title ?? "Untitled lesson"}
              </p>
              {lesson.vocabulary?.length ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {lesson.vocabulary.slice(0, 6).map((v) => (
                    <span
                      key={v}
                      style={{
                        fontSize: 11,
                        padding: "3px 8px",
                        borderRadius: 99,
                        background: "rgba(201,139,44,0.12)",
                        color: B.gold,
                        border: "1px solid rgba(201,139,44,0.2)",
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
      </div>

      {conflict && (
        <InfoBanner
          tone="warn"
          title="Theme key collision"
          body="Another curriculum just used this draft's key. Regenerate to get a fresh one, then activate."
        />
      )}
      {childMissing && (
        <InfoBanner tone="error" title="Child not found" body="This child profile no longer exists." />
      )}
      {unknownError && (
        <InfoBanner tone="error" title="Activation failed" body={unknownError} />
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isActivating || isRegenerating}
          style={{
            ...secondaryButtonStyle,
            flex: 1,
            cursor: isActivating || isRegenerating ? "default" : "pointer",
          }}
        >
          {isRegenerating ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Redrafting…</span>
            </>
          ) : (
            "Regenerate"
          )}
        </button>
        <button
          type="button"
          onClick={onActivate}
          disabled={isActivating || isRegenerating}
          style={{
            ...primaryButtonStyle,
            flex: 1,
            background: isActivating || isRegenerating ? B.creamFade : B.terra,
            color: isActivating || isRegenerating ? B.creamMid : B.cream,
            cursor: isActivating || isRegenerating ? "default" : "pointer",
          }}
        >
          {isActivating ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Activating…</span>
            </>
          ) : (
            "✦ Activate"
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={isActivating || isRegenerating}
        style={{
          ...ghostButtonStyle,
          width: "100%",
          marginTop: 10,
          cursor: isActivating || isRegenerating ? "default" : "pointer",
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// ── Phase: done ──────────────────────────────────────────────────────────────
function DonePhase({
  activated,
  onClose,
}: {
  activated: ActivateCurriculumResponse;
  onClose: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "16px 0 6px" }}>
      <div style={{ fontSize: 44, color: B.gold, marginBottom: 12 }}>✦</div>
      <p
        style={{
          color: B.gold,
          fontSize: 20,
          fontWeight: 700,
          margin: 0,
          fontFamily: "Georgia, serif",
        }}
      >
        Curriculum activated
      </p>
      <p style={{ color: B.creamMid, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
        {activated.theme.title} · {activated.lessons.length} lessons synced. Curious Buddy
        will start using this plan on the next session.
      </p>
      <button
        type="button"
        onClick={onClose}
        style={{
          ...primaryButtonStyle,
          background: B.gold,
          color: B.dark,
          cursor: "pointer",
          marginTop: 22,
          width: "100%",
        }}
      >
        Done
      </button>
    </div>
  );
}

// ── Reusable bits ────────────────────────────────────────────────────────────
function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p
        style={{
          color: B.creamMid,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          margin: "0 0 6px",
        }}
      >
        {label}
      </p>
      {children}
      {hint && (
        <p style={{ color: B.creamMid, fontSize: 11, marginTop: 4, lineHeight: 1.45 }}>{hint}</p>
      )}
    </div>
  );
}

function ErrorBlock({
  childMissing,
  blocker,
  defaultMessage,
  onGoToProfile,
}: {
  childMissing: boolean;
  blocker: GenerateBlockerInfo | null;
  defaultMessage: string;
  onGoToProfile?: () => void;
}) {
  if (childMissing) {
    return (
      <InfoBanner
        tone="error"
        title="Child not found"
        body="This child profile no longer exists. Switch profile to continue."
      />
    );
  }
  if (!blocker) return null;
  switch (blocker.kind) {
    case "missing_goals":
      return (
        <InfoBanner
          tone="warn"
          title="Learning goals not set"
          body="Curi needs at least one EYFS learning goal before it can draft a plan."
          action={onGoToProfile ? { label: "Set Goals in Profile →", onPress: onGoToProfile } : undefined}
        />
      );
    case "missing_interests":
      return (
        <InfoBanner
          tone="warn"
          title="Interests not set"
          body="Curi needs your child's interests (e.g. dinosaurs, space) to personalise the theme."
          action={onGoToProfile ? { label: "Add Interests in Profile →", onPress: onGoToProfile } : undefined}
        />
      );
    case "validation_failed":
      return (
        <InfoBanner
          tone="error"
          title="Draft validation failed"
          body={`The generator returned an invalid lesson${
            blocker.validationDay ? ` on day ${blocker.validationDay}` : ""
          }. Tap Generate Draft again — this is usually transient.`}
        />
      );
    default:
      return <InfoBanner tone="error" title="Generation failed" body={blocker.message || defaultMessage} />;
  }
}

function InfoBanner({
  tone,
  title,
  body,
  action,
}: {
  tone: "warn" | "error";
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const color = tone === "warn" ? B.gold : B.terra;
  const bg = tone === "warn" ? "rgba(201,139,44,0.12)" : "rgba(191,95,73,0.14)";
  const border = tone === "warn" ? "rgba(201,139,44,0.32)" : "rgba(191,95,73,0.32)";
  return (
    <div
      role="alert"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 14,
      }}
    >
      <p
        style={{
          color,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          margin: "0 0 4px",
          fontFamily: "Georgia, serif",
        }}
      >
        {title}
      </p>
      <p style={{ color: B.creamMid, fontSize: 13, lineHeight: 1.55, margin: "0 0 10px" }}>{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onPress}
          style={{
            background: color,
            color: tone === "warn" ? B.dark : B.cream,
            border: "none",
            borderRadius: 10,
            padding: "9px 14px",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "Georgia, serif",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 11,
  background: B.bgDeep,
  color: B.cream,
  border: `1px solid ${B.creamLow}`,
  fontSize: 14,
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: 12,
  border: "none",
  fontWeight: 700,
  fontFamily: "Georgia, serif",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  letterSpacing: "0.01em",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "13px 16px",
  borderRadius: 12,
  background: B.creamFade,
  color: B.cream,
  border: `1px solid ${B.creamLow}`,
  fontWeight: 700,
  fontFamily: "Georgia, serif",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const ghostButtonStyle: CSSProperties = {
  padding: "11px 16px",
  borderRadius: 12,
  background: "transparent",
  color: B.creamMid,
  border: `1px solid ${B.creamLow}`,
  fontWeight: 600,
  fontFamily: "Georgia, serif",
  fontSize: 13,
};
