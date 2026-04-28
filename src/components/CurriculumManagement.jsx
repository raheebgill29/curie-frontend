"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { B } from "../lib/brandPalette.js";
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

/** Split vocabulary field into words only when validating/submitting (allows commas while typing). */
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
              age_3: {
                expected_action: "",
                guiding_question: "",
                extension_question: "",
                educational_goal: "",
              },
              age_6: {
                expected_action: "",
                guiding_question: "",
                extension_question: "",
                educational_goal: "",
              },
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

function SectionLabel({ children }) {
  return (
    <p
      style={{
        color: B.gold,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 10,
        fontFamily: "Georgia, serif",
      }}
    >
      {children}
    </p>
  );
}

const inputStyle = (full) => ({
  width: full ? "100%" : undefined,
  flex: full ? undefined : 1,
  minWidth: 0,
  padding: "10px 11px",
  borderRadius: 10,
  background: B.bgDeep,
  color: B.cream,
  border: `1px solid ${B.creamLow}`,
  marginBottom: 8,
  fontSize: 14,
});

function Toast({ message, tone }) {
  if (!message) return null;
  const bg = tone === "err" ? "rgba(191,95,73,0.25)" : B.goldFade;
  const fg = tone === "err" ? B.terra : B.gold;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 96,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: "calc(100% - 40px)",
        zIndex: 10000,
        padding: "11px 16px",
        borderRadius: 12,
        background: bg,
        border: `1px solid ${B.creamLow}`,
        color: fg,
        fontSize: 13,
        lineHeight: 1.45,
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
      }}
    >
      {message}
    </div>
  );
}

function PreviewModal({ lessonId, onClose }) {
  const { data, isFetching, isError, error } = usePreviewLessonLessonsLessonIdPreviewGetQuery(
    lessonId ? { lessonId } : skipToken,
  );
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(63,77,81,0.88)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "82vh",
          overflowY: "auto",
          background: B.bgDeep,
          borderRadius: "22px 22px 0 0",
          padding: "22px 20px 36px",
          border: `1px solid ${B.creamLow}`,
          borderBottom: "none",
        }}
      >
        <div style={{ width: 40, height: 4, background: B.creamLow, borderRadius: 99, margin: "0 auto 16px" }} />
        <SectionLabel>Lesson preview</SectionLabel>
        {isFetching && <p style={{ color: B.creamMid, fontSize: 13 }}>Loading preview...</p>}
        {isError && <p style={{ color: B.terra, fontSize: 13 }}>{parseApiError(error)}</p>}
        {data && (
          <>
            <p style={{ color: B.creamMid, fontSize: 11, marginBottom: 8 }}>
              Lesson #{data.lesson_id} · {data.lesson_type}
            </p>
            {data.structural_warnings?.length ? (
              <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: B.terraFade, border: `1px solid ${B.creamLow}` }}>
                {data.structural_warnings.map((w, i) => (
                  <p key={i} style={{ color: B.terra, fontSize: 12, marginBottom: 4 }}>
                    {w}
                  </p>
                ))}
              </div>
            ) : null}
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: B.creamMid,
                fontSize: 12,
                lineHeight: 1.55,
                margin: 0,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {data.rendered_system_prompt}
            </pre>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 18,
            padding: 13,
            borderRadius: 12,
            background: B.creamFade,
            color: B.cream,
            border: `1px solid ${B.creamLow}`,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

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
        await createTheme({
          themeCreateSchema: {
            theme_key: themeKey.trim(),
            title: title.trim(),
            week_number: Number(weekNumber),
            duration_days: Number(durationDays),
          },
        }).unwrap();
      } else if (initial?.id) {
        await updateTheme({
          themeId: initial.id,
          themeUpdateSchema: {
            title: title.trim(),
            week_number: Number(weekNumber),
            duration_days: Number(durationDays),
          },
        }).unwrap();
      }
      onSaved();
    } catch (err) {
      setSubmitErr(parseApiError(err));
    }
  };

  const busy = creating || updating;

  return (
    <div style={{ padding: "0 0 24px" }}>
      <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: B.gold, fontSize: 14, cursor: "pointer", marginBottom: 16 }}>
        ← Back
      </button>
      <SectionLabel>{mode === "create" ? "Create theme" : "Edit theme"}</SectionLabel>
      {mode === "create" && (
        <>
          <label style={{ color: B.creamMid, fontSize: 11, display: "block", marginBottom: 4 }}>theme_key</label>
          <input value={themeKey} onChange={(e) => setThemeKey(e.target.value)} placeholder="e.g. under_the_sea" style={inputStyle(true)} />
          {fieldErrors.theme_key && <p style={{ color: B.terra, fontSize: 11, marginTop: -4, marginBottom: 8 }}>{fieldErrors.theme_key}</p>}
        </>
      )}
      <label style={{ color: B.creamMid, fontSize: 11, display: "block", marginBottom: 4 }}>Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle(true)} />
      {fieldErrors.title && <p style={{ color: B.terra, fontSize: 11 }}>{fieldErrors.title}</p>}
      <label style={{ color: B.creamMid, fontSize: 11, display: "block", marginBottom: 4 }}>Week number (1–520)</label>
      <input value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} inputMode="numeric" style={inputStyle(true)} />
      {fieldErrors.week_number && <p style={{ color: B.terra, fontSize: 11 }}>{fieldErrors.week_number}</p>}
      <label style={{ color: B.creamMid, fontSize: 11, display: "block", marginBottom: 4 }}>Duration (days, 1–14)</label>
      <input value={durationDays} onChange={(e) => setDurationDays(e.target.value)} inputMode="numeric" style={inputStyle(true)} />
      {fieldErrors.duration_days && <p style={{ color: B.terra, fontSize: 11 }}>{fieldErrors.duration_days}</p>}
      {submitErr && <p style={{ color: B.terra, fontSize: 12, marginBottom: 10 }}>{submitErr}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 12,
          background: busy ? B.creamFade : B.gold,
          color: busy ? B.creamMid : B.dark,
          border: "none",
          fontWeight: 700,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Saving..." : mode === "create" ? "Create theme" : "Save changes"}
      </button>
    </div>
  );
}

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
        await updateLesson({
          lessonId: initialLesson.id,
          lessonUpdateSchema: {
            day_number: synced.day_number,
            lesson_type: synced.lesson_type,
            vocabulary: synced.vocabulary,
            learning_goals: synced.learning_goals,
          },
        }).unwrap();
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

  return (
    <div style={{ padding: "0 0 28px" }}>
      <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: B.gold, fontSize: 14, cursor: "pointer", marginBottom: 16 }}>
        ← Back
      </button>
      <SectionLabel>{mode === "create" ? "Create lesson" : `Edit lesson #${initialLesson?.id}`}</SectionLabel>

      <label style={{ color: B.creamMid, fontSize: 11 }}>Day number (1–14)</label>
      <input
        type="number"
        min={1}
        max={14}
        value={form.day_number}
        onChange={(e) => setForm((p) => ({ ...p, day_number: Number(e.target.value) }))}
        style={inputStyle(true)}
      />
      {fieldErrors.day_number && <p style={{ color: B.terra, fontSize: 11 }}>{fieldErrors.day_number}</p>}

      <label style={{ color: B.creamMid, fontSize: 11 }}>Lesson type</label>
      <select
        value={form.lesson_type}
        onChange={(e) => setForm((p) => ({ ...p, lesson_type: e.target.value }))}
        style={{ ...inputStyle(true), cursor: "pointer" }}
      >
        {LESSON_TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      <label style={{ color: B.creamMid, fontSize: 11 }}>Vocabulary (3–8 words, comma-separated)</label>
      <input
        value={vocabText}
        onChange={(e) => setVocabText(e.target.value)}
        placeholder="e.g. ocean, whale, wave"
        style={inputStyle(true)}
      />
      {fieldErrors.vocabulary && <p style={{ color: B.terra, fontSize: 11 }}>{fieldErrors.vocabulary}</p>}

      <SectionLabel>Learning goals</SectionLabel>
      <label style={{ color: B.creamMid, fontSize: 11 }}>Title *</label>
      <input value={lg.title || ""} onChange={(e) => setPath(["learning_goals", "title"], e.target.value)} style={inputStyle(true)} />
      {fieldErrors.title && <p style={{ color: B.terra, fontSize: 11 }}>{fieldErrors.title}</p>}
      <label style={{ color: B.creamMid, fontSize: 11 }}>Subject lens</label>
      <input value={lg.subject_lens || ""} onChange={(e) => setPath(["learning_goals", "subject_lens"], e.target.value)} style={inputStyle(true)} />

      <SectionLabel>Content</SectionLabel>
      <label style={{ color: B.creamMid, fontSize: 11 }}>AI action</label>
      <textarea
        value={cj.ai_action || ""}
        onChange={(e) => setPath(["learning_goals", "content_json", "ai_action"], e.target.value)}
        rows={3}
        style={{ ...inputStyle(true), minHeight: 72 }}
      />
      <label style={{ color: B.creamMid, fontSize: 11 }}>Activity narrative</label>
      <textarea
        value={cj.activity_narrative || ""}
        onChange={(e) => setPath(["learning_goals", "content_json", "activity_narrative"], e.target.value)}
        rows={3}
        style={{ ...inputStyle(true), minHeight: 72 }}
      />

      <label style={{ color: B.creamMid, fontSize: 11 }}>Learning goals bullets (one per line)</label>
      <textarea
        value={Array.isArray(cj.learning_goals) ? cj.learning_goals.join("\n") : ""}
        onChange={(e) =>
          setPath(
            ["learning_goals", "content_json", "learning_goals"],
            e.target.value
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        rows={4}
        style={{ ...inputStyle(true), minHeight: 88 }}
      />

      <SectionLabel>Seven-step structure</SectionLabel>
      {["step_1_hook", "step_2_core_activity", "step_3_do", "step_5_extension", "step_6_reflection"].map((key) => (
        <div key={key}>
          <label style={{ color: B.creamMid, fontSize: 11 }}>{key.replace(/_/g, " ")}</label>
          <textarea
            value={ss[key] || ""}
            onChange={(e) => setPath(["learning_goals", "content_json", "seven_step_structure", key], e.target.value)}
            rows={2}
            style={{ ...inputStyle(true), minHeight: 56 }}
          />
        </div>
      ))}

      <label style={{ color: B.creamMid, fontSize: 11 }}>Socratic · opening question</label>
      <input
        value={socratic.opening_question || ""}
        onChange={(e) =>
          setPath(["learning_goals", "content_json", "seven_step_structure", "step_4_socratic", "opening_question"], e.target.value)
        }
        style={inputStyle(true)}
      />

      <SectionLabel>Age profile (age 3)</SectionLabel>
      {["expected_action", "guiding_question", "extension_question", "educational_goal"].map((k) => (
        <div key={`a3-${k}`}>
          <label style={{ color: B.creamMid, fontSize: 11 }}>{k.replace(/_/g, " ")}</label>
          <textarea
            value={age3[k] || ""}
            onChange={(e) =>
              setPath(
                ["learning_goals", "content_json", "seven_step_structure", "step_4_socratic", "age_profiles", "age_3", k],
                e.target.value,
              )
            }
            rows={2}
            style={{ ...inputStyle(true), minHeight: 48 }}
          />
        </div>
      ))}

      <SectionLabel>Age profile (age 6) · optional</SectionLabel>
      {["expected_action", "guiding_question", "extension_question", "educational_goal"].map((k) => (
        <div key={`a6-${k}`}>
          <label style={{ color: B.creamMid, fontSize: 11 }}>{k.replace(/_/g, " ")}</label>
          <textarea
            value={age6[k] || ""}
            onChange={(e) =>
              setPath(
                ["learning_goals", "content_json", "seven_step_structure", "step_4_socratic", "age_profiles", "age_6", k],
                e.target.value,
              )
            }
            rows={2}
            style={{ ...inputStyle(true), minHeight: 48 }}
          />
        </div>
      ))}

      {submitErr && <p style={{ color: B.terra, fontSize: 12, marginBottom: 10 }}>{submitErr}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 12,
          background: busy ? B.creamFade : B.terra,
          color: B.cream,
          border: "none",
          fontWeight: 700,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Saving..." : mode === "create" ? "Create lesson" : "Save lesson"}
      </button>
    </div>
  );
}

/**
 * Theme directory + CRUD + lesson management (admin/content-author flows).
 */
export default function CurriculumManagement() {
  const { data: themes = [], isFetching: loadingThemes, isError: themesErr, error: themesError } = useGetThemesThemesGetQuery();
  const [sortWeekDesc, setSortWeekDesc] = useState(false);
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState({ view: "list" });
  const [toast, setToast] = useState({ text: "", tone: "ok" });
  const [previewId, setPreviewId] = useState(null);

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

  if (panel.view === "themeCreate" || panel.view === "themeEdit") {
    return (
      <>
        <Toast message={toast.text} tone={toast.tone} />
        <ThemeFormPanel
          key={panel.view === "themeEdit" ? `theme-edit-${panel.themeId}` : "theme-create"}
          mode={panel.view === "themeCreate" ? "create" : "edit"}
          initial={panel.view === "themeEdit" ? themes.find((t) => t.id === panel.themeId) : null}
          onBack={() => setPanel({ view: "list" })}
          onSaved={() => {
            showToast(panel.view === "themeCreate" ? "Theme created." : "Theme updated.");
            setPanel({ view: "list" });
          }}
        />
      </>
    );
  }

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
            showToast("Lesson saved.");
            refetchLessons();
            setPanel({ view: "detail", themeId: panel.themeId });
          }}
        />
      </>
    );
  }

  if (panel.view === "detail" && panel.themeId) {
    return (
      <>
        <Toast message={toast.text} tone={toast.tone} />
        {previewId ? <PreviewModal lessonId={previewId} onClose={() => setPreviewId(null)} /> : null}
        <div style={{ padding: "0 0 24px" }}>
          <button type="button" onClick={() => setPanel({ view: "list" })} style={{ background: "none", border: "none", color: B.gold, fontSize: 14, cursor: "pointer", marginBottom: 14 }}>
            ← All themes
          </button>
          {selectedTheme ? (
            <div style={{ background: B.bgDeep, borderRadius: 16, padding: 18, marginBottom: 14, border: `1px solid ${B.creamLow}` }}>
              <p style={{ color: B.cream, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{selectedTheme.title}</p>
              <p style={{ color: B.creamMid, fontSize: 12, marginBottom: 4 }}>
                <code style={{ color: B.gold }}>{selectedTheme.theme_key}</code> · Week {selectedTheme.week_number} · {selectedTheme.duration_days} days
              </p>
              <p style={{ color: B.creamMid, fontSize: 11 }}>Created {new Date(selectedTheme.created_at).toLocaleString()}</p>
              <button
                type="button"
                onClick={() => setPanel({ view: "themeEdit", themeId: selectedTheme.id })}
                style={{
                  marginTop: 12,
                  padding: "9px 14px",
                  borderRadius: 10,
                  background: B.goldFade,
                  color: B.gold,
                  border: `1px solid ${B.creamLow}`,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Edit theme
              </button>
            </div>
          ) : (
            <p style={{ color: B.terra, fontSize: 13 }}>Theme not found. It may have been removed.</p>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionLabel>Lessons</SectionLabel>
            <button
              type="button"
              onClick={() => setPanel({ view: "lessonNew", themeId: panel.themeId })}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                background: B.gold,
                color: B.dark,
                border: "none",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              + Add lesson
            </button>
          </div>

          {loadingLessons && <p style={{ color: B.creamMid, fontSize: 13 }}>Loading lessons...</p>}
          {lessonsQueryErr && (
            <p style={{ color: B.terra, fontSize: 13, marginBottom: 10 }}>
              {parseApiError(lessonsQueryError)} ·{" "}
              <button type="button" style={{ color: B.gold, background: "none", border: "none", cursor: "pointer" }} onClick={() => refetchLessons()}>
                Retry
              </button>
            </p>
          )}
          {!loadingLessons && !sortedLessons.length && (
            <p style={{ color: B.creamMid, fontSize: 14, lineHeight: 1.6 }}>No lessons in this theme yet.</p>
          )}

          {sortedLessons.map((lesson) => (
            <div
              key={lesson.id}
              style={{
                background: B.bgDeep,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                border: `1px solid ${B.creamLow}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <p style={{ color: B.gold, fontSize: 11, marginBottom: 4 }}>Day {lesson.day_number}</p>
                  <p style={{ color: B.cream, fontWeight: 700, fontSize: 14 }}>{lesson.lesson_type.replace(/_/g, " ")}</p>
                  <p style={{ color: B.creamMid, fontSize: 11, marginTop: 4 }}>{lesson.vocabulary?.slice(0, 6).join(", ")}{lesson.vocabulary?.length > 6 ? "…" : ""}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setPreviewId(lesson.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: B.creamFade,
                      color: B.cream,
                      border: `1px solid ${B.creamLow}`,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel({ view: "lessonEdit", themeId: panel.themeId, lesson })}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: B.terraFade,
                      color: B.terra,
                      border: `1px solid ${B.creamLow}`,
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div style={{ padding: "0 0 24px" }}>
      <Toast message={toast.text} tone={toast.tone} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <SectionLabel>Theme library</SectionLabel>
        <button
          type="button"
          onClick={() => setPanel({ view: "themeCreate" })}
          style={{
            padding: "9px 14px",
            borderRadius: 10,
            background: B.gold,
            color: B.dark,
            border: "none",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          + New theme
        </button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search title or theme_key…"
        style={{ ...inputStyle(true), marginBottom: 10 }}
      />
      <button
        type="button"
        onClick={() => setSortWeekDesc((v) => !v)}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          background: B.creamFade,
          color: B.creamMid,
          border: `1px solid ${B.creamLow}`,
          fontSize: 12,
          cursor: "pointer",
          marginBottom: 14,
        }}
      >
        Sort week {sortWeekDesc ? "↑ ascending" : "↓ descending"}
      </button>

      {loadingThemes && <p style={{ color: B.creamMid, fontSize: 13 }}>Loading themes...</p>}
      {themesErr && <p style={{ color: B.terra, fontSize: 13, marginBottom: 10 }}>{parseApiError(themesError)}</p>}
      {!loadingThemes && !themes.length && (
        <p style={{ color: B.creamMid, fontSize: 14, lineHeight: 1.6 }}>No themes yet. Create your first theme.</p>
      )}

      {filteredSorted.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setPanel({ view: "detail", themeId: t.id })}
          style={{
            width: "100%",
            textAlign: "left",
            background: B.bgDeep,
            borderRadius: 16,
            padding: 16,
            marginBottom: 10,
            border: `1px solid ${B.creamLow}`,
            cursor: "pointer",
          }}
        >
          <p style={{ color: B.cream, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.title}</p>
          <p style={{ color: B.creamMid, fontSize: 12, marginBottom: 4 }}>
            <code style={{ color: B.gold }}>{t.theme_key}</code>
          </p>
          <p style={{ color: B.creamMid, fontSize: 11 }}>
            Week {t.week_number} · {t.duration_days} days · {new Date(t.created_at).toLocaleDateString()}
          </p>
        </button>
      ))}
    </div>
  );
}
