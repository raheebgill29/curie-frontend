import { baseApi as api } from "./baseApi";

export const addTagTypes = ["parents", "children", "toy"] as const;

/**
 * Hand-written RTK Query slice for the Phase 1 parent-Home endpoints.
 *
 * These calls are JSON-only and currently unauthenticated. The base URL is
 * controlled by `NEXT_PUBLIC_API_BASE_URL` (see `./baseApi`); set it to
 * `http://localhost:8000` for local FastAPI dev.
 */
const injectedRtkApi = api
  .enhanceEndpoints({ addTagTypes })
  .injectEndpoints({
    endpoints: (build) => ({
      // GET /parents/{parent_id}
      getParent: build.query<ParentResponse, GetParentArg>({
        query: ({ parentId }) => ({ url: `/parents/${parentId}` }),
        providesTags: (_r, _e, arg) => [{ type: "parents", id: arg.parentId }],
      }),

      // GET /parents/{parent_id}/children
      getParentChildren: build.query<ChildResponse[], GetParentChildrenArg>({
        query: ({ parentId }) => ({ url: `/parents/${parentId}/children` }),
        providesTags: (result, _e, arg) =>
          result
            ? [
                { type: "children", id: `parent-${arg.parentId}` },
                ...result.map((c) => ({ type: "children" as const, id: c.id })),
              ]
            : [{ type: "children", id: `parent-${arg.parentId}` }],
      }),

      // GET /toys/{child_id}/status
      getToyStatus: build.query<ToyStatusResponse, GetToyStatusArg>({
        query: ({ childId }) => ({ url: `/toys/${childId}/status` }),
        providesTags: (_r, _e, arg) => [{ type: "toy", id: arg.childId }],
      }),

      // GET /children/{child_id}/home-summary
      getHomeSummary: build.query<HomeSummaryResponse, GetHomeSummaryArg>({
        query: ({ childId }) => ({ url: `/children/${childId}/home-summary` }),
        providesTags: (_r, _e, arg) => [
          { type: "children", id: `home-${arg.childId}` },
        ],
      }),

      // GET /children/{child_id}/active-session
      getActiveSession: build.query<ActiveSessionCard | null, GetActiveSessionArg>({
        query: ({ childId }) => ({ url: `/children/${childId}/active-session` }),
        providesTags: (_r, _e, arg) => [
          { type: "children", id: `active-${arg.childId}` },
        ],
      }),

      // GET /children/{child_id}/interests
      getChildInterests: build.query<ChildInterestsResponse, GetChildInterestsArg>({
        query: ({ childId }) => ({ url: `/children/${childId}/interests` }),
        providesTags: (_r, _e, arg) => [{ type: "children", id: `interests-${arg.childId}` }],
      }),

      // PUT /children/{child_id}/goals
      updateChildGoals: build.mutation<ChildGoalsResponse, UpdateChildGoalsArg>({
        query: ({ childId, goals }) => ({
          url: `/children/${childId}/goals`,
          method: "PUT",
          body: { goals },
        }),
        invalidatesTags: (_r, _e, arg) => [
          { type: "children", id: arg.childId },
          { type: "children", id: `parent-${arg.parentId}` },
        ],
      }),

      // PUT /children/{child_id}/interests
      updateChildInterests: build.mutation<ChildInterestsResponse, UpdateChildInterestsArg>({
        query: ({ childId, interests }) => ({
          url: `/children/${childId}/interests`,
          method: "PUT",
          body: { interests },
        }),
        invalidatesTags: (_r, _e, arg) => [
          { type: "children", id: `interests-${arg.childId}` },
        ],
      }),

      getNudgeTopics: build.query<NudgeTopicsListResponse, void>({
        query: () => ({ url: "/nudge-topics" }),
      }),

      sendChildNudge: build.mutation<SendNudgeResponse, SendChildNudgeArg>({
        query: ({ childId, topicId }) => ({
          url: `/children/${childId}/nudge`,
          method: "POST",
          body: { topic_id: topicId },
        }),
      }),
    }),
    overrideExisting: false,
  });

export { injectedRtkApi as homeApi };

// ── Request args ─────────────────────────────────────────────────────────────
export type GetParentArg = { parentId: number };
export type GetParentChildrenArg = { parentId: number };
export type GetToyStatusArg = { childId: number };
export type GetHomeSummaryArg = { childId: number };
export type GetActiveSessionArg = { childId: number };
export type GetChildInterestsArg = { childId: number };
export type UpdateChildGoalsArg = { childId: number; parentId: number; goals: string[] };
export type UpdateChildInterestsArg = { childId: number; interests: string[] };
export type SendChildNudgeArg = { childId: number; topicId: number };

export type NudgeTopicItem = { id: number; label: string };
export type NudgeTopicsListResponse = { topics: NudgeTopicItem[] };
export type SendNudgeResponse = {
  ok: boolean;
  topic_label: string;
  session_id: number | null;
  delivered: boolean;
  message: string;
};

// ── Response shapes (from Phase 1 contract) ──────────────────────────────────
export type ParentResponse = {
  id: number;
  email: string;
  created_at: string;
};

export type ChildResponse = {
  id: number;
  parent_id: number;
  name: string;
  dob: string | null;
  goals: string[];
  created_at: string;
};

export type ToyStatusResponse = {
  child_id: number;
  online: boolean;
  active_session_id: number | null;
  assistant_speaking: boolean;
  child_speaking: boolean;
  idle: boolean;
};

export type ActiveSessionCard = {
  session_id: number;
  lesson_id: number;
  /** e.g. "Body Awareness - Song And Movement" */
  lesson_title: string;
  theme_title: string;
  lesson_type: string;
  /** ISO-8601 UTC */
  started_at: string;
  /** server-computed at fetch time */
  elapsed_seconds: number;
  /** 1-based */
  round_number: number;
  /** typically 6 for legacy lessons */
  total_rounds: number;
};

export type HomeSummaryResponse = {
  child_id: number;
  child_name: string;
  active_session: ActiveSessionCard | null;
  today: {
    minutes: number;
    delta_minutes_vs_yesterday: number | null;
  };
  week: {
    completed: number;
    /** theme.duration_days */
    total: number;
    /** e.g. "Monday complete"; null when no completed day */
    last_completed_day_label: string | null;
  };
};

export type ChildInterestsResponse = {
  interests: string[];
};

export type ChildGoalsResponse = {
  goals: string[];
};

/** Shape returned by the backend for any 4xx/5xx. */
export type ApiErrorBody = {
  error: string;
  detail: string;
  status_code: number;
};

export const {
  useGetParentQuery,
  useGetParentChildrenQuery,
  useGetToyStatusQuery,
  useGetHomeSummaryQuery,
  useGetActiveSessionQuery,
  useGetChildInterestsQuery,
  useUpdateChildGoalsMutation,
  useUpdateChildInterestsMutation,
  useGetNudgeTopicsQuery,
  useSendChildNudgeMutation,
} = injectedRtkApi;
