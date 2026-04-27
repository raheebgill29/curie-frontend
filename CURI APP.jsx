"use client";

import { useState } from "react";
import { useHealthCheckHealthGetQuery } from "./src/lib/api/generated/healthApi";
import {
  useGetChildChildrenChildIdGetQuery,
  useGetChildInsightsChildrenChildIdInsightsGetQuery,
  useGetChildProgressChildrenChildIdProgressGetQuery,
} from "./src/lib/api/generated/childrenApi";
import {
  useGetLessonsByThemeThemesThemeIdLessonsGetQuery,
  useGetThemesThemesGetQuery,
} from "./src/lib/api/generated/curriculumApi";
import { useGetChildSessionsSessionsChildIdGetQuery } from "./src/lib/api/generated/sessionsApi";
import { useGenerateSessionToyGenerateSessionPostMutation } from "./src/lib/api/generated/toyApi";

// ── Brand Palette ─────────────────────────────────────────────────────────────
const B = {
  bg:       "#5C707A",   // main background — slate teal
  bgDeep:   "#3f4d51",   // darker panels / nav
  bgCard:   "#4a6068",   // card surface
  bgLight:  "#6a7f89",   // lighter surface / hover
  cream:    "#f7f2eb",   // primary text + light surfaces
  gold:     "#c98b2c",   // accent / highlights / CTA
  terra:    "#bf5f49",   // warning / emphasis / secondary CTA
  dark:     "#3f4d51",   // deep text / nav bg
  creamFade:"rgba(247,242,235,0.12)",  // subtle card bg
  creamMid: "rgba(247,242,235,0.55)",  // secondary text
  creamLow: "rgba(247,242,235,0.25)",  // muted / borders
  goldFade: "rgba(201,139,44,0.18)",
  terraFade:"rgba(191,95,73,0.18)",
};

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

const WEEKLY_PLAN = [
  {
    day:"Mon", label:"Monday", focus:"Physical Development",
    type:"Songs + Movement", status:"done", time:"8:30–8:50",
    score:5, participation:92,
    content:["Head Shoulders Knees & Toes","Body Guard Song","5 interactive movement rounds"],
    aiLog:"Leo did brilliantly today! He accurately identified all body parts and creatively used his arms to mimic a giraffe. Both Physical Development and Creative Arts showed notable improvement.",
    questions:["Can you point to where your knees are?","If your arms were really, really long, what fun things could you do?"],
  },
  {
    day:"Tue", label:"Tuesday", focus:"Communication & Language",
    type:"Story + Discussion", status:"today", time:"8:30–8:55",
    score:null, participation:null,
    content:["2 body-themed stories","Socratic Q&A session"],
    aiLog:null,
    questions:["Why did the little bear go to the doctor in the story?","If you were the little bear, what would you do?"],
  },
  { day:"Wed", label:"Wednesday", focus:"Creative Arts",        type:"Drama + Role-play",     status:"upcoming", time:"8:30–9:00", score:null, participation:null, content:["Guided role-play script","Creative body expression"],    aiLog:null, questions:[] },
  { day:"Thu", label:"Thursday",  focus:"Understanding World",  type:"Science Exploration",   status:"upcoming", time:"8:30–8:50", score:null, participation:null, content:["Natural phenomena exploration","Animal classification game"], aiLog:null, questions:[] },
  { day:"Fri", label:"Friday",    focus:"Mathematics",          type:"Maths Games + Puzzles", status:"upcoming", time:"8:30–8:45", score:null, participation:null, content:["Number matching activity","Shape & block challenge"],        aiLog:null, questions:[] },
  { day:"Sat", label:"Saturday",  focus:"PSE",                  type:"Social Role-play",      status:"upcoming", time:"10:00–10:30",score:null, participation:null, content:["Emotion expression game","Collaborative problem-solving"],   aiLog:null, questions:[] },
  { day:"Sun", label:"Sunday",    focus:"Weekly Review",        type:"Free Talk + Review",    status:"upcoming", time:"Free play",  score:null, participation:null, content:["Weekly knowledge recap","Open-ended free conversation"],     aiLog:null, questions:[] },
];

const AI_INSIGHTS = [
  { icon:"💬", text:"Leo's emotional vocabulary has grown — 5 new words introduced today", domain:"CL" },
  { icon:"🧠", text:"Questions about natural phenomena are infrequent — consider nature exploration", domain:"UW" },
  { icon:"🎨", text:"Creative movement expression is above average for his age — keep nurturing it!", domain:"CA" },
];

const DEMO_CHILD_ID = Number(process.env.NEXT_PUBLIC_DEMO_CHILD_ID || 1) || 1;

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

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
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

function mapInsights(insightsData) {
  const apiInsights = insightsData?.insights || [];
  if (!apiInsights.length) return AI_INSIGHTS;

  return apiInsights.slice(0, 3).map((item, index) => ({
    icon: INSIGHT_ICONS[index % INSIGHT_ICONS.length],
    text: item.insight,
    domain: "AI",
  }));
}

function lessonToPlanDay(lesson, index) {
  const dayIndex = Math.max(0, Math.min(6, (lesson.day_number || index + 1) - 1));
  const learningGoals = lesson.learning_goals || {};
  const contentJson = learningGoals.content_json || {};
  const socratic = contentJson.seven_step_structure?.step_4_socratic;
  const questions = [
    socratic?.opening_question,
    ...Object.values(socratic?.age_profiles || {}).flatMap(profile => [
      profile?.guiding_question,
      profile?.extension_question,
    ]),
  ].filter(Boolean).slice(0, 2);
  const content = [
    learningGoals.title,
    contentJson.ai_action,
    contentJson.activity_narrative,
    ...(contentJson.learning_goals || []),
  ].filter(Boolean).slice(0, 3);

  return {
    day: DAY_SHORTS[dayIndex],
    label: DAY_LABELS[dayIndex],
    focus: (learningGoals.eyfs_focus || []).join(" + ") || learningGoals.subject_lens || "EYFS Learning",
    type: lesson.lesson_type || "Guided Session",
    status: dayIndex === 0 ? "done" : dayIndex === 1 ? "today" : "upcoming",
    time: "Curious Buddy",
    score: dayIndex === 0 ? 5 : null,
    participation: dayIndex === 0 ? 92 : null,
    content: content.length ? content : ["AI-guided lesson content", "Socratic conversation prompts"],
    aiLog: null,
    questions,
    lessonId: lesson.id,
  };
}

function mapLessonsToWeeklyPlan(lessons) {
  return lessons?.length ? lessons.map(lessonToPlanDay) : WEEKLY_PLAN;
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
    done:     { label:"Completed",  bg:"rgba(201,139,44,0.18)",  color:B.gold  },
    today:    { label:"Today",      bg:"rgba(191,95,73,0.22)",   color:B.terra },
    upcoming: { label:"Upcoming",   bg:"rgba(247,242,235,0.08)", color:B.creamMid },
  };
  const s = map[status];
  return <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:99, background:s.bg, color:s.color, letterSpacing:"0.04em", textTransform:"uppercase" }}>{s.label}</span>;
}

function Stars({ n }) {
  return <span style={{ color:B.gold, fontSize:14, letterSpacing:2 }}>{"★".repeat(n)}{"☆".repeat(5-n)}</span>;
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
function DomainSheet({ domain, onClose, onEnhance }) {
  const [enhanced, setEnhanced] = useState(false);
  const history = [45,48,52,50,domain.score];
  const maxH = Math.max(...history);
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

        <div style={{ marginBottom:22 }}>
          <p style={{ color:B.creamMid, fontSize:11, marginBottom:10, letterSpacing:"0.05em", textTransform:"uppercase" }}>5-Day Trend</p>
          <div style={{ display:"flex", alignItems:"flex-end", gap:7, height:52 }}>
            {history.map((v,i) => (
              <div key={i} style={{ flex:1, background:i===history.length-1 ? domain.color : B.creamFade, borderRadius:"4px 4px 0 0", height:`${(v/maxH)*100}%`, transition:"height 0.8s ease", border:`1px solid ${i===history.length-1 ? "transparent" : B.creamLow}` }} />
            ))}
          </div>
        </div>

        <Divider />
        <SectionLabel>AI Observation Log</SectionLabel>
        <div style={{ background:B.creamFade, borderRadius:14, padding:16, marginBottom:18, border:`1px solid ${B.creamLow}` }}>
          <p style={{ color:B.creamMid, fontSize:13, lineHeight:1.65 }}>
            Over the past 3 days, Leo has shown relatively low active exploration in <strong style={{color:B.cream}}>"{domain.label}"</strong>. Structured booster content is recommended to strengthen this dimension.
          </p>
        </div>

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
function DaySheet({ day, onClose }) {
  const [generateSession, { data: generatedSession, isLoading: isGenerating, isError: didGenerateFail }] = useGenerateSessionToyGenerateSessionPostMutation();
  const startSession = () => {
    if (!day.lessonId) return;
    generateSession({
      generateSessionRequest: {
        child_id: DEMO_CHILD_ID,
        lesson_id: day.lessonId,
      },
    });
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
        {day.content.map((c,i) => (
          <div key={i} style={{ display:"flex", gap:12, marginBottom:10, alignItems:"flex-start" }}>
            <span style={{ color:B.gold, fontSize:11, fontWeight:700, minWidth:22, fontFamily:"Georgia, serif" }}>0{i+1}</span>
            <span style={{ color:B.creamMid, fontSize:14, lineHeight:1.5 }}>{c}</span>
          </div>
        ))}

        {day.lessonId && (
          <div style={{ margin:"18px 0", background:B.creamFade, borderRadius:14, padding:14, border:`1px solid ${B.creamLow}` }}>
            <button onClick={startSession}
              style={{ width:"100%", padding:12, borderRadius:11, background:B.gold, color:B.dark, fontWeight:700, border:"none", cursor:isGenerating?"default":"pointer", fontFamily:"Georgia, serif" }}>
              {isGenerating ? "Starting Curious Buddy..." : "Start AI Toy Session"}
            </button>
            {generatedSession && (
              <p style={{ color:B.creamMid, fontSize:12, lineHeight:1.55, marginTop:12 }}>
                <strong style={{ color:B.gold }}>First message:</strong> {generatedSession.first_message}
              </p>
            )}
            {didGenerateFail && <p style={{ color:B.terra, fontSize:12, marginTop:10 }}>Could not start this session. Check the backend data for this child and lesson.</p>}
          </div>
        )}

        {day.questions.length>0 && (
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

        {day.status==="done" && (
          <>
            <Divider />
            <SectionLabel>Performance</SectionLabel>
            <div style={{ display:"flex", gap:12, marginBottom:18 }}>
              <div style={{ flex:1, background:B.creamFade, borderRadius:12, padding:14, textAlign:"center", border:`1px solid ${B.creamLow}` }}>
                <Stars n={day.score} /><p style={{ color:B.creamMid, fontSize:11, marginTop:5 }}>Overall Rating</p>
              </div>
              <div style={{ flex:1, background:B.creamFade, borderRadius:12, padding:14, textAlign:"center", border:`1px solid ${B.creamLow}` }}>
                <p style={{ color:B.gold, fontSize:24, fontWeight:700, fontFamily:"Georgia, serif" }}>{day.participation}%</p>
                <p style={{ color:B.creamMid, fontSize:11 }}>Engagement</p>
              </div>
            </div>
          </>
        )}

        <button onClick={onClose} style={{ width:"100%", padding:14, borderRadius:12, background:B.creamFade, color:B.cream, border:`1px solid ${B.creamLow}`, cursor:"pointer", fontWeight:600 }}>Close</button>
      </div>
    </div>
  );
}

// ── Tab: Dashboard ────────────────────────────────────────────────────────────
function TabDashboard({ onNudge }) {
  const [mode, setMode] = useState("Learning");
  const [vol, setVol] = useState(70);
  const { data: health, isFetching: isHealthFetching } = useHealthCheckHealthGetQuery();
  const { data: sessions } = useGetChildSessionsSessionsChildIdGetQuery({ childId: DEMO_CHILD_ID, page: 1, pageSize: 5 });
  const { data: insightsData } = useGetChildInsightsChildrenChildIdInsightsGetQuery({ childId: DEMO_CHILD_ID });
  const modes = ["Learning","Sleep","Free Chat"];
  const aiInsights = mapInsights(insightsData);
  const onlineLabel = health?.status ? "Curious Buddy Online" : isHealthFetching ? "Checking Buddy Status" : "Curious Buddy Offline";
  const latestSession = sessions?.items?.[0];

  return (
    <div style={{ padding:"0 20px 110px" }}>
      {/* Live status card */}
      <div style={{ background:B.bgDeep, borderRadius:20, padding:22, marginBottom:14, border:`1px solid ${B.creamLow}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:health?.status ? B.gold : B.terra, boxShadow:`0 0 10px ${health?.status ? B.gold : B.terra}` }} />
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

      {/* Stats */}
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
        {aiInsights.map((ins,i) => (
          <div key={i} style={{ display:"flex", gap:13, marginBottom:i<aiInsights.length-1?16:0, paddingBottom:i<aiInsights.length-1?16:0, borderBottom:i<aiInsights.length-1?`1px solid ${B.creamLow}`:"none" }}>
            <span style={{ fontSize:17, lineHeight:1.5 }}>{ins.icon}</span>
            <p style={{ color:B.creamMid, fontSize:13, lineHeight:1.6 }}>{ins.text}</p>
          </div>
        ))}
      </div>

      {/* Quick controls */}
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
    </div>
  );
}

// ── Tab: Growth ───────────────────────────────────────────────────────────────
function TabGrowth() {
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [enhanced, setEnhanced] = useState([]);
  const { data: child } = useGetChildChildrenChildIdGetQuery({ childId: DEMO_CHILD_ID });
  const { data: progressData, isFetching, isError } = useGetChildProgressChildrenChildIdProgressGetQuery({ childId: DEMO_CHILD_ID });
  const domains = mapProgressToDomains(progressData);
  const childName = child?.name || "Leo";
  return (
    <div style={{ padding:"0 20px 110px" }}>
      <div style={{ background:B.bgDeep, borderRadius:20, padding:24, marginBottom:14, textAlign:"center", border:`1px solid ${B.creamLow}` }}>
        <SectionLabel>EYFS Development Radar</SectionLabel>
        <p style={{ color:B.cream, fontWeight:700, fontSize:16, marginBottom:4, fontFamily:"Georgia, serif" }}>{childName}'s Growth Profile</p>
        <p style={{ color:B.creamMid, fontSize:12, marginBottom:22 }}>{isFetching ? "Loading backend progress..." : isError ? "Showing saved demo progress" : "Tap any dimension to view details & boost"}</p>
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
        <DomainSheet domain={selectedDomain} onClose={()=>setSelectedDomain(null)} onEnhance={d=>setEnhanced(prev=>[...prev,d.key])} />
      )}
    </div>
  );
}

// ── Tab: Curriculum ───────────────────────────────────────────────────────────
function TabCurriculum() {
  const [selectedDay, setSelectedDay] = useState(null);
  const [building, setBuilding] = useState(false);
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState([]);
  const [interests, setInterests] = useState([]);
  const [generated, setGenerated] = useState(false);
  const goalOptions     = ["Communication","Maths & Logic","Creative Arts","Social & Emotional","Nature & Science"];
  const interestOptions = ["Dinosaurs","Space","Ocean","Animals","Superheroes","Cooking"];
  const { data: themes = [], isFetching: isLoadingThemes } = useGetThemesThemesGetQuery();
  const selectedTheme = themes[0];
  const { data: lessons = [], isFetching: isLoadingLessons } = useGetLessonsByThemeThemesThemeIdLessonsGetQuery({ themeId: selectedTheme?.id || 1 });
  const weeklyPlan = mapLessonsToWeeklyPlan(lessons);
  const themeTitle = selectedTheme?.title || "Body Awareness";

  if (building) {
    const stepLabels = ["Goals","Interests","Generate","Sync"];
    return (
      <div style={{ padding:"0 20px 110px" }}>
        <button onClick={()=>{ setBuilding(false); setStep(0); setGoals([]); setInterests([]); setGenerated(false); }}
          style={{ background:"none", border:"none", color:B.gold, fontSize:14, cursor:"pointer", marginBottom:18, fontFamily:"Georgia, serif" }}>← Back</button>

        {/* Step bar */}
        <div style={{ display:"flex", gap:6, marginBottom:28 }}>
          {stepLabels.map((s,i) => (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
              <div style={{ height:3, width:"100%", borderRadius:99, background:i<=step ? B.gold : B.creamLow }} />
              <span style={{ fontSize:9, color:i<=step ? B.gold : B.creamMid, fontWeight:i===step?700:400, letterSpacing:"0.06em", textTransform:"uppercase" }}>{s}</span>
            </div>
          ))}
        </div>

        {step===0 && (
          <div>
            <SectionLabel>Step 1 of 4</SectionLabel>
            <p style={{ color:B.cream, fontSize:20, fontWeight:700, marginBottom:6, fontFamily:"Georgia, serif" }}>What skills to focus on?</p>
            <p style={{ color:B.creamMid, fontSize:13, marginBottom:22, lineHeight:1.5 }}>Select one or more areas to develop this week</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:32 }}>
              {goalOptions.map(g=>(
                <button key={g} onClick={()=>setGoals(p=>p.includes(g)?p.filter(x=>x!==g):[...p,g])}
                  style={{ padding:"10px 18px", borderRadius:99, border:`1.5px solid ${goals.includes(g)?B.gold:B.creamLow}`, background:goals.includes(g)?B.goldFade:"transparent", color:goals.includes(g)?B.gold:B.creamMid, fontSize:13, cursor:"pointer", transition:"all 0.2s", fontFamily:"Georgia, serif" }}>
                  {g}
                </button>
              ))}
            </div>
            <button onClick={()=>goals.length&&setStep(1)}
              style={{ width:"100%", padding:15, borderRadius:12, background:goals.length?B.gold:B.creamFade, color:goals.length?B.dark:B.creamMid, fontWeight:700, border:`1px solid ${goals.length?B.gold:B.creamLow}`, cursor:goals.length?"pointer":"default", fontFamily:"Georgia, serif" }}>
              Next →
            </button>
          </div>
        )}

        {step===1 && (
          <div>
            <SectionLabel>Step 2 of 4</SectionLabel>
            <p style={{ color:B.cream, fontSize:20, fontWeight:700, marginBottom:6, fontFamily:"Georgia, serif" }}>What's Leo into right now?</p>
            <p style={{ color:B.creamMid, fontSize:13, marginBottom:22, lineHeight:1.5 }}>AI will weave these themes into the sessions</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:32 }}>
              {interestOptions.map(g=>(
                <button key={g} onClick={()=>setInterests(p=>p.includes(g)?p.filter(x=>x!==g):[...p,g])}
                  style={{ padding:"10px 18px", borderRadius:99, border:`1.5px solid ${interests.includes(g)?B.terra:B.creamLow}`, background:interests.includes(g)?B.terraFade:"transparent", color:interests.includes(g)?B.terra:B.creamMid, fontSize:13, cursor:"pointer", transition:"all 0.2s", fontFamily:"Georgia, serif" }}>
                  {g}
                </button>
              ))}
            </div>
            <button onClick={()=>interests.length&&setStep(2)}
              style={{ width:"100%", padding:15, borderRadius:12, background:interests.length?B.terra:B.creamFade, color:interests.length?B.cream:B.creamMid, fontWeight:700, border:`1px solid ${interests.length?B.terra:B.creamLow}`, cursor:interests.length?"pointer":"default", fontFamily:"Georgia, serif" }}>
              ✦ Generate AI Curriculum
            </button>
          </div>
        )}

        {step===2 && (
          <div>
            {!generated ? (
              <div style={{ textAlign:"center", padding:"44px 0" }}>
                <div style={{ fontSize:42, marginBottom:18, color:B.gold }}>◈</div>
                <p style={{ color:B.cream, fontSize:18, fontWeight:700, fontFamily:"Georgia, serif" }}>Crafting your curriculum...</p>
                <p style={{ color:B.creamMid, fontSize:13, marginTop:8, lineHeight:1.5 }}>Built on EYFS framework & Socratic Method</p>
                <button onClick={()=>setGenerated(true)} style={{ marginTop:26, padding:"13px 36px", borderRadius:12, background:B.gold, color:B.dark, border:"none", cursor:"pointer", fontWeight:700, fontFamily:"Georgia, serif" }}>View Curriculum</button>
              </div>
            ) : (
              <div>
                <SectionLabel>Your Personalised Plan</SectionLabel>
                <p style={{ color:B.cream, fontSize:20, fontWeight:700, marginBottom:16, fontFamily:"Georgia, serif" }}>AI-Generated Curriculum</p>
                <div style={{ background:B.goldFade, borderRadius:16, padding:18, marginBottom:22, border:`1px solid rgba(201,139,44,0.25)` }}>
                  <p style={{ color:B.gold, fontSize:13, fontWeight:700, marginBottom:10, fontFamily:"Georgia, serif" }}>Theme: {interests[0]||"Custom"} Adventure</p>
                  <p style={{ color:B.creamMid, fontSize:14, lineHeight:1.7 }}>
                    Curious Buddy will explore {interests.join(" & ")} adventures and embed:<br />
                    · {goals.includes("Maths & Logic")?"5 logic & maths puzzles":"5 interactive activities"}<br />
                    · {goals.includes("Communication")?"3 speaking & listening exercises":"3 creative challenges"}<br />
                    · A full 7-day EYFS-structured session plan
                  </p>
                </div>
                <button onClick={()=>setStep(3)} style={{ width:"100%", padding:15, borderRadius:12, background:B.gold, color:B.dark, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"Georgia, serif" }}>Sync to Curious Buddy ✦</button>
              </div>
            )}
          </div>
        )}

        {step===3 && (
          <div style={{ textAlign:"center", padding:"44px 0" }}>
            <div style={{ fontSize:52, marginBottom:16 }}>✦</div>
            <p style={{ color:B.gold, fontSize:22, fontWeight:700, fontFamily:"Georgia, serif" }}>Sync Complete</p>
            <p style={{ color:B.creamMid, fontSize:14, marginTop:10, lineHeight:1.6 }}>Curious Buddy will begin your<br />personalised curriculum next session</p>
            <button onClick={()=>{ setBuilding(false); setStep(0); setGoals([]); setInterests([]); setGenerated(false); }}
              style={{ marginTop:26, padding:"12px 34px", borderRadius:12, background:B.creamFade, color:B.cream, border:`1px solid ${B.creamLow}`, cursor:"pointer", fontWeight:600 }}>
              Back to Curriculum
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding:"0 20px 110px" }}>
      {/* Week header */}
      <div style={{ background:B.bgDeep, borderRadius:20, padding:22, marginBottom:14, border:`1px solid ${B.creamLow}` }}>
        <SectionLabel>This Week's Theme</SectionLabel>
        <p style={{ color:B.cream, fontSize:24, fontWeight:700, marginBottom:12, fontFamily:"Georgia, serif" }}>{themeTitle} 🧍</p>
        <div style={{ display:"flex", gap:20 }}>
          {[
            { label:"Progress",     value:`${Math.min(1, weeklyPlan.length)} / ${weeklyPlan.length || 7}` },
            { label:"Avg Engagement",value:"92%"  },
            { label:"Backend",   value:isLoadingThemes || isLoadingLessons ? "Syncing" : selectedTheme ? "Live" : "Demo" },
          ].map(s => (
            <div key={s.label}>
              <p style={{ color:B.creamMid, fontSize:10, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>{s.label}</p>
              <p style={{ color:B.cream, fontWeight:700, fontSize:14, fontFamily:"Georgia, serif" }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {weeklyPlan.map(day => (
        <div key={day.lessonId || day.day} onClick={()=>setSelectedDay(day)}
          style={{ background:B.bgDeep, borderRadius:16, padding:18, marginBottom:10, cursor:"pointer", border:day.status==="today"?`1px solid rgba(191,95,73,0.5)`:  `1px solid ${B.creamLow}`, transition:"border 0.2s" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <div style={{ display:"flex", gap:13, alignItems:"center" }}>
              <div style={{ width:42, height:42, borderRadius:13, background:day.status==="done"?B.goldFade:day.status==="today"?B.terraFade:B.creamFade, display:"flex", alignItems:"center", justifyContent:"center", border:`1px solid ${day.status==="done"?B.gold:day.status==="today"?B.terra:B.creamLow}` }}>
                <span style={{ fontSize:16 }}>{day.status==="done"?"✦":day.status==="today"?"◎":"◌"}</span>
              </div>
              <div>
                <p style={{ color:B.cream, fontWeight:700, fontSize:14, fontFamily:"Georgia, serif" }}>{day.label}</p>
                <p style={{ color:B.creamMid, fontSize:12, marginTop:1 }}>{day.type}</p>
              </div>
            </div>
            <Badge status={day.status} />
          </div>
          <div style={{ display:"flex", gap:16, marginBottom:day.status==="done"?10:0 }}>
            <p style={{ color:B.creamMid, fontSize:11 }}>🎯 {day.focus}</p>
            <p style={{ color:B.creamMid, fontSize:11 }}>⏱ {day.time}</p>
          </div>
          {day.status==="done" && (
            <>
              <ProgressBar value={day.participation} color={B.gold} height={4} />
              <p style={{ color:B.gold, fontSize:11, marginTop:5 }}>Engagement {day.participation}%</p>
            </>
          )}
        </div>
      ))}

      <button onClick={()=>setBuilding(true)}
        style={{ width:"100%", padding:16, borderRadius:16, background:B.gold, color:B.dark, fontWeight:700, fontSize:15, border:"none", cursor:"pointer", marginTop:8, fontFamily:"Georgia, serif", letterSpacing:"0.02em" }}>
        ✦ Build a New Personalised Plan
      </button>

      {selectedDay && <DaySheet day={selectedDay} onClose={()=>setSelectedDay(null)} />}
    </div>
  );
}

// ── Tab: Profile ──────────────────────────────────────────────────────────────
function TabProfile() {
  const { data: child } = useGetChildChildrenChildIdGetQuery({ childId: DEMO_CHILD_ID });
  const childName = child?.name || "Leo";
  return (
    <div style={{ padding:"0 20px 110px" }}>
      <div style={{ background:B.bgDeep, borderRadius:20, padding:22, marginBottom:14, display:"flex", gap:16, alignItems:"center", border:`1px solid ${B.creamLow}` }}>
        <div style={{ width:62, height:62, borderRadius:18, background:`linear-gradient(135deg, ${B.gold}, ${B.terra})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>
          👧
        </div>
        <div>
          <p style={{ color:B.cream, fontSize:21, fontWeight:700, fontFamily:"Georgia, serif" }}>{childName}</p>
          <p style={{ color:B.creamMid, fontSize:13 }}>{getAgeLabel(child?.dob)} · EYFS Growth Profile</p>
          <p style={{ color:B.gold, fontSize:12, marginTop:3, fontFamily:"Georgia, serif" }}>✦ Child ID {child?.id || DEMO_CHILD_ID}</p>
        </div>
      </div>

      <SectionLabel>Curiouser Parent Community</SectionLabel>
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

      <div style={{ marginTop:22, marginBottom:14 }}>
        <SectionLabel>Settings</SectionLabel>
      </div>
      {["Manage Children","Device Pairing","Privacy & Data","Contact Support"].map(s => (
        <div key={s} style={{ background:B.bgDeep, borderRadius:14, padding:"17px 18px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center", border:`1px solid ${B.creamLow}` }}>
          <span style={{ color:B.cream, fontSize:14, fontFamily:"Georgia, serif" }}>{s}</span>
          <span style={{ color:B.creamMid, fontSize:16 }}>›</span>
        </div>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function CuriouserApp() {
  const [tab, setTab] = useState(0);
  const [showNudge, setShowNudge] = useState(false);

  const tabs = [
    { label:"Home",       icon:"⌂"  },
    { label:"Growth",     icon:"◎"  },
    { label:"Curriculum", icon:"⊞"  },
    { label:"Profile",    icon:"◉"  },
  ];

  return (
    <div style={{ minHeight:"100vh", background:B.bg, fontFamily:"Georgia, 'Times New Roman', serif", position:"relative", maxWidth:430, margin:"0 auto" }}>
      {/* Status bar */}
      <div style={{ padding:"14px 22px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ color:B.creamMid, fontSize:12, fontFamily:"Georgia, serif" }}>9:41</span>
        <div style={{ display:"flex", gap:6 }}>
          {["▲▲▲","WiFi","⬛"].map(i=><span key={i} style={{ color:B.creamLow, fontSize:10 }}>{i}</span>)}
        </div>
      </div>

      {/* Header */}
      <div style={{ padding:"16px 22px 20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ color:B.creamMid, fontSize:12, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>Good morning</p>
            <h1 style={{ color:B.cream, fontSize:28, fontWeight:700, margin:0, letterSpacing:"-0.02em", fontFamily:"Georgia, serif" }}>
              Curiouser
            </h1>
          </div>
          <div style={{ width:46, height:46, borderRadius:15, background:`linear-gradient(135deg, ${B.gold}, ${B.terra})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
            👧
          </div>
        </div>
        {/* Decorative line */}
        <div style={{ marginTop:16, height:1, background:`linear-gradient(90deg, ${B.gold}, transparent)` }} />
      </div>

      {/* Content */}
      <div style={{ overflowY:"auto" }}>
        {tab===0 && <TabDashboard onNudge={()=>setShowNudge(true)} />}
        {tab===1 && <TabGrowth />}
        {tab===2 && <TabCurriculum />}
        {tab===3 && <TabProfile />}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background:`${B.bgDeep}F2`, backdropFilter:"blur(20px)", borderTop:`1px solid ${B.creamLow}`, padding:"13px 0 28px", display:"flex" }}>
        {tabs.map((t,i) => (
          <button key={i} onClick={()=>setTab(i)}
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
