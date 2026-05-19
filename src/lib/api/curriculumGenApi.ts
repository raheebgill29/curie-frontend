import { baseApi as api } from "./baseApi";
import type { LessonContent, ThemeSchema, LessonSchema } from "./generated/curriculumApi";

export const addTagTypes = ["curriculum", "children"] as const;

/**
 * Hand-written RTK Query slice for the curriculum-generation flow:
 *
 *  - POST /children/{id}/curriculum/generate -> a *draft* curriculum (not persisted).
 *  - POST /children/{id}/curriculum/activate -> persists the supplied draft as
 *    the child's active theme + lessons (201).
 *
 * Generation is the expensive call (LLM); activation is fast. The UI flow is
 * therefore generate -> review -> activate so the user can preview / regenerate
 * before committing.
 */
const injectedRtkApi = api
  .enhanceEndpoints({ addTagTypes })
  .injectEndpoints({
    endpoints: (build) => ({
      // POST /children/{child_id}/curriculum/generate
      generateCurriculum: build.mutation<
        GenerateCurriculumResponse,
        GenerateCurriculumArg
      >({
        query: ({ childId, body }) => ({
          url: `/children/${childId}/curriculum/generate`,
          method: "POST",
          body: body ?? {},
        }),
        // Pure draft (no persistence) -> no cache invalidation.
      }),

      // POST /children/{child_id}/curriculum/activate
      activateCurriculum: build.mutation<
        ActivateCurriculumResponse,
        ActivateCurriculumArg
      >({
        query: ({ childId, draft }) => ({
          url: `/children/${childId}/curriculum/activate`,
          method: "POST",
          body: { draft },
        }),
        // Activated curriculum changes the child's board + theme listing.
        invalidatesTags: (_r, _e, arg) => [
          { type: "children", id: arg.childId },
          { type: "children", id: `home-${arg.childId}` },
          "curriculum",
        ],
      }),
    }),
    overrideExisting: false,
  });

export { injectedRtkApi as curriculumGenApi };

// ── Request args ─────────────────────────────────────────────────────────────
export type GenerateCurriculumArg = {
  childId: number;
  body?: GenerateCurriculumRequest;
};

export type GenerateCurriculumRequest = {
  /** Defaults to 7 server-side when omitted. */
  duration_days?: number;
  /** Defaults to next available week server-side when omitted. */
  week_number?: number;
};

export type ActivateCurriculumArg = {
  childId: number;
  draft: CurriculumDraft;
};

// ── Response shapes ──────────────────────────────────────────────────────────
/** A lesson in the draft, before persistence. No `id`/`theme_id` yet. */
export type CurriculumDraftLesson = {
  day_number: number;
  lesson_type: string;
  vocabulary: string[];
  /** Same content shape used by POST /lessons. */
  learning_goals: LessonContent;
};

export type CurriculumDraft = {
  theme_key: string;
  title: string;
  description: string;
  week_number: number;
  duration_days: number;
  lessons: CurriculumDraftLesson[];
};

export type GenerateCurriculumResponse = {
  child_id: number;
  /** ISO-8601 UTC */
  generated_at: string;
  draft: CurriculumDraft;
};

export type ActivateCurriculumResponse = {
  child_id: number;
  /** The persisted theme — includes child_id, description, and standard ThemeSchema fields. */
  theme: ThemeSchema & {
    child_id: number;
    description: string;
  };
  lessons: LessonSchema[];
};

// ── Error classification helpers ─────────────────────────────────────────────
/**
 * Reasons the backend rejects /generate with HTTP 400. Mapped from the
 * `detail` string. `unknown` means the detail did not match any known pattern
 * — UI should surface the raw message.
 */
export type GenerateBlocker =
  | "missing_goals"
  | "missing_interests"
  | "validation_failed"
  | "unknown";

export type GenerateBlockerInfo = {
  kind: GenerateBlocker;
  /** Original `detail` string from the server. Useful for the unknown case. */
  message: string;
  /** Day number parsed out of "Generator output failed validation on day <N>..." */
  validationDay?: number;
  /** JSON path parsed out of the validation message. */
  validationPath?: string;
};

/**
 * Classify a FastAPI error body or RTK Query FetchBaseQueryError into a
 * `GenerateBlocker`. Falls back to "unknown".
 */
export function classifyGenerateError(err: unknown): GenerateBlockerInfo | null {
  const detail = extractDetail(err);
  if (detail == null) return null;
  if (/Set the child's goals/i.test(detail)) {
    return { kind: "missing_goals", message: detail };
  }
  if (/Set the child's interests/i.test(detail)) {
    return { kind: "missing_interests", message: detail };
  }
  const validationMatch = detail.match(
    /Generator output failed validation on day\s+(\d+)\s+at\s+'([^']+)':\s*(.+)/i,
  );
  if (validationMatch) {
    return {
      kind: "validation_failed",
      message: detail,
      validationDay: Number(validationMatch[1]),
      validationPath: validationMatch[2],
    };
  }
  return { kind: "unknown", message: detail };
}

/** True if the error is a 409 from /activate (theme_key collision). */
export function isActivateConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number | string };
  return e.status === 409;
}

/** True if either endpoint returned 404 (child not found). */
export function isChildNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number | string };
  return e.status === 404;
}

function extractDetail(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { data?: unknown };
  if (!e.data || typeof e.data !== "object") return null;
  const d = e.data as { detail?: unknown };
  if (typeof d.detail === "string") return d.detail;
  return null;
}

export const {
  useGenerateCurriculumMutation,
  useActivateCurriculumMutation,
} = injectedRtkApi;
