/**
 * API contracts for curriculum — aligns with FastAPI schemas.
 * Generated RTK types in `generated/curriculumApi.ts` are authoritative at runtime;
 * these interfaces document the wire format for app code.
 */

/** GET /themes item */
export interface ThemeSchema {
  id: number;
  theme_key: string;
  title: string;
  week_number: number;
  duration_days: number;
  created_at: string;
}

/** POST /themes */
export interface ThemeCreateSchema {
  theme_key: string;
  title: string;
  week_number: number;
  duration_days: number;
}

/** PUT /themes/{theme_id} */
export interface ThemeUpdateSchema {
  title?: string | null;
  week_number?: number | null;
  duration_days?: number | null;
}

export interface AgeProfile {
  expected_action: string;
  guiding_question?: string | null;
  extension_question?: string | null;
  educational_goal: string;
}

export interface SocraticStep {
  opening_question: string;
  age_profiles: Record<string, AgeProfile>;
}

export interface SevenStepStructure {
  step_1_hook: string;
  step_2_core_activity: string;
  step_3_do: string;
  step_4_socratic: SocraticStep;
  step_5_extension: string;
  step_6_reflection: string;
}

export interface LessonContentJson {
  ai_action: string;
  activity_narrative: string;
  lesson_key?: string | null;
  vocabulary?: string[];
  learning_goals?: string[];
  seven_step_structure: SevenStepStructure;
}

export interface LessonContent {
  title: string;
  subject_lens?: string | null;
  eyfs_focus?: string[];
  lesson_key?: string | null;
  content_json: LessonContentJson;
}

/** GET /themes/{theme_id}/lessons item */
export interface LessonSchema {
  id: number;
  theme_id: number;
  day_number: number;
  lesson_type: string;
  learning_goals: Record<string, unknown>;
  vocabulary: string[];
  created_at: string;
}

/** POST /lessons */
export interface LessonCreateSchema {
  theme_id: number;
  day_number: number;
  lesson_type: string;
  vocabulary: string[];
  learning_goals: LessonContent;
}

/** PUT /lessons/{lesson_id} */
export interface LessonUpdateSchema {
  day_number?: number | null;
  lesson_type?: string | null;
  vocabulary?: string[] | null;
  learning_goals?: Partial<LessonContent> | null;
}

/** GET /lessons/{lesson_id}/preview */
export interface ContentPreviewResponse {
  lesson_id: number;
  lesson_type: string;
  vocabulary: string[];
  rendered_system_prompt: string;
  structural_warnings?: string[];
}

/** GET /children/{child_id}/curriculum-board */
export interface CurriculumBoardLessonWire {
  lesson_id: number;
  day_number: number;
  lesson_type: string;
  vocabulary?: string[];
  learning_goals?: Record<string, unknown>;
  status: "completed" | "upcoming";
  engagement_percentage: number;
}

export interface CurriculumBoardResponse {
  child_id: number;
  theme_id: number;
  theme_title: string;
  week_number: number;
  duration_days: number;
  lessons: CurriculumBoardLessonWire[];
}

export interface HttpValidationErrorDetail {
  loc?: (string | number)[];
  msg: string;
  type?: string;
}
