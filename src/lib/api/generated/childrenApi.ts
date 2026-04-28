import { baseApi as api } from "../baseApi";
export const addTagTypes = ["children"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      createChildChildrenPost: build.mutation<
        CreateChildChildrenPostApiResponse,
        CreateChildChildrenPostApiArg
      >({
        query: (queryArg) => ({
          url: `/children`,
          method: "POST",
          body: queryArg.childCreateSchema,
        }),
        invalidatesTags: ["children"],
      }),
      getChildChildrenChildIdGet: build.query<
        GetChildChildrenChildIdGetApiResponse,
        GetChildChildrenChildIdGetApiArg
      >({
        query: (queryArg) => ({ url: `/children/${queryArg.childId}` }),
        providesTags: ["children"],
      }),
      getChildProgressChildrenChildIdProgressGet: build.query<
        GetChildProgressChildrenChildIdProgressGetApiResponse,
        GetChildProgressChildrenChildIdProgressGetApiArg
      >({
        query: (queryArg) => ({
          url: `/children/${queryArg.childId}/progress`,
        }),
        providesTags: ["children"],
      }),
      getChildInsightsChildrenChildIdInsightsGet: build.query<
        GetChildInsightsChildrenChildIdInsightsGetApiResponse,
        GetChildInsightsChildrenChildIdInsightsGetApiArg
      >({
        query: (queryArg) => ({
          url: `/children/${queryArg.childId}/insights`,
        }),
        providesTags: ["children"],
      }),
      getChildCurriculumBoardChildrenChildIdCurriculumBoardGet: build.query<
        CurriculumBoardResponse,
        GetChildCurriculumBoardChildrenChildIdCurriculumBoardGetApiArg
      >({
        query: (queryArg) => ({
          url: `/children/${queryArg.childId}/curriculum-board`,
          ...(queryArg.themeId != null && queryArg.themeId !== undefined
            ? { params: { theme_id: queryArg.themeId } }
            : {}),
        }),
        providesTags: ["children"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as enhancedApi };
export type CreateChildChildrenPostApiResponse =
  /** status 201 Successful Response */ ChildSchema;
export type CreateChildChildrenPostApiArg = {
  childCreateSchema: ChildCreateSchema;
};
export type GetChildChildrenChildIdGetApiResponse =
  /** status 200 Successful Response */ ChildSchema;
export type GetChildChildrenChildIdGetApiArg = {
  childId: number;
};
export type GetChildProgressChildrenChildIdProgressGetApiResponse =
  /** status 200 Successful Response */ ChildProgressResponse;
export type GetChildProgressChildrenChildIdProgressGetApiArg = {
  childId: number;
};
export type GetChildInsightsChildrenChildIdInsightsGetApiResponse =
  /** status 200 Successful Response */ ChildInsightsResponse;
export type GetChildInsightsChildrenChildIdInsightsGetApiArg = {
  childId: number;
};
export type ChildSchema = {
  name: string;
  dob?: string | null;
  id: number;
  parent_id: number;
  created_at: string;
};
export type ValidationError = {
  loc: (string | number)[];
  msg: string;
  type: string;
};
export type HttpValidationError = {
  detail?: ValidationError[];
};
export type ChildCreateSchema = {
  name: string;
  dob?: string | null;
  parent_id: number;
};
export type EyfsProgressSchema = {
  date: string;
  scores: {
    [key: string]: number;
  };
};
export type ChildProgressResponse = {
  child_id: number;
  progress: EyfsProgressSchema[];
};
export type InsightSchema = {
  date: string;
  insight: string;
};
export type ChildInsightsResponse = {
  child_id: number;
  insights: InsightSchema[];
};
export type CurriculumBoardLesson = {
  lesson_id: number;
  day_number: number;
  lesson_type: string;
  vocabulary?: unknown;
  learning_goals?: Record<string, unknown>;
  status: string;
  engagement_percentage?: number;
};
export type CurriculumBoardResponse = {
  child_id: number;
  theme_id: number;
  theme_title: string;
  week_number: number;
  duration_days: number;
  lessons: CurriculumBoardLesson[];
};
export type GetChildCurriculumBoardChildrenChildIdCurriculumBoardGetApiArg = {
  childId: number;
  /** Omit or leave undefined for server default theme */
  themeId?: number | null;
};
export const {
  useCreateChildChildrenPostMutation,
  useGetChildChildrenChildIdGetQuery,
  useGetChildProgressChildrenChildIdProgressGetQuery,
  useGetChildInsightsChildrenChildIdInsightsGetQuery,
  useGetChildCurriculumBoardChildrenChildIdCurriculumBoardGetQuery,
} = injectedRtkApi;
