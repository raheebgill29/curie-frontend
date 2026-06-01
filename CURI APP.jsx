"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { useHealthCheckHealthGetQuery } from "./src/lib/api/generated/healthApi";
import {
  useCreateChildChildrenPostMutation,
  useGetChildChildrenChildIdGetQuery,
  useGetChildCurriculumBoardChildrenChildIdCurriculumBoardGetQuery,
  useGetChildInsightsChildrenChildIdInsightsGetQuery,
  useGetChildProgressChildrenChildIdProgressGetQuery,
} from "./src/lib/api/generated/childrenApi";
import {
  useGetThemesThemesGetQuery,
  usePreviewLessonLessonsLessonIdPreviewGetQuery,
} from "./src/lib/api/generated/curriculumApi";
import {
  useGetChildSessionsSessionsChildIdGetQuery,
  useGetSessionDetailSessionsSessionIdDetailGetQuery,
} from "./src/lib/api/generated/sessionsApi";
import {
  useGetParentChildrenParentsParentIdChildrenGetQuery,
  useRegisterParentParentsPostMutation,
} from "./src/lib/api/generated/parentsApi";
import { useLoginParentAuthLoginPostMutation } from "./src/lib/api/generated/authApi";
import {
  useEvaluateToyEvaluatePostMutation,
  useGenerateSessionToyGenerateSessionPostMutation,
  useRespondToyRespondPostMutation,
} from "./src/lib/api/generated/toyApi";
import { B } from "./src/lib/brandPalette.js";
import { useGetParentChildrenQuery } from "./src/lib/api/homeApi";
import CurriculumManagement from "./src/components/CurriculumManagement.jsx";
import Loading, { LoadingSpinner } from "./src/components/Loading.tsx";
import HomeScreen from "./src/components/HomeScreen.tsx";
import PersonalizedPlanWizard from "./src/components/PersonalizedPlanWizard.tsx";
import { store } from "./src/lib/store";
import { baseApi } from "./src/lib/api/baseApi";

// ── Data ──────────────────────────────────────────────────────────────────────
const EYFS_DOMAINS = [
  { key: "physical",      label: "Physical Dev.",        short: "PD",  score: 80, color: B.gold },
  { key: "communication", label: "Communication",         short: "CL",  score: 60, color: B.terra },
  { key: "creative",      label: "Creative Arts",         short: "CA",  score: 75, color: "#9b7ea6" },
  { key: "mathematics",   label: "Mathematics",           short: "MA",  score: 65, color: "#6b9ab8" },
  { key: "world",         label: "Understanding World",   short: "UW",  score: 50, color: "#7ab89a" },
  { key: "pse",           label: "Personal & Social",     short: "PSE", score: 70, color: B.gold },
  { key: "literacy",      label: "Literacy",              short: "LI",  score: 45, color: B.terra },
];


const DEMO_CHILD_ID = Number(process.env.NEXT_PUBLIC_DEMO_CHILD_ID || 1) || 1;
const SESSION_KEY = "curi-session";

/** Clear saved session, drop RTK Query cache, and return to onboarding (no backend call required for current auth model). */
function signOutAndClearSession(onSessionChange) {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  store.dispatch(baseApi.util.resetApiState());
  onSessionChange(null);
}

const DOMAIN_SCORE_KEYS = {
  physical: ["physical", "physical_development", "physical development", "pd"],
  communication: ["communication", "communication_language", "communication_and_language", "communication & language", "cl"],
  creative: ["creative", "creative_arts", "creative arts", "creative_arts_and_design", "ca"],
  mathematics: ["mathematics", "maths", "math", "ma"],
  world: ["world", "understanding_world", "understanding_the_world", "understanding world", "uw"],
  pse: ["pse", "personal_social", "personal_social_emotional", "personal social", "personal & social"],
  literacy: ["literacy", "li"],
};

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORTS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const INSIGHT_ICONS = ["💬", "🧠", "🎨"];
const LESSON_TYPES = [
  "story_and_discussion",
  "song_and_movement",
  "drama_and_role_play",
  "science_exploration",
  "mathematics",
  "story_and_discussion",
  "drama_and_role_play",
];
const EYFS_AREA_MAP = {
  "Communication": "communication_and_language",
  "Maths & Logic": "mathematics",
  "Creative Arts": "creative_arts",
  "Social & Emotional": "personal_social_emotional",
  "Nature & Science": "understanding_the_world",
};
const FALLBACK_VOCABULARY = ["explore", "imagine", "describe", "count", "share", "move", "notice", "wonder"];

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function slugify(value) {
  return normalizeKey(value).replace(/_/g, "-") || "custom-plan";
}

function uniqueList(values) {
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))];
}

function toEyfsAreas(goals) {
  const areas = uniqueList(goals.map(goal => EYFS_AREA_MAP[goal] || normalizeKey(goal)));
  return areas.length ? areas : ["communication_and_language"];
}

function toVocabulary(interests, goals) {
  const words = uniqueList([
    ...interests,
    ...goals,
    ...interests.flatMap(interest => String(interest).split(/\s+/)),
    ...FALLBACK_VOCABULARY,
  ]).map(word => word.toLowerCase().replace(/[^a-z0-9-]/g, ""));

  return uniqueList(words).slice(0, 8).length >= 3
    ? uniqueList(words).slice(0, 8)
    : FALLBACK_VOCABULARY.slice(0, 3);
}

function getLatestProgressScores(progressData) {
  const progress = progressData?.progress || [];
  return progress.length ? progress[progress.length - 1]?.scores || {} : {};
}

function getDomainScore(scores, domain) {
  const normalizedScores = Object.entries(scores).reduce((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});
  const aliases = DOMAIN_SCORE_KEYS[domain.key] || [domain.key];
  const matchedKey = aliases.map(normalizeKey).find(key => normalizedScores[key] != null);
  return matchedKey ? normalizedScores[matchedKey] : domain.score;
}

function mapProgressToDomains(progressData) {
  const latestScores = getLatestProgressScores(progressData);
  return EYFS_DOMAINS.map(domain => ({
    ...domain,
    score: Math.max(0, Math.min(100, Number(getDomainScore(latestScores, domain)) || domain.score)),
  }));
}

/** Strict: only returns domains that have a real score in the API payload. */
function buildLiveDomains(progressData) {
  const latestScores = getLatestProgressScores(progressData);
  const normalizedScores = Object.entries(latestScores).reduce((acc, [key, value]) => {
    acc[normalizeKey(key)] = value;
    return acc;
  }, {});
  return EYFS_DOMAINS.map(domain => {
    const aliases = (DOMAIN_SCORE_KEYS[domain.key] || [domain.key]).map(normalizeKey);
    const matchedKey = aliases.find(key => normalizedScores[key] != null);
    if (!matchedKey) return null;
    const raw = Number(normalizedScores[matchedKey]);
    if (!Number.isFinite(raw)) return null;
    return { ...domain, score: Math.max(0, Math.min(100, raw)) };
  }).filter(Boolean);
}

/** Build a real per-domain score history (oldest -> newest) from the progress feed. */
function buildDomainHistory(progressData, domain, maxPoints = 5) {
  const progress = Array.isArray(progressData?.progress) ? progressData.progress : [];
  if (!progress.length) return [];
  const aliases = (DOMAIN_SCORE_KEYS[domain.key] || [domain.key]).map(normalizeKey);
  const recent = progress.slice(-maxPoints);
  const series = recent.map(entry => {
    const normalized = Object.entries(entry?.scores || {}).reduce((acc, [key, value]) => {
      acc[normalizeKey(key)] = value;
      return acc;
    }, {});
    const matchedKey = aliases.find(key => normalized[key] != null);
    if (!matchedKey) return null;
    const raw = Number(normalized[matchedKey]);
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : null;
  });
  // Trim leading/trailing nulls; if everything is null, return empty.
  const firstReal = series.findIndex(v => v != null);
  if (firstReal === -1) return [];
  return series.slice(firstReal).map(v => (v == null ? 0 : v));
}

function mapInsights(insightsData) {
  const apiInsights = insightsData?.insights || [];
  return apiInsights.slice(0, 3).map((item, index) => ({
    icon: INSIGHT_ICONS[index % INSIGHT_ICONS.length],
    text: item.insight,
    domain: "AI",
  }));
}

function humanizeLessonTypeUnderscores(lessonType) {
  if (lessonType == null || lessonType === "") return "Session";
  return String(lessonType)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function normalizeBoardStatus(status) {
  return String(status || "").toLowerCase() === "completed" ? "completed" : "upcoming";
}

function normalizeVocabularyTags(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "object") return Object.values(raw).flatMap(normalizeVocabularyTags);
  const s = String(raw).trim();
  return s ? [s] : [];
}

function extractSocraticQuestions(sevenStep) {
  const soc = sevenStep?.step_4_socratic;
  if (!soc || typeof soc !== "object") return [];
  const qs = [
    soc.opening_question,
    ...Object.values(soc.age_profiles || {}).flatMap((profile) =>
      profile && typeof profile === "object"
        ? [profile.guiding_question, profile.extension_question].filter(Boolean)
        : [],
    ),
  ].filter(Boolean);
  return qs.slice(0, 4);
}

function sessionPlanFallbackLines(learningGoals, contentJson) {
  const lines = [
    learningGoals?.title,
    learningGoals?.subject_lens,
    contentJson?.ai_action,
    contentJson?.activity_narrative,
    ...(Array.isArray(contentJson?.learning_goals) ? contentJson.learning_goals : []),
    ...(Array.isArray(learningGoals?.eyfs_focus) ? learningGoals.eyfs_focus : []),
  ].filter(Boolean);
  return lines.length ? lines : ["Session details will appear when available."];
}

function prettySevenStepKey(key) {
  return String(key)
    .replace(/^step_\d+_/, "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function SevenStepValue({ value, depth }) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return (
      <p style={{ color: B.creamMid, fontSize: 14, lineHeight: 1.55, marginBottom: depth ? 6 : 10 }}>
        {String(value)}
      </p>
    );
  }
  if (Array.isArray(value)) {
    return (
      <ul style={{ margin: "6px 0 10px", paddingLeft: 18, color: B.creamMid, fontSize: 13, lineHeight: 1.55 }}>
        {value.map((item, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            <SevenStepValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div style={{ paddingLeft: depth ? 10 : 0 }}>
      {Object.entries(value).map(([k, v]) => (
        <div key={k} style={{ marginBottom: 10 }}>
          <p style={{ color: B.creamMid, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{prettySevenStepKey(k)}</p>
          <SevenStepValue value={v} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}

function SevenStepSessionPlan({ structure }) {
  if (!structure || typeof structure !== "object") return null;
  const preferredOrder = [
    "step_1_hook",
    "step_2_core_activity",
    "step_3_do",
    "step_4_socratic",
    "step_5_extension",
    "step_6_reflection",
  ];
  const keys = [...new Set([...preferredOrder.filter((k) => k in structure), ...Object.keys(structure)])];
  return (
    <>
      {keys.map((key) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <p style={{ color: B.gold, fontSize: 11, fontWeight: 700, marginBottom: 8, fontFamily: "Georgia, serif" }}>
            {prettySevenStepKey(key)}
          </p>
          <SevenStepValue value={structure[key]} depth={0} />
        </div>
      ))}
    </>
  );
}

function mapCurriculumBoardLessonToDay(lesson) {
  const dn = lesson.day_number || 1;
  const label = dn >= 1 && dn <= 7 ? DAY_LABELS[dn - 1] : `Day ${dn}`;
  const dayShort = dn >= 1 && dn <= 7 ? DAY_SHORTS[dn - 1] : `D${dn}`;
  const learningGoals = lesson.learning_goals || {};
  const contentJson =
    typeof learningGoals.content_json === "object" && learningGoals.content_json !== null
      ? learningGoals.content_json
      : {};
  const sevenStep = contentJson.seven_step_structure;
  const status = normalizeBoardStatus(lesson.status);
  const engRaw = lesson.engagement_percentage;
  const engagementPercentage =
    typeof engRaw === "number" && !Number.isNaN(engRaw)
      ? Math.max(0, Math.min(100, Math.round(engRaw)))
      : 0;

  return {
    lessonId: lesson.lesson_id,
    day: dayShort,
    label,
    focus:
      (Array.isArray(learningGoals.eyfs_focus) && learningGoals.eyfs_focus.join(" + ")) ||
      (typeof learningGoals.subject_lens === "string"
        ? learningGoals.subject_lens
        : Array.isArray(learningGoals.subject_lens)
          ? learningGoals.subject_lens.join(" + ")
          : "") ||
      "Learning focus",
    type: humanizeLessonTypeUnderscores(lesson.lesson_type),
    status,
    time: "Curious Buddy",
    engagementPercentage,
    sevenStepStructure: sevenStep && typeof sevenStep === "object" ? sevenStep : null,
    learningGoals,
    contentJson,
    vocabularyTags: normalizeVocabularyTags(lesson.vocabulary),
    contentFallback: sessionPlanFallbackLines(learningGoals, contentJson),
    questions: extractSocraticQuestions(sevenStep),
  };
}

function getAgeLabel(dob) {
  if (!dob) return "Age 3";
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return "Age 3";
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const hadBirthday =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  return `Age ${hadBirthday ? age : age - 1}`;
}

// ── Radar Chart ───────────────────────────────────────────────────────────────
function RadarChart({ domains, size = 210, onSelect }) {
  const cx = size/2, cy = size/2, r = size*0.36, n = domains.length;
  const angle = i => (Math.PI*2*i)/n - Math.PI/2;
  const pt    = (i, rad) => ({ x: cx + rad*Math.cos(angle(i)), y: cy + rad*Math.sin(angle(i)) });
  const scorePts = domains.map((d,i) => pt(i, r*(d.score/100)));
  const poly = scorePts.map(p=>`${p.x},${p.y}`).join(" ");
  return (
    <svg width={size} height={size} style={{ overflow:"visible" }}>
      {[0.25,0.5,0.75,1].map(lvl => (
        <polygon key={lvl} points={domains.map((_,i)=>{const p=pt(i,r*lvl);return`${p.x},${p.y}`;}).join(" ")}
          fill="none" stroke={`rgba(247,242,235,0.1)`} strokeWidth="1" />
      ))}
      {domains.map((_,i)=>{ const o=pt(i,r); return <line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke="rgba(247,242,235,0.12)" strokeWidth="1" />; })}
      <defs>
        <linearGradient id="rg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={B.gold}  stopOpacity="0.45" />
          <stop offset="100%" stopColor={B.terra} stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <polygon points={poly} fill="url(#rg2)" stroke={B.gold} strokeWidth="1.5" strokeOpacity="0.8" />
      {domains.map((d,i) => {
        const sp=pt(i,r*(d.score/100)), lp=pt(i,r*1.22), low=d.score<55;
        return (
          <g key={d.key} style={{ cursor:"pointer" }} onClick={()=>onSelect(d)}>
            <circle cx={sp.x} cy={sp.y} r={4.5} fill={low?B.terra:B.gold} stroke={B.cream} strokeWidth="1.5" />
            <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
              fontSize="8.5" fill={low ? B.terra : B.creamMid} fontWeight={low?"700":"500"} fontFamily="Georgia, serif">
              {d.short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ProgressBar({ value, color, height=5 }) {
  return (
    <div style={{ background:B.creamFade, borderRadius:99, height, overflow:"hidden", width:"100%" }}>
      <div style={{ width:`${value}%`, height:"100%", background:color, borderRadius:99, transition:"width 1.2s ease" }} />
    </div>
  );
}

function Badge({ status }) {
  const map = {
    done:       { label:"Completed",  bg:"rgba(201,139,44,0.18)",  color:B.gold  },
    completed:  { label:"Completed",  bg:"rgba(201,139,44,0.18)",  color:B.gold  },
    today:      { label:"Today",      bg:"rgba(191,95,73,0.22)",   color:B.terra },
    upcoming:   { label:"Upcoming",   bg:"rgba(247,242,235,0.08)", color:B.creamMid },
  };
  const s = map[status] || map.upcoming;
  return <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:99, background:s.bg, color:s.color, letterSpacing:"0.04em", textTransform:"uppercase" }}>{s.label}</span>;
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height:1, background:B.creamLow, margin:"0 0 12px" }} />;
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return <p style={{ color:B.gold, fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:12, fontFamily:"Georgia, serif" }}>{children}</p>;
}

// ── Nudge Modal ───────────────────────────────────────────────────────────────
function NudgeModal({ onClose }) {
  const [sent, setSent] = useState(false);
  const [selected, setSelected] = useState(null);
  const topics = ["Bedtime Story","Maths Game","Nature Exploration","Emotions Talk","Singing Time"];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(63,77,81,0.85)", display:"flex", alignItems:"flex-end", zIndex:999, backdropFilter:"blur(6px)" }}>
      <div style={{ width:"100%", background:B.bgDeep, borderRadius:"22px 22px 0 0", padding:"24px 22px 44px", border:`1px solid ${B.creamLow}`, borderBottom:"none" }}>
        <div style={{ width:40, height:4, background:B.creamLow, borderRadius:99, margin:"0 auto 22px" }} />
        {!sent ? (
          <>
            <SectionLabel>Nudge Topic</SectionLabel>
            <p style={{ color:B.cream, fontWeight:700, fontSize:17, marginBottom:6, fontFamily:"Georgia, serif" }}>Guide the conversation</p>
            <p style={{ color:B.creamMid, fontSize:13, marginBottom:20, lineHeight:1.5 }}>Choose a topic for Curious Buddy to naturally steer towards:</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:26 }}>
              {topics.map(t => (
                <button key={t} onClick={()=>setSelected(t)}
                  style={{ padding:"9px 17px", borderRadius:99, border:`1.5px solid ${selected===t ? B.gold : B.creamLow}`, background:selected===t ? B.goldFade : "transparent", color:selected===t ? B.gold : B.creamMid, fontSize:13, cursor:"pointer", transition:"all 0.2s", fontFamily:"Georgia, serif" }}>
                  {t}
                </button>
              ))}
            </div>
            <button onClick={()=>selected&&setSent(true)}
              style={{ width:"100%", padding:"14px", borderRadius:12, background:selected?B.gold:"rgba(247,242,235,0.08)", color:selected?B.dark:B.creamMid, fontWeight:700, fontSize:15, border:"none", cursor:selected?"pointer":"default", fontFamily:"Georgia, serif", transition:"all 0.2s" }}>
              Send Instruction
            </button>
          </>
        ) : (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:44, marginBottom:14 }}>✦</div>
            <p style={{ color:B.gold, fontWeight:700, fontSize:17, margin:"0 0 6px", fontFamily:"Georgia, serif" }}>Nudged to {selected}</p>
            <p style={{ color:B.creamMid, fontSize:13, lineHeight:1.5 }}>Curious Buddy will transition naturally at the next turn</p>
            <button onClick={onClose} style={{ marginTop:22, padding:"11px 32px", borderRadius:10, background:B.creamFade, color:B.cream, border:`1px solid ${B.creamLow}`, cursor:"pointer", fontWeight:600, fontFamily:"Georgia, serif" }}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Domain Sheet ──────────────────────────────────────────────────────────────
function DomainSheet({ domain, history = [], onClose, onEnhance }) {
  const [enhanced, setEnhanced] = useState(false);
  const hasTrend = history.length >= 2;
  const maxH = hasTrend ? Math.max(...history, 1) : 1;
  const trendLabel = `${history.length}-Day Trend`;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(63,77,81,0.85)", display:"flex", alignItems:"flex-end", zIndex:999, backdropFilter:"blur(6px)" }}>
      <div style={{ width:"100%", background:B.bgDeep, borderRadius:"22px 22px 0 0", padding:"24px 22px 44px", maxHeight:"80vh", overflowY:"auto", border:`1px solid ${B.creamLow}`, borderBottom:"none" }}>
        <div style={{ width:40, height:4, background:B.creamLow, borderRadius:99, margin:"0 auto 22px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <p style={{ color:B.gold, fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4, fontFamily:"Georgia, serif" }}>{domain.short} · EYFS</p>
            <p style={{ color:B.cream, fontSize:22, fontWeight:700, fontFamily:"Georgia, serif" }}>{domain.label}</p>
          </div>
          <div style={{ textAlign:"right" }}>
            <p style={{ color:domain.color, fontSize:36, fontWeight:700, lineHeight:1, fontFamily:"Georgia, serif" }}>{domain.score}</p>
            <p style={{ color:B.creamMid, fontSize:11 }}>/ 100</p>
          </div>
        </div>

        {hasTrend && (
          <div style={{ marginBottom:22 }}>
            <p style={{ color:B.creamMid, fontSize:11, marginBottom:10, letterSpacing:"0.05em", textTransform:"uppercase" }}>{trendLabel}</p>
            <div style={{ display:"flex", alignItems:"flex-end", gap:7, height:52 }}>
              {history.map((v,i) => (
                <div key={i} style={{ flex:1, background:i===history.length-1 ? domain.color : B.creamFade, borderRadius:"4px 4px 0 0", height:`${(v/maxH)*100}%`, transition:"height 0.8s ease", border:`1px solid ${i===history.length-1 ? "transparent" : B.creamLow}` }} />
              ))}
            </div>
          </div>
        )}

        <Divider />

        {!enhanced ? (
          <button onClick={()=>{ setEnhanced(true); onEnhance(domain); }}
            style={{ width:"100%", padding:15, borderRadius:12, background:B.gold, color:B.dark, fontWeight:700, fontSize:15, border:"none", cursor:"pointer", fontFamily:"Georgia, serif" }}>
            ✦ Add Booster Sessions This Week
          </button>
        ) : (
          <div style={{ textAlign:"center", padding:16, background:B.goldFade, borderRadius:12, border:`1px solid rgba(201,139,44,0.3)` }}>
            <p style={{ color:B.gold, fontWeight:700, fontFamily:"Georgia, serif" }}>✦ Synced to Curious Buddy</p>
            <p style={{ color:B.creamMid, fontSize:12, marginTop:4 }}>Booster sessions for {domain.label} added this week</p>
          </div>
        )}
        <button onClick={onClose} style={{ width:"100%", marginTop:12, padding:12, borderRadius:12, background:"transparent", color:B.creamMid, border:`1px solid ${B.creamLow}`, cursor:"pointer", fontSize:13 }}>Close</button>
      </div>
    </div>
  );
}

// ── Day Sheet ─────────────────────────────────────────────────────────────────
function DaySheet({ day, childId, onClose }) {
  const [childInput, setChildInput] = useState("");
  const [turns, setTurns] = useState([]);
  const [generateSession, { data: generatedSession, isLoading: isGenerating, isError: didGenerateFail }] = useGenerateSessionToyGenerateSessionPostMutation();
  const [respond, { isLoading: isResponding, isError: didRespondFail }] = useRespondToyRespondPostMutation();
  const [evaluate, { data: evaluation, isLoading: isEvaluating, isError: didEvaluateFail }] = useEvaluateToyEvaluatePostMutation();
  const { data: preview, isFetching: isPreviewLoading } = usePreviewLessonLessonsLessonIdPreviewGetQuery(day.lessonId ? { lessonId: day.lessonId } : skipToken);
  const startSession = () => {
    if (!day.lessonId) return;
    setTurns([]);
    generateSession({
      generateSessionRequest: {
          child_id: childId,
        lesson_id: day.lessonId,
      },
    });
  };
  const sendChildInput = async () => {
    if (!generatedSession?.session_id || !childInput.trim()) return;
    const input = childInput.trim();
    setChildInput("");
    setTurns(prev => [...prev, { actor: "child", text: input }]);
    try {
      const response = await respond({
        respondRequest: {
          session_id: generatedSession.session_id,
          child_input: input,
        },
      }).unwrap();
      setTurns(prev => [...prev, { actor: "buddy", text: response.response_text, state: response.child_state, goal: response.current_goal }]);
    } catch {
      setTurns(prev => [...prev, { actor: "system", text: "Curious Buddy could not respond. Please try again." }]);
    }
  };
  const evaluateSession = () => {
    if (!generatedSession?.session_id) return;
    evaluate({ evaluateRequest: { session_id: generatedSession.session_id } });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(63,77,81,0.85)", display:"flex", alignItems:"flex-end", zIndex:999, backdropFilter:"blur(6px)" }}>
      <div style={{ width:"100%", background:B.bgDeep, borderRadius:"22px 22px 0 0", padding:"24px 22px 44px", maxHeight:"87vh", overflowY:"auto", border:`1px solid ${B.creamLow}`, borderBottom:"none" }}>
        <div style={{ width:40, height:4, background:B.creamLow, borderRadius:99, margin:"0 auto 22px" }} />
        <div style={{ marginBottom:10 }}><Badge status={day.status} /></div>
        <p style={{ color:B.cream, fontSize:21, fontWeight:700, margin:"8px 0 2px", fontFamily:"Georgia, serif" }}>{day.label}</p>
        <p style={{ color:B.gold, fontSize:14, marginBottom:6, fontFamily:"Georgia, serif" }}>{day.type}</p>
        <p style={{ color:B.creamMid, fontSize:12, marginBottom:22 }}>🎯 {day.focus} &nbsp;·&nbsp; ⏱ {day.time}</p>

        <Divider />
        <SectionLabel>Session Plan</SectionLabel>
        {day.sevenStepStructure && Object.keys(day.sevenStepStructure).length > 0 ? (
          <SevenStepSessionPlan structure={day.sevenStepStructure} />
        ) : (
          (day.contentFallback || []).map((c, i) => (
            <div key={i} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
              <span style={{ color:B.gold, fontSize:11, fontWeight:700, minWidth:22, fontFamily:"Georgia, serif" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ color:B.creamMid, fontSize:14, lineHeight:1.5 }}>{c}</span>
            </div>
          ))
        )}

        {(day.vocabularyTags?.length ?? 0) > 0 && (
          <>
            <Divider />
            <SectionLabel>Vocabulary</SectionLabel>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:6 }}>
              {day.vocabularyTags.map((tag, i) => (
                <span
                  key={i}
                  style={{
                    fontSize:12,
                    padding:"5px 11px",
                    borderRadius:99,
                    background:B.creamFade,
                    color:B.creamMid,
                    border:`1px solid ${B.creamLow}`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}

        {day.lessonId && (
          <div style={{ margin:"18px 0", background:B.creamFade, borderRadius:14, padding:14, border:`1px solid ${B.creamLow}` }}>
            {isPreviewLoading ? (
              <div style={{ marginBottom:14 }}>
                <Loading variant="inline" size="sm" message="Loading lesson preview…" />
              </div>
            ) : null}
            {preview && !isPreviewLoading && (
              <div style={{ marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${B.creamLow}` }}>
                <SectionLabel>AI Prompt Preview</SectionLabel>
                <p style={{ color:B.creamMid, fontSize:12, lineHeight:1.55 }}>{preview.rendered_system_prompt.slice(0, 220)}{preview.rendered_system_prompt.length > 220 ? "..." : ""}</p>
              </div>
            )}
            <button onClick={startSession}
              style={{ width:"100%", padding:12, borderRadius:11, background:B.gold, color:B.dark, fontWeight:700, border:"none", cursor:isGenerating?"default":"pointer", fontFamily:"Georgia, serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              {isGenerating ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Starting Curious Buddy…</span>
                </>
              ) : (
                "Start AI Toy Session"
              )}
            </button>
            {generatedSession && (
              <p style={{ color:B.creamMid, fontSize:12, lineHeight:1.55, marginTop:12 }}>
                <strong style={{ color:B.gold }}>First message:</strong> {generatedSession.first_message}
              </p>
            )}
            {didGenerateFail && <p style={{ color:B.terra, fontSize:12, marginTop:10 }}>Could not start this session. Check the backend data for this child and lesson.</p>}
            {generatedSession && (
              <div style={{ marginTop:14 }}>
                {turns.map((turn, i) => (
                  <div key={i} style={{ marginBottom:8, padding:10, borderRadius:10, background:turn.actor==="child"?B.terraFade:B.goldFade, border:`1px solid ${B.creamLow}` }}>
                    <p style={{ color:turn.actor==="child"?B.terra:B.gold, fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>{turn.actor}</p>
                    <p style={{ color:B.creamMid, fontSize:12, lineHeight:1.45 }}>{turn.text}</p>
                    {turn.goal && <p style={{ color:B.creamMid, fontSize:10, marginTop:5 }}>Goal: {turn.goal}</p>}
                  </div>
                ))}
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  <input value={childInput} onChange={e=>setChildInput(e.target.value)} placeholder="Child says..."
                    style={{ flex:1, minWidth:0, padding:"11px 12px", borderRadius:10, background:B.bgDeep, color:B.cream, border:`1px solid ${B.creamLow}` }} />
                  <button onClick={sendChildInput}
                    style={{ padding:"0 14px", borderRadius:10, background:B.terra, color:B.cream, border:"none", fontWeight:700, cursor:isResponding?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, minWidth:72 }}>
                    {isResponding ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>…</span>
                      </>
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
                {didRespondFail && <p style={{ color:B.terra, fontSize:12, marginTop:8 }}>Toy response failed.</p>}
                <button onClick={evaluateSession}
                  style={{ width:"100%", marginTop:10, padding:11, borderRadius:10, background:B.creamFade, color:B.cream, border:`1px solid ${B.creamLow}`, fontWeight:700, cursor:isEvaluating?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                  {isEvaluating ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Evaluating…</span>
                    </>
                  ) : (
                    "End & Evaluate Session"
                  )}
                </button>
                {evaluation && (
                  <p style={{ color:B.creamMid, fontSize:12, lineHeight:1.55, marginTop:10 }}>
                    <strong style={{ color:B.gold }}>Evaluation:</strong> {evaluation.insight_summary}
                  </p>
                )}
                {didEvaluateFail && <p style={{ color:B.terra, fontSize:12, marginTop:8 }}>Evaluation failed.</p>}
              </div>
            )}
          </div>
        )}

        {(day.questions?.length ?? 0) > 0 && (
          <>
            <Divider />
            <SectionLabel>Socratic Questions</SectionLabel>
            {day.questions.map((q,i) => (
              <div key={i} style={{ marginBottom:12, paddingLeft:14, borderLeft:`2px solid ${B.terra}` }}>
                <p style={{ color:B.terra, fontSize:10, marginBottom:3, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>{i===0?"Verification":"Extension"}</p>
                <p style={{ color:B.cream, fontSize:13, fontStyle:"italic", fontFamily:"Georgia, serif" }}>"{q}"</p>
              </div>
            ))}
          </>
        )}

        {day.aiLog && (
          <>
            <Divider />
            <SectionLabel>AI Learning Report</SectionLabel>
            <div style={{ background:B.goldFade, borderRadius:14, padding:16, marginBottom:18, border:`1px solid rgba(201,139,44,0.2)` }}>
              <p style={{ color:B.creamMid, fontSize:13, lineHeight:1.65 }}>{day.aiLog}</p>
            </div>
          </>
        )}

        <>
          <Divider />
          <SectionLabel>Engagement</SectionLabel>
          <div style={{ background:B.creamFade, borderRadius:12, padding:14, marginBottom:18, border:`1px solid ${B.creamLow}` }}>
            <ProgressBar value={day.engagementPercentage ?? 0} color={B.gold} height={6} />
            <p style={{ color:B.gold, fontSize:22, fontWeight:700, fontFamily:"Georgia, serif", marginTop:10 }}>
              {day.engagementPercentage ?? 0}%
            </p>
            <p style={{ color:B.creamMid, fontSize:11 }}>From your latest session data</p>
          </div>
        </>

        <button onClick={onClose} style={{ width:"100%", padding:14, borderRadius:12, background:B.creamFade, color:B.cream, border:`1px solid ${B.creamLow}`, cursor:"pointer", fontWeight:600 }}>Close</button>
      </div>
    </div>
  );
}

// ── Tab: Dashboard ────────────────────────────────────────────────────────────
function TabDashboard({ childId, onNudge }) {
  const [mode, setMode] = useState("Learning");
  const [vol, setVol] = useState(70);
  const { data: health, isFetching: isHealthFetching } = useHealthCheckHealthGetQuery();
  const { data: sessions, isFetching: isSessionsFetching } = useGetChildSessionsSessionsChildIdGetQuery({ childId, page: 1, pageSize: 5 });
  const { data: insightsData, isFetching: isInsightsFetching } = useGetChildInsightsChildrenChildIdInsightsGetQuery({ childId });
  const modes = ["Learning","Sleep","Free Chat"];
  const aiInsights = mapInsights(insightsData);
  const onlineLabel = health?.status ? "Curious Buddy Online" : isHealthFetching ? "Checking Buddy Status" : "Curious Buddy Offline";
  const latestSession = sessions?.items?.[0];
  const { data: latestSessionDetail } = useGetSessionDetailSessionsSessionIdDetailGetQuery(latestSession?.id ? { sessionId: latestSession.id } : skipToken);
  const latestEvent = latestSessionDetail?.events?.[latestSessionDetail.events.length - 1];

  return (
    <div style={{ padding:"0 20px 110px" }}>
      {/* Live status card */}
      <div style={{ background:B.bgDeep, borderRadius:20, padding:22, marginBottom:14, border:`1px solid ${B.creamLow}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:health?.status ? B.gold : B.terra, boxShadow:`0 0 10px ${health?.status ? B.gold : B.terra}` }} />
              {isHealthFetching ? <LoadingSpinner size="sm" /> : null}
              <span style={{ color:health?.status ? B.gold : B.terra, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>{onlineLabel}</span>
            </div>
            <p style={{ color:B.cream, fontWeight:700, fontSize:15, fontFamily:"Georgia, serif", lineHeight:1.4 }}>Body Awareness · Songs & Movement</p>
            <p style={{ color:B.creamMid, fontSize:12, marginTop:4 }}>{latestSession ? `Latest session #${latestSession.id}` : "18 min elapsed · Round 3 of 6"}</p>
          </div>
          <div style={{ width:52, height:52, borderRadius:16, background:B.goldFade, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, border:`1px solid rgba(201,139,44,0.25)` }}>
            🧸
          </div>
        </div>
        <button onClick={onNudge}
          style={{ width:"100%", padding:"12px", borderRadius:11, background:B.terra, color:B.cream, fontWeight:700, fontSize:14, border:"none", cursor:"pointer", fontFamily:"Georgia, serif", letterSpacing:"0.02em" }}>
          ✦ Nudge Topic
        </button>
      </div>

      {latestEvent && (
        <div style={{ background:B.bgDeep, borderRadius:20, padding:20, marginBottom:14, border:`1px solid ${B.creamLow}` }}>
          <SectionLabel>Latest Session Detail</SectionLabel>
          <p style={{ color:B.cream, fontSize:14, fontWeight:700, marginBottom:6, fontFamily:"Georgia, serif" }}>Turn {latestEvent.turn_number} · {latestEvent.actor}</p>
          <p style={{ color:B.creamMid, fontSize:13, lineHeight:1.6 }}>{latestEvent.text}</p>
        </div>
      )}

      {/* Stats */}
      {isSessionsFetching ? (
        <div style={{ marginBottom:14 }}>
          <Loading variant="inline" size="sm" message="Loading sessions…" />
        </div>
      ) : null}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        {[
          { label:"Sessions", value:sessions?.total ?? "—", sub:"Loaded from backend", color:B.gold },
          { label:"This Week",       value:"1 / 7",  sub:"Monday complete",    color:B.terra },
        ].map(s => (
          <div key={s.label} style={{ background:B.bgDeep, borderRadius:16, padding:18, border:`1px solid ${B.creamLow}` }}>
            <p style={{ color:B.creamMid, fontSize:11, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>{s.label}</p>
            <p style={{ color:s.color, fontSize:28, fontWeight:700, lineHeight:1, fontFamily:"Georgia, serif" }}>{s.value}</p>
            <p style={{ color:B.creamMid, fontSize:11, marginTop:6 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      <div style={{ background:B.bgDeep, borderRadius:20, padding:20, marginBottom:14, border:`1px solid ${B.creamLow}` }}>
        <SectionLabel>Today's AI Insights</SectionLabel>
        {isInsightsFetching ? (
          <Loading variant="section" size="sm" message="Loading insights…" />
        ) : null}
        {!isInsightsFetching && aiInsights.map((ins,i) => (
          <div key={i} style={{ display:"flex", gap:13, marginBottom:i<aiInsights.length-1?16:0, paddingBottom:i<aiInsights.length-1?16:0, borderBottom:i<aiInsights.length-1?`1px solid ${B.creamLow}`:"none" }}>
            <span style={{ fontSize:17, lineHeight:1.5 }}>{ins.icon}</span>
            <p style={{ color:B.creamMid, fontSize:13, lineHeight:1.6 }}>{ins.text}</p>
          </div>
        ))}
        {!isInsightsFetching && aiInsights.length === 0 ? (
          <p style={{ color:B.creamMid, fontSize:13 }}>No insights yet.</p>
        ) : null}
      </div>

      {/* Quick controls — commented out
      <div style={{ background:B.bgDeep, borderRadius:20, padding:20, border:`1px solid ${B.creamLow}` }}>
        <SectionLabel>Quick Controls</SectionLabel>
        <p style={{ color:B.creamMid, fontSize:11, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Mode</p>
        <div style={{ display:"flex", gap:8, marginBottom:22 }}>
          {modes.map(m => (
            <button key={m} onClick={()=>setMode(m)}
              style={{ flex:1, padding:"9px 4px", borderRadius:10, background:mode===m ? B.gold : B.creamFade, color:mode===m ? B.dark : B.creamMid, fontWeight:mode===m?700:400, fontSize:12, border:`1px solid ${mode===m ? B.gold : B.creamLow}`, cursor:"pointer", transition:"all 0.2s", fontFamily:"Georgia, serif" }}>
              {m}
            </button>
          ))}
        </div>
        <p style={{ color:B.creamMid, fontSize:11, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Volume — {vol}%</p>
        <input type="range" min={0} max={100} value={vol} onChange={e=>setVol(+e.target.value)}
          style={{ width:"100%", accentColor:B.gold }} />
      </div>
      */}
    </div>
  );
}

// ── Tab: Growth ───────────────────────────────────────────────────────────────
function TabGrowth({ childId }) {
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [enhanced, setEnhanced] = useState([]);
  const {
    data: child,
    isFetching: isChildLoading,
    isError: isChildError,
  } = useGetChildChildrenChildIdGetQuery({ childId });
  const {
    data: progressData,
    isFetching: isProgressLoading,
    isError: isProgressError,
  } = useGetChildProgressChildrenChildIdProgressGetQuery({ childId });

  const domains = buildLiveDomains(progressData);
  const hasGrowthData = domains.length > 0;
  // First-load (no cached data yet). On subsequent refetches keep the last
  // known data on screen rather than blanking out.
  const isInitialLoading =
    (isChildLoading && !child) || (isProgressLoading && !progressData);

  if (isInitialLoading) {
    return (
      <div style={{ padding:"0 20px 110px" }}>
        <div style={{ background:B.bgDeep, borderRadius:20, padding:28, border:`1px solid ${B.creamLow}` }}>
          <Loading variant="section" message="Loading growth data…" />
        </div>
      </div>
    );
  }

  if (!hasGrowthData) {
    return (
      <div style={{ padding:"0 20px 110px" }}>
        <div style={{ background:B.bgDeep, borderRadius:20, padding:28, textAlign:"center", border:`1px solid ${B.creamLow}` }}>
          <SectionLabel>EYFS Development Radar</SectionLabel>
          {child?.name && (
            <p style={{ color:B.cream, fontWeight:700, fontSize:16, marginBottom:8, fontFamily:"Georgia, serif" }}>
              {child.name}'s Growth Profile
            </p>
          )}
          <p style={{ color:B.creamMid, fontSize:13, lineHeight:1.55, marginTop:6 }}>
            {isProgressError || isChildError
              ? "We couldn't load growth data just now. Pull down or check back shortly."
              : "No growth data yet. Once Curious Buddy completes a few sessions, your child's EYFS scores will appear here."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:"0 20px 110px" }}>
      <div style={{ background:B.bgDeep, borderRadius:20, padding:24, marginBottom:14, textAlign:"center", border:`1px solid ${B.creamLow}` }}>
        <SectionLabel>EYFS Development Radar</SectionLabel>
        {child?.name && (
          <p style={{ color:B.cream, fontWeight:700, fontSize:16, marginBottom:4, fontFamily:"Georgia, serif" }}>
            {child.name}'s Growth Profile
          </p>
        )}
        <p style={{ color:B.creamMid, fontSize:12, marginBottom:22 }}>Tap any dimension to view details & boost</p>
        <div style={{ display:"flex", justifyContent:"center" }}>
          <RadarChart domains={domains} size={220} onSelect={setSelectedDomain} />
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginTop:18 }}>
          {domains.map(d => (
            <div key={d.key} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:d.color }} />
              <span style={{ fontSize:10, color:B.creamMid, fontFamily:"Georgia, serif" }}>{d.short}</span>
            </div>
          ))}
        </div>
      </div>

      {domains.map(d => (
        <div key={d.key} onClick={()=>setSelectedDomain(d)}
          style={{ background:B.bgDeep, borderRadius:16, padding:18, marginBottom:10, cursor:"pointer", border:`1px solid ${enhanced.includes(d.key) ? "rgba(201,139,44,0.4)" : B.creamLow}`, transition:"border 0.3s" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:11, background:`${d.color}22`, display:"flex", alignItems:"center", justifyContent:"center", border:`1px solid ${d.color}44` }}>
                <span style={{ color:d.color, fontSize:12, fontWeight:700, fontFamily:"Georgia, serif" }}>{d.short}</span>
              </div>
              <div>
                <p style={{ color:B.cream, fontSize:14, fontWeight:600, fontFamily:"Georgia, serif" }}>{d.label}</p>
                {enhanced.includes(d.key) && <p style={{ color:B.gold, fontSize:11, marginTop:2 }}>✦ Booster plan added</p>}
              </div>
            </div>
            <p style={{ color:d.color, fontSize:22, fontWeight:700, fontFamily:"Georgia, serif" }}>{d.score}</p>
          </div>
          <ProgressBar value={d.score} color={d.color} height={5} />
        </div>
      ))}

      {selectedDomain && (
        <DomainSheet
          domain={selectedDomain}
          history={buildDomainHistory(progressData, selectedDomain)}
          onClose={()=>setSelectedDomain(null)}
          onEnhance={d=>setEnhanced(prev=>[...prev,d.key])}
        />
      )}
    </div>
  );
}

// ── Week helpers ──────────────────────────────────────────────────────────────
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const startStr = monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const endStr   = sunday.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

// ── Week navigator ─────────────────────────────────────────────────────────────
function WeekNavigator({ selectedDate, onChange }) {
  const pickerRef = useRef(null);
  const monday        = getMonday(selectedDate);
  const todayMonday   = getMonday(new Date());
  const isCurrentWeek = monday.getTime() >= todayMonday.getTime();

  const goBack = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    onChange(d);
  };

  const goForward = () => {
    if (isCurrentWeek) return;
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    onChange(d);
  };

  const openPicker = () => {
    try { pickerRef.current?.showPicker(); } catch { pickerRef.current?.click(); }
  };

  const navBtn = (onClick, label, disabled) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: disabled ? "transparent" : B.creamFade,
        border: `1px solid ${disabled ? "transparent" : B.creamLow}`,
        color: disabled ? B.creamLow : B.cream,
        fontSize: 20, cursor: disabled ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, background: B.bgDeep, borderRadius: 14, padding: "10px 12px", border: `1px solid ${B.creamLow}` }}>
      {navBtn(goBack, "‹", false)}

      <button
        type="button"
        onClick={openPicker}
        style={{ flex: 1, background: "none", border: "none", color: B.cream, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Georgia, serif", textAlign: "center", padding: "4px 0" }}
      >
        {formatWeekRange(monday)}
        <span style={{ color: B.gold, fontSize: 10, marginLeft: 6 }}>▾</span>
      </button>

      {/* Hidden native date picker — triggered programmatically */}
      <input
        ref={pickerRef}
        type="date"
        value={toISODate(selectedDate)}
        max={toISODate(new Date())}
        onChange={(e) => {
          if (e.target.value) onChange(new Date(e.target.value + "T00:00:00"));
        }}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
        tabIndex={-1}
      />

      {navBtn(goForward, "›", isCurrentWeek)}
    </div>
  );
}

// ── Weekly EYFS progress card ──────────────────────────────────────────────────
function WeeklyProgressCard({ childId, selectedDate }) {
  const weekOf = toISODate(selectedDate);
  const {
    data: progressData,
    isFetching,
    isError,
  } = useGetChildProgressChildrenChildIdProgressGetQuery(
    childId ? { childId, weekOf } : skipToken,
  );

  const domains = useMemo(() => buildLiveDomains(progressData), [progressData]);
  const hasData  = domains.length > 0 && domains.some(d => d.score > 0);

  if (isFetching) {
    return (
      <div style={{ background: B.bgDeep, borderRadius: 18, padding: 20, marginBottom: 14, border: `1px solid ${B.creamLow}` }}>
        <Loading variant="inline" size="sm" message="Loading progress…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ background: B.bgDeep, borderRadius: 18, padding: 20, marginBottom: 14, border: `1px solid ${B.creamLow}` }}>
        <p style={{ color: B.terra, fontSize: 13 }}>Could not load progress data.</p>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div style={{ background: B.bgDeep, borderRadius: 18, padding: 24, marginBottom: 14, border: `1px solid ${B.creamLow}`, textAlign: "center" }}>
        <p style={{ fontSize: 32, marginBottom: 10 }}>📭</p>
        <p style={{ color: B.cream, fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No sessions in selected week</p>
        <p style={{ color: B.creamMid, fontSize: 13, lineHeight: 1.5 }}>
          Complete a session with Curious Buddy and progress will appear here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: B.bgDeep, borderRadius: 18, padding: 18, marginBottom: 14, border: `1px solid ${B.creamLow}` }}>
      <SectionLabel>EYFS Progress This Week</SectionLabel>
      {progressData?.week_start && progressData?.week_end && (
        <p style={{ color: B.creamMid, fontSize: 11, marginBottom: 14 }}>
          {new Date(progressData.week_start + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          {" – "}
          {new Date(progressData.week_end + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          {" · "}
          {progressData.progress.length} session{progressData.progress.length !== 1 ? "s" : ""}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {domains.map((domain) => (
          <div key={domain.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: domain.color, flexShrink: 0 }} />
                <span style={{ color: B.cream, fontSize: 13 }}>{domain.label}</span>
              </div>
              <span style={{ color: domain.color, fontSize: 13, fontWeight: 700 }}>{domain.score}%</span>
            </div>
            <ProgressBar value={domain.score} color={domain.color} height={6} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Curriculum ───────────────────────────────────────────────────────────
function TabCurriculum({ childId, parentId }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const [buildingPlan, setBuildingPlan] = useState(false);
  const [curriculumSegment, setCurriculumSegment] = useState("progress");
  const [boardThemeId, setBoardThemeId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { data: childForGenerator } = useGetChildChildrenChildIdGetQuery({ childId });
  const { data: themes = [], isFetching: isLoadingThemes } = useGetThemesThemesGetQuery();
  const {
    data: curriculumBoard,
    isFetching: isLoadingBoard,
    isError: isBoardError,
  } = useGetChildCurriculumBoardChildrenChildIdCurriculumBoardGetQuery(
    childId ? { childId, themeId: boardThemeId ?? undefined } : skipToken,
  );
  const weeklyPlan = useMemo(() => {
    const lessons = curriculumBoard?.lessons;
    if (!lessons?.length) return [];
    return [...lessons]
      .sort((a, b) => (a.day_number || 0) - (b.day_number || 0))
      .map(mapCurriculumBoardLessonToDay);
  }, [curriculumBoard]);
  const themeTitle =
    curriculumBoard?.theme_title ||
    (boardThemeId ? themes.find((t) => t.id === boardThemeId)?.title : null) ||
    themes[0]?.title ||
    "This Week";
  const completedCount = weeklyPlan.filter((d) => d.status === "completed").length;
  const avgEngagement = weeklyPlan.length
    ? Math.round(weeklyPlan.reduce((s, d) => s + (d.engagementPercentage || 0), 0) / weeklyPlan.length)
    : 0;
  if (buildingPlan) {
    return (
      <PersonalizedPlanWizard
        childId={childId}
        parentId={parentId}
        childName={childForGenerator?.name}
        defaultWeekNumber={
          curriculumBoard?.week_number ? curriculumBoard.week_number + 1 : undefined
        }
        onClose={() => setBuildingPlan(false)}
        onActivated={() => setBuildingPlan(false)}
      />
    );
  }

  return (
    <div style={{ padding:"0 20px 110px" }}>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button type="button" onClick={()=>setCurriculumSegment("progress")}
          style={{
            flex:1, padding:"11px 12px", borderRadius:12,
            border:`1px solid ${curriculumSegment==="progress"?B.gold:B.creamLow}`,
            background:curriculumSegment==="progress"?B.goldFade:B.creamFade,
            color:curriculumSegment==="progress"?B.gold:B.creamMid,
            fontWeight:700, fontSize:12, cursor:"pointer",
          }}>
          My progress
        </button>
        <button type="button" onClick={()=>setCurriculumSegment("manage")}
          style={{
            flex:1, padding:"11px 12px", borderRadius:12,
            border:`1px solid ${curriculumSegment==="manage"?B.gold:B.creamLow}`,
            background:curriculumSegment==="manage"?B.goldFade:B.creamFade,
            color:curriculumSegment==="manage"?B.gold:B.creamMid,
            fontWeight:700, fontSize:12, cursor:"pointer",
          }}>
          Themes & lessons
        </button>
      </div>

      {curriculumSegment==="manage" ? (
        <CurriculumManagement />
      ) : (
        <>
          {/* Week navigator + EYFS progress for selected week */}
          <WeekNavigator selectedDate={selectedDate} onChange={setSelectedDate} />
          <WeeklyProgressCard childId={childId} selectedDate={selectedDate} />

          <div style={{ marginBottom:14 }}>
            <SectionLabel>Curriculum board theme</SectionLabel>
            <select
              value={boardThemeId ?? ""}
              onChange={(e)=>{
                const v=e.target.value;
                setBoardThemeId(v===""?null:Number(v));
              }}
              style={{
                width:"100%", padding:"11px 12px", borderRadius:12,
                background:B.bgDeep, color:B.cream,
                border:`1px solid ${B.creamLow}`, fontSize:14,
              }}
            >
              <option value="">Default (server)</option>
              {themes.map((t)=>(
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div style={{ background:B.bgDeep, borderRadius:20, padding:22, marginBottom:14, border:`1px solid ${B.creamLow}` }}>
            <SectionLabel>This Week's Theme</SectionLabel>
            <p style={{ color:B.cream, fontSize:24, fontWeight:700, marginBottom:12, fontFamily:"Georgia, serif" }}>{themeTitle} 🧍</p>
            <div style={{ display:"flex", gap:20 }}>
              {[
                {
                  label:"Progress",
                  value:`${completedCount} / ${weeklyPlan.length || curriculumBoard?.duration_days || 7}`,
                },
                { label:"Avg Engagement", value:`${avgEngagement}%` },
                {
                  label:"Backend",
                  value:
                    isLoadingThemes || isLoadingBoard
                      ? "Syncing"
                      : curriculumBoard
                        ? "Live"
                        : isBoardError
                          ? "Unavailable"
                          : "—",
                },
              ].map(s => (
                <div key={s.label}>
                  <p style={{ color:B.creamMid, fontSize:10, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>{s.label}</p>
                  <p style={{ color:B.cream, fontWeight:700, fontSize:14, fontFamily:"Georgia, serif" }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {isLoadingBoard ? (
            <Loading variant="section" message="Loading curriculum board…" />
          ) : (
            <>
          {!weeklyPlan.length && (
            <p style={{ color:B.creamMid, fontSize:14, lineHeight:1.6, marginBottom:12 }}>
              No curriculum lessons for this theme yet. Build or sync a plan, or choose another theme when available.
            </p>
          )}

          {weeklyPlan.map(day => (
            <div key={day.lessonId || day.day} onClick={()=>setSelectedDay(day)}
              style={{
                background:B.bgDeep,
                borderRadius:16,
                padding:18,
                marginBottom:10,
                cursor:"pointer",
                border:day.status==="completed"?`1px solid rgba(201,139,44,0.35)`:`1px solid ${B.creamLow}`,
                transition:"border 0.2s",
              }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ display:"flex", gap:13, alignItems:"center" }}>
                  <div style={{
                    width:42,
                    height:42,
                    borderRadius:13,
                    background:day.status==="completed"?B.goldFade:B.creamFade,
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    border:`1px solid ${day.status==="completed"?B.gold:B.creamLow}`,
                  }}>
                    <span style={{ fontSize:16 }}>{day.status==="completed"?"✦":"◌"}</span>
                  </div>
                  <div>
                    <p style={{ color:B.cream, fontWeight:700, fontSize:14, fontFamily:"Georgia, serif" }}>{day.label}</p>
                    <p style={{ color:B.creamMid, fontSize:12, marginTop:1 }}>{day.type}</p>
                  </div>
                </div>
                <Badge status={day.status} />
              </div>
              <div style={{ display:"flex", gap:16, marginBottom:10 }}>
                <p style={{ color:B.creamMid, fontSize:11 }}>🎯 {day.focus}</p>
                <p style={{ color:B.creamMid, fontSize:11 }}>⏱ {day.time}</p>
              </div>
              <ProgressBar value={day.engagementPercentage} color={B.gold} height={4} />
              <p style={{ color:B.gold, fontSize:11, marginTop:5 }}>Engagement {day.engagementPercentage}%</p>
            </div>
          ))}
            </>
          )}

          <button
            type="button"
            onClick={() => setBuildingPlan(true)}
            style={{
              width: "100%",
              padding: 16,
              borderRadius: 16,
              background: B.gold,
              color: B.dark,
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              marginTop: 8,
              fontFamily: "Georgia, serif",
              letterSpacing: "0.02em",
            }}
          >
            ✦ Build a Personalised Plan
          </button>

          {selectedDay && <DaySheet day={selectedDay} childId={childId} onClose={()=>setSelectedDay(null)} />}
        </>
      )}
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────
function Onboarding({ onReady }) {
  const [step, setStep] = useState("parent");
  const [activeParent, setActiveParent] = useState(null);
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [childName, setChildName] = useState("");
  const [childDob, setChildDob] = useState("");
  const [message, setMessage] = useState("");
  const parentId = activeParent?.id;
  const [loginParent, { isLoading: isLoggingIn }] = useLoginParentAuthLoginPostMutation();
  const [registerParent, { isLoading: isRegisteringParent }] = useRegisterParentParentsPostMutation();
  const [createChild, { isLoading: isCreatingChild }] = useCreateChildChildrenPostMutation();
  const { data: children = [], isFetching: isLoadingChildren } = useGetParentChildrenParentsParentIdChildrenGetQuery(parentId ? { parentId } : skipToken);
  const inputStyle = {
    width:"100%",
    padding:"12px 13px",
    borderRadius:11,
    background:B.bgDeep,
    color:B.cream,
    border:`1px solid ${B.creamLow}`,
    marginBottom:10,
  };
  const saveSession = (session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    onReady(session);
  };
  const handleLoginParent = async () => {
    if (!parentEmail || !parentPassword) {
      setMessage("Email and password are required.");
      return;
    }
    try {
      const parent = await loginParent({ parentLoginSchema: { email: parentEmail, password: parentPassword } }).unwrap();
      setActiveParent(parent);
      setMessage("");
      setStep("child");
    } catch {
      setMessage("Login failed. Check the parent email and password.");
    }
  };
  const handleRegisterParent = async () => {
    if (!parentEmail || !parentPassword) {
      setMessage("Email and password are required.");
      return;
    }
    try {
      const parent = await registerParent({ parentCreateSchema: { email: parentEmail, password: parentPassword } }).unwrap();
      setActiveParent(parent);
      setMessage(`Parent created. ID ${parent.id}`);
      setStep("child");
    } catch {
      setMessage("Parent registration failed. Try a different email/password.");
    }
  };
  const continueWithChild = (child) => {
    saveSession({
      parentId: parentId,
      parentEmail: activeParent?.email,
      childId: child.id,
      childName: child.name,
    });
  };
  const handleCreateChild = async () => {
    if (!parentId || !childName) {
      setMessage("Parent ID and child name are required.");
      return;
    }
    try {
      const child = await createChild({
        childCreateSchema: {
          name: childName,
          dob: childDob || null,
          parent_id: parentId,
        },
      }).unwrap();
      saveSession({ parentId, parentEmail: activeParent?.email, childId: child.id, childName: child.name });
    } catch {
      setMessage("Child creation failed. Check the parent ID and try again.");
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:B.bg, fontFamily:"Georgia, 'Times New Roman', serif", maxWidth:430, margin:"0 auto", padding:"54px 22px" }}>
      <p style={{ color:B.creamMid, fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase" }}>Welcome to</p>
      <h1 style={{ color:B.cream, fontSize:34, margin:"4px 0 8px", fontFamily:"Georgia, serif" }}>Curi</h1>
      <p style={{ color:B.creamMid, fontSize:14, lineHeight:1.6, marginBottom:28 }}>Login with parent email, then choose which child profile to continue with.</p>

      <div style={{ background:B.bgDeep, borderRadius:22, padding:22, border:`1px solid ${B.creamLow}` }}>
        {step === "parent" ? (
          <>
            <SectionLabel>Parent Login</SectionLabel>
            <input value={parentEmail} onChange={e=>setParentEmail(e.target.value)} placeholder="Email" style={inputStyle} />
            <input value={parentPassword} onChange={e=>setParentPassword(e.target.value)} placeholder="Password" type="password" style={inputStyle} />
            <button onClick={handleLoginParent}
              style={{ width:"100%", padding:13, borderRadius:12, background:B.gold, color:B.dark, border:"none", fontWeight:700, marginBottom:18, cursor:isLoggingIn?"default":"pointer", fontFamily:"Georgia, serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              {isLoggingIn ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Logging in…</span>
                </>
              ) : (
                "Login"
              )}
            </button>

            <Divider />
            <p style={{ color:B.cream, fontSize:15, fontWeight:700, marginBottom:10, fontFamily:"Georgia, serif" }}>New parent?</p>
            <button onClick={handleRegisterParent}
              style={{ width:"100%", padding:13, borderRadius:12, background:B.terra, color:B.cream, border:"none", fontWeight:700, cursor:isRegisteringParent?"default":"pointer", fontFamily:"Georgia, serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              {isRegisteringParent ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Creating…</span>
                </>
              ) : (
                "Create Parent"
              )}
            </button>
          </>
        ) : (
          <>
            <SectionLabel>Child Profile</SectionLabel>
            <p style={{ color:B.creamMid, fontSize:13, lineHeight:1.5, marginBottom:14 }}>Logged in as {activeParent?.email}. Select a child to continue.</p>
            {isLoadingChildren && (
              <div style={{ marginBottom:12 }}>
                <Loading variant="inline" size="sm" message="Loading children…" />
              </div>
            )}
            {!isLoadingChildren && children.length === 0 && <p style={{ color:B.creamMid, fontSize:12, marginBottom:10 }}>No child profiles yet. Add one below.</p>}
            {children.map(child => (
              <button key={child.id} onClick={()=>continueWithChild(child)}
                style={{ width:"100%", padding:14, borderRadius:14, background:B.goldFade, color:B.cream, border:`1px solid rgba(201,139,44,0.35)`, marginBottom:10, textAlign:"left", cursor:"pointer", fontFamily:"Georgia, serif" }}>
                <span style={{ display:"block", color:B.gold, fontSize:16, fontWeight:700 }}>{child.name}</span>
                <span style={{ display:"block", color:B.creamMid, fontSize:12, marginTop:3 }}>{getAgeLabel(child.dob)} · Child ID {child.id}</span>
              </button>
            ))}

            <Divider />
            <p style={{ color:B.cream, fontSize:15, fontWeight:700, marginBottom:10, fontFamily:"Georgia, serif" }}>Create child</p>
            <input value={childName} onChange={e=>setChildName(e.target.value)} placeholder="Child name" style={inputStyle} />
            <input value={childDob} onChange={e=>setChildDob(e.target.value)} type="date" style={inputStyle} />
            <button onClick={handleCreateChild}
              style={{ width:"100%", padding:13, borderRadius:12, background:B.terra, color:B.cream, border:"none", fontWeight:700, cursor:isCreatingChild?"default":"pointer", fontFamily:"Georgia, serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              {isCreatingChild ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Creating…</span>
                </>
              ) : (
                "Create Child & Enter App"
              )}
            </button>
          </>
        )}
        {message && <p style={{ color:B.terra, fontSize:12, lineHeight:1.5, marginTop:14 }}>{message}</p>}
      </div>
    </div>
  );
}

// ── Manage Children row ────────────────────────────────────────────────────────
function ManageChildrenRow({ childId, parentSession, onSessionChange }) {
  const [open, setOpen] = useState(false);
  const parentId = Number(parentSession?.parentId);
  const { data: children = [], isFetching } = useGetParentChildrenQuery({ parentId }, { skip: !parentId });

  const switchChild = (child) => {
    const newSession = { ...parentSession, childId: child.id, childName: child.name };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(newSession)); } catch { /* ignore */ }
    onSessionChange(newSession);
    setOpen(false);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ width:"100%", background:B.bgDeep, borderRadius: open ? "14px 14px 0 0" : 14, padding:"17px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${B.creamLow}`, cursor:"pointer" }}
      >
        <span style={{ color:B.cream, fontSize:14, fontFamily:"Georgia, serif" }}>Manage Children</span>
        <span style={{ color:B.creamMid, fontSize:16, transition:"transform 0.2s", display:"inline-block", transform: open ? "rotate(90deg)" : "none" }}>›</span>
      </button>

      {open && (
        <div style={{ background:B.bgDeep, borderRadius:"0 0 14px 14px", borderTop:`1px solid ${B.creamLow}`, border:`1px solid ${B.creamLow}`, borderTopWidth:0, overflow:"hidden" }}>
          {isFetching ? (
            <div style={{ padding:"14px 18px" }}>
              <LoadingSpinner size="sm" />
            </div>
          ) : children.length === 0 ? (
            <p style={{ color:B.creamMid, fontSize:13, padding:"14px 18px" }}>No children found.</p>
          ) : (
            children.map(child => {
              const isActive = child.id === childId;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => !isActive && switchChild(child)}
                  style={{ width:"100%", textAlign:"left", background: isActive ? B.goldFade : "transparent", padding:"13px 18px", border:"none", borderTop:`1px solid ${B.creamLow}`, cursor: isActive ? "default" : "pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${B.gold}, ${B.terra})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                      👧
                    </div>
                    <div>
                      <p style={{ color: isActive ? B.gold : B.cream, fontWeight: isActive ? 700 : 400, fontSize:14, fontFamily:"Georgia, serif" }}>{child.name}</p>
                      <p style={{ color:B.creamMid, fontSize:11, marginTop:2 }}>{getAgeLabel(child.dob)}</p>
                    </div>
                  </div>
                  {isActive
                    ? <span style={{ color:B.gold, fontSize:14, fontWeight:700 }}>✓ Active</span>
                    : <span style={{ color:B.gold, fontSize:12, fontWeight:600 }}>Switch →</span>
                  }
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Profile ──────────────────────────────────────────────────────────────
function TabProfile({ childId, parentSession, onSessionChange }) {
  const [childNameInput, setChildNameInput] = useState("");
  const [childDob, setChildDob] = useState("");
  const { data: child, isFetching: isChildProfileLoading } = useGetChildChildrenChildIdGetQuery({ childId });
  const parentId = Number(parentSession?.parentId);
  const [createChild, { data: createdChild, isLoading: isCreatingChild, isError: didCreateChildFail }] = useCreateChildChildrenPostMutation();
  const childName = child?.name || "Leo";
  const handleCreateChild = () => {
    if (!childNameInput || !parentId) return;
    createChild({
      childCreateSchema: {
        name: childNameInput,
        dob: childDob || null,
        parent_id: parentId,
      },
    });
  };
  const profileInputStyle = {
    width:"100%",
    padding:"11px 12px",
    borderRadius:10,
    background:B.bgDeep,
    color:B.cream,
    border:`1px solid ${B.creamLow}`,
    marginBottom:8,
  };
  return (
    <div style={{ padding:"0 20px 110px" }}>
      {/* Child header */}
      <div style={{ background:B.bgDeep, borderRadius:20, padding:22, marginBottom:14, display:"flex", gap:16, alignItems:"center", border:`1px solid ${B.creamLow}` }}>
        {isChildProfileLoading ? (
          <Loading variant="section" size="sm" message="Loading profile…" />
        ) : (
          <>
            <div style={{ width:62, height:62, borderRadius:18, background:`linear-gradient(135deg, ${B.gold}, ${B.terra})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>
              👧
            </div>
            <div>
              <p style={{ color:B.cream, fontSize:21, fontWeight:700, fontFamily:"Georgia, serif" }}>{childName}</p>
              <p style={{ color:B.creamMid, fontSize:13 }}>{getAgeLabel(child?.dob)} · EYFS Growth Profile</p>
              <p style={{ color:B.gold, fontSize:12, marginTop:3, fontFamily:"Georgia, serif" }}>✦ Child ID {child?.id || childId}</p>
            </div>
          </>
        )}
      </div>

      {/* <button type="button" onClick={() => signOutAndClearSession(onSessionChange)}
        style={{ width:"100%", padding:13, borderRadius:14, background:B.creamFade, color:B.cream, border:`1px solid ${B.creamLow}`, fontWeight:700, marginBottom:10, cursor:"pointer", fontFamily:"Georgia, serif" }}>
        Switch parent / child
      </button> */}
      <button type="button" onClick={() => signOutAndClearSession(onSessionChange)}
        style={{ width:"100%", padding:13, borderRadius:14, background:"transparent", color:B.terra, border:`1.5px solid ${B.terra}`, fontWeight:700, marginBottom:22, cursor:"pointer", fontFamily:"Georgia, serif" }}>
        Log out
      </button>

      {/* ── Account Setup ── */}
      <SectionLabel>Account Setup</SectionLabel>
      <div style={{ background:B.bgDeep, borderRadius:16, padding:18, marginBottom:18, border:`1px solid ${B.creamLow}` }}>
        <p style={{ color:B.cream, fontSize:14, fontWeight:700, marginBottom:10, fontFamily:"Georgia, serif" }}>Add Child</p>
        <p style={{ color:B.creamMid, fontSize:12, lineHeight:1.5, marginBottom:12 }}>This child will be linked to the logged-in parent automatically.</p>
        <input value={childNameInput} onChange={e=>setChildNameInput(e.target.value)} placeholder="Child name" style={profileInputStyle} />
        <input value={childDob} onChange={e=>setChildDob(e.target.value)} type="date" style={profileInputStyle} />
        <button onClick={handleCreateChild}
          style={{ width:"100%", padding:12, borderRadius:10, background:B.terra, color:B.cream, border:"none", fontWeight:700, cursor:isCreatingChild?"default":"pointer", fontFamily:"Georgia, serif", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          {isCreatingChild ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Adding…</span>
            </>
          ) : (
            "Add Child"
          )}
        </button>
        {createdChild && <p style={{ color:B.gold, fontSize:12, marginTop:8 }}>Child created: {createdChild.name} #{createdChild.id}</p>}
        {didCreateChildFail && <p style={{ color:B.terra, fontSize:12, marginTop:8 }}>Child creation failed.</p>}
      </div>

      {/* ── Community ── */}
      <SectionLabel>Curi Parent Community</SectionLabel>
      {[
        { name:"Emma's Mum", time:"2 hours ago", text:"My little one recognised every single body part today — Curious Buddy is incredible!", likes:24 },
        { name:"Jack's Dad",  time:"Yesterday",  text:"After one month the Communication radar has visibly grown. Completely worth it.", likes:38 },
      ].map((p,i) => (
        <div key={i} style={{ background:B.bgDeep, borderRadius:16, padding:18, marginBottom:10, border:`1px solid ${B.creamLow}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ color:B.cream, fontWeight:700, fontSize:14, fontFamily:"Georgia, serif" }}>{p.name}</span>
            <span style={{ color:B.creamMid, fontSize:11 }}>{p.time}</span>
          </div>
          <p style={{ color:B.creamMid, fontSize:13, lineHeight:1.6, marginBottom:10 }}>{p.text}</p>
          <p style={{ color:B.terra, fontSize:12 }}>♥ {p.likes}</p>
        </div>
      ))}

      {/* ── Settings ── */}
      <div style={{ marginTop:22, marginBottom:14 }}>
        <SectionLabel>Settings</SectionLabel>
      </div>

      <ManageChildrenRow childId={childId} parentSession={parentSession} onSessionChange={onSessionChange} />

      {/* Device Pairing — commented out
      <div style={{ background:B.bgDeep, borderRadius:14, padding:"17px 18px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${B.creamLow}` }}>
        <span style={{ color:B.cream, fontSize:14, fontFamily:"Georgia, serif" }}>Device Pairing</span>
        <span style={{ color:B.creamMid, fontSize:16 }}>›</span>
      </div>
      */}

      {["Privacy & Data","Contact Support"].map(s => (
        <div key={s} style={{ background:B.bgDeep, borderRadius:14, padding:"17px 18px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${B.creamLow}` }}>
          <span style={{ color:B.cream, fontSize:14, fontFamily:"Georgia, serif" }}>{s}</span>
          <span style={{ color:B.creamMid, fontSize:16 }}>›</span>
        </div>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function CuriSplash() {
  // Rendered during SSR + first client paint so we never flash the login UI on
  // reload while localStorage is being read.
  return (
    <div
      style={{
        minHeight: "100vh",
        background: B.bg,
        maxWidth: 430,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            color: B.creamMid,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            margin: "0 0 10px",
          }}
        >
          Curi
        </p>
        <LoadingSpinner size="md" />
      </div>
    </div>
  );
}

export default function CuriApp() {
  const [tab, setTab] = useState(0);
  const [showNudge, setShowNudge] = useState(false);
  const scrollRef = useRef(null);
  const [session, setSession] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_KEY);
      if (savedSession) {
        setSession(JSON.parse(savedSession));
      }
    } catch {
      try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    }
    setIsHydrated(true);
  }, []);

  const tabs = [
    { label:"Home",       icon:"⌂"  },
    { label:"Growth",     icon:"◎"  },
    { label:"Curriculum", icon:"⊞"  },
    { label:"Profile",    icon:"◉"  },
  ];

  // Stay on the splash until we've checked localStorage on the client. This
  // prevents a 1-frame flash of the Onboarding screen on every reload.
  if (!isHydrated) {
    return <CuriSplash />;
  }

  if (!session?.childId) {
    return <Onboarding onReady={setSession} />;
  }

  const childId = Number(session.childId);
  const parentId = Number(session.parentId);
  const fallbackParentName = session.parentEmail ? session.parentEmail.split("@")[0] : undefined;
  const isHomeTab = tab === 0;

  return (
    <div style={{ minHeight:"100vh", background:isHomeTab ? "#3e4f57" : B.bg, fontFamily:"Georgia, 'Times New Roman', serif", position:"relative", maxWidth:430, margin:"0 auto" }}>
      {/* Shell header (hidden on Home – HomeScreen renders its own header) */}
      {!isHomeTab && (
        <div style={{ padding:"16px 22px 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <p style={{ color:B.creamMid, fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Good morning</p>
              <h1 style={{ color:B.cream, fontSize:28, fontWeight:700, margin:0, letterSpacing:"-0.02em", fontFamily:"Georgia, serif" }}>
                Curi
              </h1>
            </div>
            <div style={{ width:46, height:46, borderRadius:15, background:`linear-gradient(135deg, ${B.gold}, ${B.terra})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
              👧
            </div>
          </div>
          {/* Decorative line */}
          <div style={{ marginTop:16, height:1, background:`linear-gradient(90deg, ${B.gold}, transparent)` }} />
        </div>
      )}

      {/* Content */}
      <div ref={scrollRef} style={{ overflowY:"auto" }}>
        {tab===0 && (
          <HomeScreen
            parentId={parentId}
            childId={childId}
            fallbackParentName={fallbackParentName}
          />
        )}
        {tab===1 && <TabGrowth childId={childId} />}
        {tab===2 && <TabCurriculum childId={childId} parentId={parentId} />}
        {tab===3 && <TabProfile childId={childId} parentSession={session} onSessionChange={setSession} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:`${B.bgDeep}F2`, backdropFilter:"blur(20px)", borderTop:`1px solid ${B.creamLow}`, padding:"13px 0 28px", display:"flex" }}>
        {tabs.map((t,i) => (
          <button key={i} onClick={()=>{ setTab(i); scrollRef.current?.scrollTo({ top: 0, behavior: "instant" }); }}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", padding:"3px 0" }}>
            <span style={{ fontSize:18, color:tab===i ? B.gold : B.creamMid, transition:"color 0.2s" }}>{t.icon}</span>
            <span style={{ fontSize:9, color:tab===i ? B.gold : B.creamMid, fontWeight:tab===i?700:400, letterSpacing:"0.06em", textTransform:"uppercase" }}>{t.label}</span>
            {tab===i && <div style={{ width:18, height:2, background:B.gold, borderRadius:99, marginTop:1 }} />}
          </button>
        ))}
      </div>

      {showNudge && <NudgeModal onClose={()=>setShowNudge(false)} />}
    </div>
  );
}
