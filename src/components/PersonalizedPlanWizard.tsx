"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { B } from "../lib/brandPalette.js";
import {
  PLAN_BUILDER_GOAL_OPTIONS,
  SUGGESTED_INTERESTS,
  normalizeGoalSlug,
} from "../lib/eyfsGoals";
import {
  useGetChildInterestsQuery,
  useGetParentChildrenQuery,
  useUpdateChildGoalsMutation,
  useUpdateChildInterestsMutation,
} from "../lib/api/homeApi";
import { LoadingSpinner } from "./Loading";
import CurriculumGenerator from "./CurriculumGenerator";
import type { ActivateCurriculumResponse } from "../lib/api/curriculumGenApi";

const STEP_LABELS = ["Goals", "Interests", "Generate"] as const;
const TOTAL_STEPS = STEP_LABELS.length;

export type PersonalizedPlanWizardProps = {
  childId: number;
  parentId: number;
  childName?: string;
  defaultWeekNumber?: number;
  onClose: () => void;
  onActivated?: (result: ActivateCurriculumResponse) => void;
};

function StepProgressBar({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
      {STEP_LABELS.map((label, i) => (
        <div
          key={label}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
        >
          <div
            style={{
              height: 3,
              width: "100%",
              borderRadius: 99,
              background: i <= step ? B.gold : B.creamLow,
            }}
          />
          <span
            style={{
              fontSize: 9,
              color: i <= step ? B.gold : B.creamMid,
              fontWeight: i === step ? 700 : 400,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function StepCaption({ step }: { step: number }) {
  return (
    <p
      style={{
        color: B.gold,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        margin: "0 0 18px",
        fontFamily: "Georgia, serif",
      }}
    >
      Step {step + 1} of {TOTAL_STEPS}
    </p>
  );
}

const pillButtonStyle = (active: boolean, accent: "gold" | "terra"): CSSProperties => {
  const border = accent === "gold" ? B.gold : B.terra;
  const bg = accent === "gold" ? B.goldFade : B.terraFade;
  const color = accent === "gold" ? B.gold : B.terra;
  return {
    padding: "10px 18px",
    borderRadius: 99,
    border: `1.5px solid ${active ? border : B.creamLow}`,
    background: active ? bg : "transparent",
    color: active ? color : B.creamMid,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "Georgia, serif",
  };
};

const nextButtonStyle = (enabled: boolean, accent: "gold" | "terra"): CSSProperties => {
  const fill = accent === "gold" ? B.gold : B.terra;
  return {
    width: "100%",
    padding: 15,
    borderRadius: 12,
    background: enabled ? fill : B.creamFade,
    color: enabled ? (accent === "gold" ? B.dark : B.cream) : B.creamMid,
    fontWeight: 700,
    border: `1px solid ${enabled ? fill : B.creamLow}`,
    cursor: enabled ? "pointer" : "default",
    fontFamily: "Georgia, serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
};

export default function PersonalizedPlanWizard({
  childId,
  parentId,
  childName,
  defaultWeekNumber,
  onClose,
  onActivated,
}: PersonalizedPlanWizardProps) {
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [goalsHydrated, setGoalsHydrated] = useState(false);
  const [interestsHydrated, setInterestsHydrated] = useState(false);

  const { data: parentChildren = [] } = useGetParentChildrenQuery(
    { parentId },
    { skip: !parentId },
  );
  const currentChild = parentChildren.find((c) => c.id === childId);
  const { data: interestsData, isFetching: loadingInterests } = useGetChildInterestsQuery({ childId });

  const [updateGoals, goalsState] = useUpdateChildGoalsMutation();
  const [updateInterests, interestsState] = useUpdateChildInterestsMutation();

  useEffect(() => {
    if (!goalsHydrated && currentChild?.goals) {
      setSelectedGoals(currentChild.goals.map(normalizeGoalSlug));
      setGoalsHydrated(true);
    }
  }, [currentChild?.goals, goalsHydrated]);

  useEffect(() => {
    if (!interestsHydrated && interestsData?.interests) {
      setInterests(interestsData.interests.map((i) => i.toLowerCase()));
      setInterestsHydrated(true);
    }
  }, [interestsData?.interests, interestsHydrated]);

  const toggleGoal = (slug: string) => {
    setSelectedGoals((prev) =>
      prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug],
    );
  };

  const toggleInterest = (value: string) => {
    const key = value.toLowerCase();
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key],
    );
  };

  const addInterest = () => {
    const trimmed = interestInput.trim().toLowerCase();
    if (!trimmed || interests.includes(trimmed)) {
      setInterestInput("");
      return;
    }
    setInterests((prev) => [...prev, trimmed]);
    setInterestInput("");
  };

  const saveGoalsAndAdvance = async () => {
    if (!selectedGoals.length) return;
    try {
      await updateGoals({
        childId,
        parentId,
        goals: selectedGoals.map(normalizeGoalSlug),
      }).unwrap();
      setStep(1);
    } catch {
      /* inline error */
    }
  };

  const saveInterestsAndAdvance = async () => {
    if (!interests.length) return;
    try {
      await updateInterests({ childId, interests }).unwrap();
      setStep(2);
    } catch {
      /* inline error */
    }
  };

  const handleBack = useCallback(() => {
    if (step === 0) onClose();
    else setStep((s) => s - 1);
  }, [step, onClose]);

  const goToGoalsStep = () => setStep(0);
  const goToInterestsStep = () => setStep(1);

  const childLabel = childName ? childName : "your child";

  return (
    <div style={{ padding: "0 20px 110px" }}>
      <button
        type="button"
        onClick={handleBack}
        style={{
          background: "none",
          border: "none",
          color: B.gold,
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 18,
          fontFamily: "Georgia, serif",
        }}
      >
        ← Back
      </button>

      <StepProgressBar step={step} />

      {step === 0 && (
        <div>
          <StepCaption step={0} />
          <p
            style={{
              color: B.cream,
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 6,
              fontFamily: "Georgia, serif",
            }}
          >
            What skills to focus on?
          </p>
          <p style={{ color: B.creamMid, fontSize: 13, marginBottom: 22, lineHeight: 1.5 }}>
            Select one or more areas to develop this week
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
            {PLAN_BUILDER_GOAL_OPTIONS.map(({ label, slug }) => (
              <button
                key={slug}
                type="button"
                onClick={() => toggleGoal(slug)}
                style={pillButtonStyle(selectedGoals.includes(slug), "gold")}
              >
                {label}
              </button>
            ))}
          </div>
          {goalsState.isError && (
            <p style={{ color: B.terra, fontSize: 12, marginBottom: 12 }}>
              Could not save goals — please try again.
            </p>
          )}
          <button
            type="button"
            onClick={saveGoalsAndAdvance}
            disabled={!selectedGoals.length || goalsState.isLoading}
            style={nextButtonStyle(selectedGoals.length > 0 && !goalsState.isLoading, "gold")}
          >
            {goalsState.isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Saving…</span>
              </>
            ) : (
              "Next →"
            )}
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <StepCaption step={1} />
          <p
            style={{
              color: B.cream,
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 6,
              fontFamily: "Georgia, serif",
            }}
          >
            What&apos;s {childLabel} into right now?
          </p>
          <p style={{ color: B.creamMid, fontSize: 13, marginBottom: 22, lineHeight: 1.5 }}>
            Pick themes or add your own — Curi weaves them into every session
          </p>

          {loadingInterests && !interestsHydrated ? (
            <p style={{ color: B.creamMid, fontSize: 13, marginBottom: 20 }}>Loading interests…</p>
          ) : (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                {SUGGESTED_INTERESTS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleInterest(item)}
                    style={pillButtonStyle(interests.includes(item), "terra")}
                  >
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>

              {interests.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {interests.map((item) => (
                    <div
                      key={item}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: B.goldFade,
                        border: `1px solid ${B.creamLow}`,
                        borderRadius: 99,
                        padding: "6px 12px",
                      }}
                    >
                      <span style={{ color: B.cream, fontSize: 13, fontWeight: 500 }}>{item}</span>
                      <button
                        type="button"
                        onClick={() => toggleInterest(item)}
                        style={{
                          background: "none",
                          border: "none",
                          color: B.creamMid,
                          cursor: "pointer",
                          fontSize: 14,
                          lineHeight: 1,
                          padding: 0,
                        }}
                        aria-label={`Remove ${item}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                <input
                  value={interestInput}
                  onChange={(e) => setInterestInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addInterest()}
                  placeholder="e.g. painting, trains…"
                  style={{
                    flex: 1,
                    padding: "11px 14px",
                    borderRadius: 12,
                    background: B.bgDeep,
                    color: B.cream,
                    border: `1px solid ${B.creamLow}`,
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={addInterest}
                  style={{
                    padding: "11px 16px",
                    borderRadius: 12,
                    background: B.terra,
                    color: B.cream,
                    border: "none",
                    fontWeight: 700,
                    fontSize: 18,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              </div>
            </>
          )}

          {interestsState.isError && (
            <p style={{ color: B.terra, fontSize: 12, marginBottom: 12 }}>
              Could not save interests — please try again.
            </p>
          )}
          <button
            type="button"
            onClick={saveInterestsAndAdvance}
            disabled={!interests.length || interestsState.isLoading}
            style={nextButtonStyle(interests.length > 0 && !interestsState.isLoading, "terra")}
          >
            {interestsState.isLoading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Saving…</span>
              </>
            ) : (
              "Next →"
            )}
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <StepCaption step={2} />
          <CurriculumGenerator
            childId={childId}
            childName={childName}
            defaultWeekNumber={defaultWeekNumber}
            embedded
            autoStart
            onClose={onClose}
            onActivated={onActivated}
            onEditGoals={goToGoalsStep}
            onEditInterests={goToInterestsStep}
          />
        </div>
      )}
    </div>
  );
}
