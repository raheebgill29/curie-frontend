/** Legacy / alternate EYFS slugs → canonical keys (matches backend app/core/eyfs.py). */
export const EYFS_GOAL_ALIASES: Record<string, string> = {
  personal_social_emotional_development: "personal_social_emotional",
  expressive_arts_and_design: "creative_arts",
  expressive_arts: "creative_arts",
};

export function normalizeGoalSlug(goal: string): string {
  const key = String(goal || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return EYFS_GOAL_ALIASES[key] || key;
}

/** Slugs must match backend EYFS_AREAS (app/core/constants.py). */
export const EYFS_GOALS_OPTIONS = [
  { value: "communication_and_language", label: "Communication & Language", icon: "🗣️" },
  { value: "personal_social_emotional", label: "Personal & Social", icon: "🤝" },
  { value: "physical_development", label: "Physical Development", icon: "🏃" },
  { value: "literacy", label: "Literacy", icon: "📚" },
  { value: "mathematics", label: "Mathematics", icon: "🔢" },
  { value: "understanding_the_world", label: "Understanding the World", icon: "🌍" },
  { value: "creative_arts", label: "Creative Arts", icon: "🎨" },
] as const;

/** Compact labels for the plan builder wizard (maps to backend slugs). */
export const PLAN_BUILDER_GOAL_OPTIONS = [
  { label: "Communication", slug: "communication_and_language" },
  { label: "Maths & Logic", slug: "mathematics" },
  { label: "Creative Arts", slug: "creative_arts" },
  { label: "Social & Emotional", slug: "personal_social_emotional" },
  { label: "Nature & Science", slug: "understanding_the_world" },
] as const;

export const SUGGESTED_INTERESTS = [
  "dinosaurs",
  "space",
  "ocean",
  "animals",
  "superheroes",
  "cooking",
] as const;
