"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { B } from "../lib/brandPalette.js";
import Loading, { LoadingSpinner } from "./Loading.tsx";
import {
  parseApiError,
  useCreateLessonLessonsPostMutation,
  useCreateThemeThemesPostMutation,
  useGetLessonsByThemeThemesThemeIdLessonsGetQuery,
  useGetThemesThemesGetQuery,
  usePreviewLessonLessonsLessonIdPreviewGetQuery,
  useUpdateLessonLessonsLessonIdPutMutation,
  useUpdateThemeThemesThemeIdPutMutation,
} from "../lib/api/curriculumService";

const LESSON_TYPE_OPTIONS = [
  "story_and_discussion",
  "song_and_movement",
  "drama_and_role_play",
  "science_exploration",
  "mathematics",
];

const LESSON_TYPE_META = {
  story_and_discussion:  { icon: "📖", label: "Story & Discussion" },
  song_and_movement:     { icon: "🎵", label: "Song & Movement" },
  drama_and_role_play:   { icon: "🎭", label: "Drama & Role Play" },
  science_exploration:   { icon: "🔬", label: "Science Exploration" },
  mathematics:           { icon: "🔢", label: "Mathematics" },
};

function lessonMeta(type) {
  return LESSON_TYPE_META[type] || { icon: "📝", label: (type || "").replace(/_/g, " ") };
}

/** Split vocabulary field into words only when validating/submitting. */
function parseVocabularyInput(text) {
  return String(text || "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function deepMerge(target, source) {
  if (source == null || typeof source !== "object" || Array.isArray(source)) return target;
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const k of Object.keys(source)) {
    const sv = source[k];
    const tv = target[k];
    if (sv && typeof sv === "object" && !Array.isArray(sv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
      out[k] = deepMerge(tv, sv);
    } else {
      out[k] = sv;
    }
  }
  return out;
}

export function buildEmptyLessonCreate(themeId, dayNumber = 1) {
  return {
    theme_id: themeId,
    day_number: Math.min(14, Math.max(1, dayNumber)),
    lesson_type: LESSON_TYPE_OPTIONS[0],
    vocabulary: ["explore", "imagine", "describe"],
    learning_goals: {
      title: "",
      subject_lens: "",
      eyfs_focus: [],
      lesson_key: "",
      content_json: {
        ai_action: "",
        activity_narrative: "",
        lesson_key: "",
        vocabulary: [],
        learning_goals: [""],
        seven_step_structure: {
          step_1_hook: "",
          step_2_core_activity: "",
          step_3_do: "",
          step_4_socratic: {
            opening_question: "",
            age_profiles: {
              age_3: { expected_action: "", guiding_question: "", extension_question: "", educational_goal: "" },
              age_6: { expected_action: "", guiding_question: "", extension_question: "", educational_goal: "" },
            },
          },
          step_5_extension: "",
          step_6_reflection: "",
        },
      },
    },
  };
}

function normalizeLessonFromApi(lesson) {
  const base = buildEmptyLessonCreate(lesson.theme_id, lesson.day_number);
  const lg = typeof lesson.learning_goals === "object" && lesson.learning_goals !== null ? lesson.learning_goals : {};
  const merged = deepMerge(base.learning_goals, lg);
  return {
    theme_id: lesson.theme_id,
    day_number: lesson.day_number,
    lesson_type: lesson.lesson_type || base.lesson_type,
    vocabulary: Array.isArray(lesson.vocabulary) && lesson.vocabulary.length ? [...lesson.vocabulary] : [...base.vocabulary],
    learning_goals: merged,
  };
}

// ── Shared primitives ──────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p style={{ color: B.gold, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, fontFamily: "Georgia, serif" }}>
      {children}
    </p>
  );
}

const inputStyle = (full) => ({
  width: full ? "100%" : undefined,
  flex: full ? undefined : 1,
  minWidth: 0,
  padding: "12px 14px",
  borderRadius: 12,
  background: B.bgDeep,
  color: B.cream,
  border: `1px solid ${B.creamLow}`,
  marginBottom: 10,
  fontSize: 14,
  boxSizing: "border-box",
});

function FieldLabel({ children, required }) {
  return (
    <label style={{ color: B.creamMid, fontSize: 12, display: "block", marginBottom: 5, fontWeight: 500 }}>
      {children}{required && <span style={{ color: B.terra, marginLeft: 3 }}>*</span>}
    </label>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <p style={{ color: B.terra, fontSize: 11, marginTop: -6, marginBottom: 8 }}>{children}</p>;
}

function Toast({ message, tone }) {
  if (!message) return null;
  const bg = tone === "err" ? "rgba(191,95,73,0.25)" : B.goldFade;
  const fg = tone === "err" ? B.terra : B.gold;
  return (
    <div style={{
      position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)",
      maxWidth: "calc(100% - 40px)", zIndex: 10000, padding: "11px 18px", borderRadius: 14,
      background: bg, border: `1px solid ${B.creamLow}`, color: fg, fontSize: 13,
      lineHeight: 1.45, boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
    }}>
      {message}
    </div>
  );
}

function PrimaryButton({ onClick, disabled, children, color }) {
  const bg = disabled ? B.creamFade : (color || B.gold);
  const fg = disabled ? B.creamMid : (color === B.terra ? B.cream : B.dark);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: 15, borderRadius: 14, background: bg, color: fg,
        border: "none", fontWeight: 700, fontSize: 15, cursor: disabled ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </button>
  );
}

// ── Preview Modal ──────────────────────────────────────────────────────────────

function PreviewModal({ lessonId, lessonLabel, onClose }) {
  const { data, isFetching, isError, error } = usePreviewLessonLessonsLessonIdPreviewGetQuery(
    lessonId ? { lessonId } : skipToken,
  );
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(63,77,81,0.88)", zIndex: 9999, display: "flex", alignItems: "flex-end", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxHeight: "85vh", overflowY: "auto", background: B.bgDeep, borderRadius: "22px 22px 0 0", padding: "22px 20px 40px", border: `1px solid ${B.creamLow}`, borderBottom: "none" }}
      >
        <div style={{ width: 40, height: 4, background: B.creamLow, borderRadius: 99, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: B.goldFade, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
            👁
          </div>
          <div>
            <p style={{ color: B.cream, fontWeight: 700, fontSize: 16 }}>{lessonLabel || "Lesson Preview"}</p>
            <p style={{ color: B.creamMid, fontSize: 11, marginTop: 2 }}>What the AI uses to guide this session</p>
          </div>
        </div>

        {isFetching ? <Loading variant="inline" size="sm" message="Loading preview…" /> : null}
        {isError && <p style={{ color: B.terra, fontSize: 13 }}>{parseApiError(error)}</p>}
        {data && (
          <>
            {data.structural_warnings?.length ? (
              <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: B.terraFade, border: `1px solid ${B.creamLow}` }}>
                <p style={{ color: B.terra, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>⚠ Warnings</p>
                {data.structural_warnings.map((w, i) => (
                  <p key={i} style={{ color: B.terra, fontSize: 12, marginBottom: 4 }}>• {w}</p>
                ))}
              </div>
            ) : null}
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", color: B.creamMid, fontSize: 12, lineHeight: 1.6, margin: 0, fontFamily: "system-ui, sans-serif" }}>
              {data.rendered_system_prompt}
            </pre>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{ width: "100%", marginTop: 24, padding: 14, borderRadius: 14, background: B.creamFade, color: B.cream, border: `1px solid ${B.creamLow}`, cursor: "pointer", fontWeight: 600, fontSize: 15 }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Theme Form ─────────────────────────────────────────────────────────────────

function ThemeFormPanel({ mode, initial, onBack, onSaved }) {
  const [createTheme, { isLoading: creating }] = useCreateThemeThemesPostMutation();
  const [updateTheme, { isLoading: updating }] = useUpdateThemeThemesThemeIdPutMutation();
  const [themeKey, setThemeKey] = useState(initial?.theme_key || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [weekNumber, setWeekNumber] = useState(String(initial?.week_number ?? 1));
  const [durationDays, setDurationDays] = useState(String(initial?.duration_days ?? 7));
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitErr, setSubmitErr] = useState("");

  const validate = () => {
    const e = {};
    const wk = Number(weekNumber);
    const dd = Number(durationDays);
    if (mode === "create") {
      if (!/^[a-z0-9_-]{2,80}$/.test(themeKey.trim())) e.theme_key = "Use 2–80 chars: lowercase letters, digits, _ or -.";
    }
    if (title.trim().length < 3 || title.length > 120) e.title = "Title must be 3–120 characters.";
    if (!Number.isFinite(wk) || wk < 1 || wk > 520) e.week_number = "Week must be 1–520.";
    if (!Number.isFinite(dd) || dd < 1 || dd > 14) e.duration_days = "Duration must be 1–14 days.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setSubmitErr("");
    if (!validate()) return;
    try {
      if (mode === "create") {
        await createTheme({ themeCreateSchema: { theme_key: themeKey.trim(), title: title.trim(), week_number: Number(weekNumber), duration_days: Number(durationDays) } }).unwrap();
      } else if (initial?.id) {
        await updateTheme({ themeId: initial.id, themeUpdateSchema: { title: title.trim(), week_number: Number(weekNumber), duration_days: Number(durationDays) } }).unwrap();
      }
      onSaved();
    } catch (err) {
      setSubmitErr(parseApiError(err));
    }
  };

  const busy = creating || updating;

  return (
    <div style={{ paddingBottom: 32 }}>
      <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: B.gold, fontSize: 14, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        ← Back
      </button>

      <div style={{ background: B.bgDeep, borderRadius: 18, padding: 20, marginBottom: 24, border: `1px solid ${B.creamLow}` }}>
        <SectionLabel>{mode === "create" ? "New theme" : "Edit theme"}</SectionLabel>

        {mode === "create" && (
          <>
            <FieldLabel>Theme key (internal ID)</FieldLabel>
            <input value={themeKey} onChange={(e) => setThemeKey(e.target.value)} placeholder="e.g. under_the_sea" style={inputStyle(true)} />
            <FieldError>{fieldErrors.theme_key}</FieldError>
          </>
        )}

        <FieldLabel required>Theme title</FieldLabel>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Under the Sea" style={inputStyle(true)} />
        <FieldError>{fieldErrors.title}</FieldError>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel>Week number</FieldLabel>
            <input value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} inputMode="numeric" style={inputStyle(true)} />
            <FieldError>{fieldErrors.week_number}</FieldError>
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel>Duration (days)</FieldLabel>
            <input value={durationDays} onChange={(e) => setDurationDays(e.target.value)} inputMode="numeric" style={inputStyle(true)} />
            <FieldError>{fieldErrors.duration_days}</FieldError>
          </div>
        </div>
      </div>

      {submitErr && <p style={{ color: B.terra, fontSize: 13, marginBottom: 14, padding: "10px 14px", background: B.terraFade, borderRadius: 10 }}>{submitErr}</p>}

      <PrimaryButton onClick={submit} disabled={busy}>
        {busy ? <><LoadingSpinner size="sm" /><span>Saving…</span></> : mode === "create" ? "Create Theme" : "Save Changes"}
      </PrimaryButton>
    </div>
  );
}

// ── Lesson Form ────────────────────────────────────────────────────────────────

function LessonFormPanel({ mode, themeId, initialLesson, onBack, onSaved }) {
  const [createLesson, { isLoading: creating }] = useCreateLessonLessonsPostMutation();
  const [updateLesson, { isLoading: updating }] = useUpdateLessonLessonsLessonIdPutMutation();
  const [form, setForm] = useState(() =>
    mode === "edit" && initialLesson ? normalizeLessonFromApi(initialLesson) : buildEmptyLessonCreate(themeId, 1),
  );
  const [vocabText, setVocabText] = useState(() => {
    const init = mode === "edit" && initialLesson ? normalizeLessonFromApi(initialLesson) : buildEmptyLessonCreate(themeId, 1);
    return init.vocabulary.join(", ");
  });
  const [submitErr, setSubmitErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [openSection, setOpenSection] = useState("basics");

  useEffect(() => {
    const next = mode === "edit" && initialLesson ? normalizeLessonFromApi(initialLesson) : buildEmptyLessonCreate(themeId, 1);
    setForm(next);
    setVocabText(next.vocabulary.join(", "));
  }, [mode, initialLesson?.id, themeId]);

  const setPath = useCallback((path, value) => {
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let cur = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        const k = path[i];
        cur[k] = cur[k] || {};
        cur = cur[k];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  }, []);

  const validate = () => {
    const e = {};
    const voc = parseVocabularyInput(vocabText);
    const uniq = [...new Set(voc.map((w) => String(w).trim().toLowerCase()).filter(Boolean))];
    if (uniq.length < 3 || uniq.length > 8) e.vocabulary = "Provide 3–8 unique vocabulary words.";
    const dn = Number(form.day_number);
    if (!Number.isFinite(dn) || dn < 1 || dn > 14) e.day_number = "Day number must be 1–14.";
    if (!String(form.learning_goals?.title || "").trim()) e.title = "Learning goals title is required.";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const syncVocabIntoContent = (body) => {
    const copy = JSON.parse(JSON.stringify(body));
    copy.learning_goals = copy.learning_goals || {};
    copy.learning_goals.content_json = copy.learning_goals.content_json || {};
    copy.learning_goals.content_json.vocabulary = [...copy.vocabulary];
    return copy;
  };

  const submit = async () => {
    setSubmitErr("");
    if (!validate()) return;
    try {
      const vocabWords = parseVocabularyInput(vocabText);
      const synced = syncVocabIntoContent({ ...form, vocabulary: vocabWords });
      if (mode === "create") {
        await createLesson({ lessonCreateSchema: synced }).unwrap();
      } else if (initialLesson?.id) {
        await updateLesson({ lessonId: initialLesson.id, lessonUpdateSchema: { day_number: synced.day_number, lesson_type: synced.lesson_type, vocabulary: synced.vocabulary, learning_goals: synced.learning_goals } }).unwrap();
      }
      onSaved();
    } catch (err) {
      setSubmitErr(parseApiError(err));
    }
  };

  const busy = creating || updating;
  const lg = form.learning_goals || {};
  const cj = lg.content_json || {};
  const ss = cj.seven_step_structure || {};
  const socratic = ss.step_4_socratic || { opening_question: "", age_profiles: { age_3: {} } };
  const age3 = (socratic.age_profiles && socratic.age_profiles.age_3) || {};
  const age6 = (socratic.age_profiles && socratic.age_profiles.age_6) || {};

  const meta = lessonMeta(form.lesson_type);

  const Section = ({ id, title, children }) => {
    const open = openSection === id;
    return (
      <div style={{ marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setOpenSection(open ? null : id)}
          style={{ width: "100%", background: open ? B.goldFade : B.creamFade, border: `1px solid ${open ? B.gold : B.creamLow}`, borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: open ? B.gold : B.creamMid, fontWeight: 600, fontSize: 13, marginBottom: open ? 12 : 0 }}
        >
          <span>{title}</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div style={{ background: B.bgDeep, borderRadius: "0 0 12px 12px", padding: "14px 16px", border: `1px solid ${B.creamLow}`, borderTop: "none" }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: 32 }}>
      <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: B.gold, fontSize: 14, cursor: "pointer", marginBottom: 20 }}>
        ← Back
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: B.goldFade, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: `1px solid ${B.creamLow}` }}>
          {meta.icon}
        </div>
        <div>
          <p style={{ color: B.cream, fontWeight: 700, fontSize: 17 }}>{mode === "create" ? "Add a lesson" : `Edit lesson`}</p>
          <p style={{ color: B.creamMid, fontSize: 12, marginTop: 2 }}>{mode === "create" ? "Fill in the details below" : `Day ${form.day_number} · ${meta.label}`}</p>
        </div>
      </div>

      <Section id="basics" title="📋 Basics">
        <FieldLabel>Day number (1–14)</FieldLabel>
        <input type="number" min={1} max={14} value={form.day_number} onChange={(e) => setForm((p) => ({ ...p, day_number: Number(e.target.value) }))} style={inputStyle(true)} />
        <FieldError>{fieldErrors.day_number}</FieldError>

        <FieldLabel>Lesson type</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          {LESSON_TYPE_OPTIONS.map((t) => {
            const m = lessonMeta(t);
            const active = form.lesson_type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setForm((p) => ({ ...p, lesson_type: t }))}
                style={{ padding: "10px 8px", borderRadius: 12, background: active ? B.goldFade : B.creamFade, border: `1px solid ${active ? B.gold : B.creamLow}`, color: active ? B.gold : B.creamMid, cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
              >
                <span style={{ fontSize: 20 }}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <FieldLabel>Vocabulary words (3–8, comma-separated)</FieldLabel>
        <input value={vocabText} onChange={(e) => setVocabText(e.target.value)} placeholder="e.g. ocean, whale, wave" style={inputStyle(true)} />
        <FieldError>{fieldErrors.vocabulary}</FieldError>
      </Section>

      <Section id="goals" title="🎯 Learning Goals">
        <FieldLabel required>Goals title</FieldLabel>
        <input value={lg.title || ""} onChange={(e) => setPath(["learning_goals", "title"], e.target.value)} style={inputStyle(true)} />
        <FieldError>{fieldErrors.title}</FieldError>

        <FieldLabel>Subject lens</FieldLabel>
        <input value={lg.subject_lens || ""} onChange={(e) => setPath(["learning_goals", "subject_lens"], e.target.value)} style={inputStyle(true)} />

        <FieldLabel>Learning goals (one per line)</FieldLabel>
        <textarea
          value={Array.isArray(cj.learning_goals) ? cj.learning_goals.join("\n") : ""}
          onChange={(e) => setPath(["learning_goals", "content_json", "learning_goals"], e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          rows={4}
          style={{ ...inputStyle(true), minHeight: 88, resize: "vertical" }}
        />
      </Section>

      <Section id="activity" title="🎨 Activity Content">
        <FieldLabel>AI action</FieldLabel>
        <textarea value={cj.ai_action || ""} onChange={(e) => setPath(["learning_goals", "content_json", "ai_action"], e.target.value)} rows={3} style={{ ...inputStyle(true), minHeight: 72, resize: "vertical" }} />
        <FieldLabel>Activity narrative</FieldLabel>
        <textarea value={cj.activity_narrative || ""} onChange={(e) => setPath(["learning_goals", "content_json", "activity_narrative"], e.target.value)} rows={3} style={{ ...inputStyle(true), minHeight: 72, resize: "vertical" }} />
      </Section>

      <Section id="steps" title="🪜 Seven-Step Structure">
        {[
          { key: "step_1_hook", label: "Hook" },
          { key: "step_2_core_activity", label: "Core activity" },
          { key: "step_3_do", label: "Do" },
          { key: "step_5_extension", label: "Extension" },
          { key: "step_6_reflection", label: "Reflection" },
        ].map(({ key, label }) => (
          <div key={key}>
            <FieldLabel>{label}</FieldLabel>
            <textarea value={ss[key] || ""} onChange={(e) => setPath(["learning_goals", "content_json", "seven_step_structure", key], e.target.value)} rows={2} style={{ ...inputStyle(true), minHeight: 56, resize: "vertical" }} />
          </div>
        ))}
        <FieldLabel>Socratic opening question</FieldLabel>
        <input value={socratic.opening_question || ""} onChange={(e) => setPath(["learning_goals", "content_json", "seven_step_structure", "step_4_socratic", "opening_question"], e.target.value)} style={inputStyle(true)} />
      </Section>

      <Section id="ages" title="👶 Age Profiles">
        <p style={{ color: B.creamMid, fontSize: 12, marginBottom: 14 }}>Age 3</p>
        {["expected_action", "guiding_question", "extension_question", "educational_goal"].map((k) => (
          <div key={`a3-${k}`}>
            <FieldLabel>{k.replace(/_/g, " ")}</FieldLabel>
            <textarea value={age3[k] || ""} onChange={(e) => setPath(["learning_goals", "content_json", "seven_step_structure", "step_4_socratic", "age_profiles", "age_3", k], e.target.value)} rows={2} style={{ ...inputStyle(true), minHeight: 48, resize: "vertical" }} />
          </div>
        ))}
        <p style={{ color: B.creamMid, fontSize: 12, marginBottom: 14, marginTop: 8 }}>Age 6 (optional)</p>
        {["expected_action", "guiding_question", "extension_question", "educational_goal"].map((k) => (
          <div key={`a6-${k}`}>
            <FieldLabel>{k.replace(/_/g, " ")}</FieldLabel>
            <textarea value={age6[k] || ""} onChange={(e) => setPath(["learning_goals", "content_json", "seven_step_structure", "step_4_socratic", "age_profiles", "age_6", k], e.target.value)} rows={2} style={{ ...inputStyle(true), minHeight: 48, resize: "vertical" }} />
          </div>
        ))}
      </Section>

      {submitErr && <p style={{ color: B.terra, fontSize: 13, marginBottom: 14, padding: "10px 14px", background: B.terraFade, borderRadius: 10 }}>{submitErr}</p>}

      <PrimaryButton onClick={submit} disabled={busy} color={B.terra}>
        {busy ? <><LoadingSpinner size="sm" /><span>Saving…</span></> : mode === "create" ? "Add Lesson" : "Save Lesson"}
      </PrimaryButton>
    </div>
  );
}

// ── Lesson Card ────────────────────────────────────────────────────────────────

function LessonCard({ lesson, onPreview, onEdit }) {
  const meta = lessonMeta(lesson.lesson_type);
  const vocab = lesson.vocabulary?.slice(0, 5) || [];
  const hasMore = (lesson.vocabulary?.length || 0) > 5;

  return (
    <div
      style={{ background: B.bgDeep, borderRadius: 16, marginBottom: 10, border: `1px solid ${B.creamLow}`, overflow: "hidden" }}
    >
      {/* Main tap area → preview */}
      <button
        type="button"
        onClick={onPreview}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "16px 16px 12px" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: B.goldFade, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, border: `1px solid ${B.creamLow}` }}>
            {meta.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ background: B.goldFade, color: B.gold, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: `1px solid ${B.creamLow}` }}>
                Day {lesson.day_number}
              </span>
            </div>
            <p style={{ color: B.cream, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{meta.label}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {vocab.map((w) => (
                <span key={w} style={{ background: B.creamFade, color: B.creamMid, fontSize: 11, padding: "3px 8px", borderRadius: 20 }}>{w}</span>
              ))}
              {hasMore && <span style={{ color: B.creamMid, fontSize: 11, padding: "3px 0" }}>…</span>}
            </div>
          </div>
          <div style={{ color: B.creamMid, fontSize: 18, flexShrink: 0, marginTop: 4 }}>👁</div>
        </div>
      </button>

      {/* Action bar */}
      <div style={{ display: "flex", borderTop: `1px solid ${B.creamLow}` }}>
        <button
          type="button"
          onClick={onPreview}
          style={{ flex: 1, padding: "11px 8px", background: "none", border: "none", borderRight: `1px solid ${B.creamLow}`, color: B.creamMid, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <span>👁</span> View lesson
        </button>
        <button
          type="button"
          onClick={onEdit}
          style={{ flex: 1, padding: "11px 8px", background: "none", border: "none", color: B.gold, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <span>✏️</span> Edit
        </button>
      </div>
    </div>
  );
}

// ── Add Lesson Prompt Card ─────────────────────────────────────────────────────

function AddLessonCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: "100%", padding: "18px 16px", borderRadius: 16, background: "none", border: `2px dashed ${B.creamLow}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: B.creamMid, fontSize: 14, fontWeight: 500, marginTop: 4 }}
    >
      <span style={{ fontSize: 22, color: B.gold }}>+</span>
      <span>Add a new lesson</span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CurriculumManagement() {
  const { data: themes = [], isFetching: loadingThemes, isError: themesErr, error: themesError } = useGetThemesThemesGetQuery();
  const [sortWeekDesc, setSortWeekDesc] = useState(false);
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState({ view: "list" });
  const [toast, setToast] = useState({ text: "", tone: "ok" });
  const [previewId, setPreviewId] = useState(null);
  const [previewLabel, setPreviewLabel] = useState("");

  const showToast = useCallback((text, tone = "ok") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast({ text: "", tone: "ok" }), 4200);
  }, []);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...themes];
    if (q) {
      list = list.filter((t) => t.title.toLowerCase().includes(q) || t.theme_key.toLowerCase().includes(q));
    }
    list.sort((a, b) => (sortWeekDesc ? b.week_number - a.week_number : a.week_number - b.week_number));
    return list;
  }, [themes, search, sortWeekDesc]);

  const selectedTheme = useMemo(() => {
    if (panel.view !== "detail" && panel.view !== "lessonNew" && panel.view !== "lessonEdit") return null;
    return themes.find((t) => t.id === panel.themeId) || null;
  }, [panel, themes]);

  const {
    data: lessons = [],
    isFetching: loadingLessons,
    isError: lessonsQueryErr,
    error: lessonsQueryError,
    refetch: refetchLessons,
  } = useGetLessonsByThemeThemesThemeIdLessonsGetQuery(panel.themeId ? { themeId: panel.themeId } : skipToken);

  const sortedLessons = useMemo(() => [...lessons].sort((a, b) => a.day_number - b.day_number), [lessons]);

  const openPreview = (lesson) => {
    const meta = lessonMeta(lesson.lesson_type);
    setPreviewLabel(`Day ${lesson.day_number} · ${meta.label}`);
    setPreviewId(lesson.id);
  };

  // ── Theme form views ──
  if (panel.view === "themeCreate" || panel.view === "themeEdit") {
    return (
      <>
        <Toast message={toast.text} tone={toast.tone} />
        <ThemeFormPanel
          key={panel.view === "themeEdit" ? `theme-edit-${panel.themeId}` : "theme-create"}
          mode={panel.view === "themeCreate" ? "create" : "edit"}
          initial={panel.view === "themeEdit" ? themes.find((t) => t.id === panel.themeId) : null}
          onBack={() => setPanel(panel.view === "themeEdit" ? { view: "detail", themeId: panel.themeId } : { view: "list" })}
          onSaved={() => {
            showToast(panel.view === "themeCreate" ? "Theme created!" : "Theme updated!");
            setPanel(panel.view === "themeCreate" ? { view: "list" } : { view: "detail", themeId: panel.themeId });
          }}
        />
      </>
    );
  }

  // ── Lesson form views ──
  if (panel.view === "lessonNew" || panel.view === "lessonEdit") {
    return (
      <>
        <Toast message={toast.text} tone={toast.tone} />
        <LessonFormPanel
          key={panel.view === "lessonEdit" ? `lesson-edit-${panel.lesson?.id}` : `lesson-new-${panel.themeId}`}
          mode={panel.view === "lessonNew" ? "create" : "edit"}
          themeId={panel.themeId}
          initialLesson={panel.view === "lessonEdit" ? panel.lesson : null}
          onBack={() => setPanel({ view: "detail", themeId: panel.themeId })}
          onSaved={() => {
            showToast("Lesson saved!");
            refetchLessons();
            setPanel({ view: "detail", themeId: panel.themeId });
          }}
        />
      </>
    );
  }

  // ── Theme detail view ──
  if (panel.view === "detail" && panel.themeId) {
    return (
      <>
        <Toast message={toast.text} tone={toast.tone} />
        {previewId ? <PreviewModal lessonId={previewId} lessonLabel={previewLabel} onClose={() => setPreviewId(null)} /> : null}

        <div style={{ paddingBottom: 32 }}>
          <button type="button" onClick={() => setPanel({ view: "list" })} style={{ background: "none", border: "none", color: B.gold, fontSize: 14, cursor: "pointer", marginBottom: 18, display: "flex", alignItems: "center", gap: 6 }}>
            ← All themes
          </button>

          {selectedTheme ? (
            <div style={{ background: B.bgDeep, borderRadius: 18, padding: 20, marginBottom: 20, border: `1px solid ${B.creamLow}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: B.cream, fontSize: 22, fontWeight: 700, marginBottom: 8, fontFamily: "Georgia, serif" }}>{selectedTheme.title}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ background: B.goldFade, color: B.gold, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: `1px solid ${B.creamLow}` }}>
                      Week {selectedTheme.week_number}
                    </span>
                    <span style={{ background: B.creamFade, color: B.creamMid, fontSize: 11, padding: "3px 10px", borderRadius: 20, border: `1px solid ${B.creamLow}` }}>
                      {selectedTheme.duration_days} days
                    </span>
                    <span style={{ background: B.creamFade, color: B.creamMid, fontSize: 11, padding: "3px 10px", borderRadius: 20, border: `1px solid ${B.creamLow}` }}>
                      {sortedLessons.length} {sortedLessons.length === 1 ? "lesson" : "lessons"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPanel({ view: "themeEdit", themeId: selectedTheme.id })}
                  style={{ flexShrink: 0, marginLeft: 12, padding: "8px 14px", borderRadius: 10, background: B.goldFade, color: B.gold, border: `1px solid ${B.creamLow}`, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                >
                  ✏️ Edit
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: B.terra, fontSize: 13, marginBottom: 16 }}>Theme not found.</p>
          )}

          <SectionLabel>Lessons</SectionLabel>

          {loadingLessons ? <Loading variant="inline" size="sm" message="Loading lessons…" /> : null}
          {lessonsQueryErr && (
            <p style={{ color: B.terra, fontSize: 13, marginBottom: 10 }}>
              {parseApiError(lessonsQueryError)} ·{" "}
              <button type="button" style={{ color: B.gold, background: "none", border: "none", cursor: "pointer" }} onClick={() => refetchLessons()}>
                Retry
              </button>
            </p>
          )}

          {!loadingLessons && !sortedLessons.length && (
            <div style={{ padding: "28px 16px", textAlign: "center", background: B.bgDeep, borderRadius: 16, border: `1px solid ${B.creamLow}`, marginBottom: 12 }}>
              <p style={{ fontSize: 32, marginBottom: 10 }}>📚</p>
              <p style={{ color: B.cream, fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No lessons yet</p>
              <p style={{ color: B.creamMid, fontSize: 13, lineHeight: 1.5 }}>Add the first lesson to get this theme started.</p>
            </div>
          )}

          {sortedLessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onPreview={() => openPreview(lesson)}
              onEdit={() => setPanel({ view: "lessonEdit", themeId: panel.themeId, lesson })}
            />
          ))}

          <AddLessonCard onClick={() => setPanel({ view: "lessonNew", themeId: panel.themeId })} />
        </div>
      </>
    );
  }

  // ── Theme list view ──
  return (
    <div style={{ paddingBottom: 32 }}>
      <Toast message={toast.text} tone={toast.tone} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Search themes…"
          style={{ ...inputStyle(true), marginBottom: 0, flex: 1 }}
        />
        <button
          type="button"
          onClick={() => setSortWeekDesc((v) => !v)}
          style={{ flexShrink: 0, padding: "12px 12px", borderRadius: 12, background: B.creamFade, color: B.creamMid, border: `1px solid ${B.creamLow}`, fontSize: 14, cursor: "pointer" }}
          title={sortWeekDesc ? "Sort ascending" : "Sort descending"}
        >
          {sortWeekDesc ? "↑" : "↓"}
        </button>
      </div>

      {loadingThemes ? <Loading variant="inline" size="sm" message="Loading themes…" /> : null}
      {themesErr && <p style={{ color: B.terra, fontSize: 13, marginBottom: 10 }}>{parseApiError(themesError)}</p>}

      {!loadingThemes && !themes.length && (
        <div style={{ padding: "40px 16px", textAlign: "center", background: B.bgDeep, borderRadius: 18, border: `1px solid ${B.creamLow}`, marginBottom: 16 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🗂️</p>
          <p style={{ color: B.cream, fontWeight: 600, fontSize: 16, marginBottom: 8 }}>No themes yet</p>
          <p style={{ color: B.creamMid, fontSize: 13, lineHeight: 1.5 }}>Create your first theme to start building your curriculum.</p>
        </div>
      )}

      {filteredSorted.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setPanel({ view: "detail", themeId: t.id })}
          style={{ width: "100%", textAlign: "left", background: B.bgDeep, borderRadius: 18, padding: "18px 16px", marginBottom: 10, border: `1px solid ${B.creamLow}`, cursor: "pointer" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: B.cream, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{t.title}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ background: B.goldFade, color: B.gold, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, border: `1px solid ${B.creamLow}` }}>
                  Week {t.week_number}
                </span>
                <span style={{ background: B.creamFade, color: B.creamMid, fontSize: 11, padding: "3px 10px", borderRadius: 20, border: `1px solid ${B.creamLow}` }}>
                  {t.duration_days} days
                </span>
              </div>
            </div>
            <span style={{ color: B.creamMid, fontSize: 20, marginLeft: 12 }}>›</span>
          </div>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setPanel({ view: "themeCreate" })}
        style={{ width: "100%", padding: 16, borderRadius: 16, background: B.gold, color: B.dark, fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 6, letterSpacing: "0.01em" }}
      >
        <span style={{ fontSize: 18 }}>+</span> Create New Theme
      </button>
    </div>
  );
}
