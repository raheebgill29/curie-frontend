import { baseApi as api } from "../baseApi";
export const addTagTypes = ["curriculum"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getThemesThemesGet: build.query<
        GetThemesThemesGetApiResponse,
        GetThemesThemesGetApiArg
      >({
        query: () => ({ url: `/themes` }),
        providesTags: ["curriculum"],
      }),
      createThemeThemesPost: build.mutation<
        CreateThemeThemesPostApiResponse,
        CreateThemeThemesPostApiArg
      >({
        query: (queryArg) => ({
          url: `/themes`,
          method: "POST",
          body: queryArg.themeCreateSchema,
        }),
        invalidatesTags: ["curriculum"],
      }),
      updateThemeThemesThemeIdPut: build.mutation<
        UpdateThemeThemesThemeIdPutApiResponse,
        UpdateThemeThemesThemeIdPutApiArg
      >({
        query: (queryArg) => ({
          url: `/themes/${queryArg.themeId}`,
          method: "PUT",
          body: queryArg.themeUpdateSchema,
        }),
        invalidatesTags: ["curriculum"],
      }),
      getLessonsByThemeThemesThemeIdLessonsGet: build.query<
        GetLessonsByThemeThemesThemeIdLessonsGetApiResponse,
        GetLessonsByThemeThemesThemeIdLessonsGetApiArg
      >({
        query: (queryArg) => ({ url: `/themes/${queryArg.themeId}/lessons` }),
        providesTags: ["curriculum"],
      }),
      createLessonLessonsPost: build.mutation<
        CreateLessonLessonsPostApiResponse,
        CreateLessonLessonsPostApiArg
      >({
        query: (queryArg) => ({
          url: `/lessons`,
          method: "POST",
          body: queryArg.lessonCreateSchema,
        }),
        invalidatesTags: ["curriculum"],
      }),
      updateLessonLessonsLessonIdPut: build.mutation<
        UpdateLessonLessonsLessonIdPutApiResponse,
        UpdateLessonLessonsLessonIdPutApiArg
      >({
        query: (queryArg) => ({
          url: `/lessons/${queryArg.lessonId}`,
          method: "PUT",
          body: queryArg.lessonUpdateSchema,
        }),
        invalidatesTags: ["curriculum"],
      }),
      previewLessonLessonsLessonIdPreviewGet: build.query<
        PreviewLessonLessonsLessonIdPreviewGetApiResponse,
        PreviewLessonLessonsLessonIdPreviewGetApiArg
      >({
        query: (queryArg) => ({ url: `/lessons/${queryArg.lessonId}/preview` }),
        providesTags: ["curriculum"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as enhancedApi };
export type GetThemesThemesGetApiResponse =
  /** status 200 Successful Response */ ThemeSchema[];
export type GetThemesThemesGetApiArg = void;
export type CreateThemeThemesPostApiResponse =
  /** status 201 Successful Response */ ThemeSchema;
export type CreateThemeThemesPostApiArg = {
  themeCreateSchema: ThemeCreateSchema;
};
export type UpdateThemeThemesThemeIdPutApiResponse =
  /** status 200 Successful Response */ ThemeSchema;
export type UpdateThemeThemesThemeIdPutApiArg = {
  themeId: number;
  themeUpdateSchema: ThemeUpdateSchema;
};
export type GetLessonsByThemeThemesThemeIdLessonsGetApiResponse =
  /** status 200 Successful Response */ LessonSchema[];
export type GetLessonsByThemeThemesThemeIdLessonsGetApiArg = {
  themeId: number;
};
export type CreateLessonLessonsPostApiResponse =
  /** status 201 Successful Response */ LessonSchema;
export type CreateLessonLessonsPostApiArg = {
  lessonCreateSchema: LessonCreateSchema;
};
export type UpdateLessonLessonsLessonIdPutApiResponse =
  /** status 200 Successful Response */ LessonSchema;
export type UpdateLessonLessonsLessonIdPutApiArg = {
  lessonId: number;
  lessonUpdateSchema: LessonUpdateSchema;
};
export type PreviewLessonLessonsLessonIdPreviewGetApiResponse =
  /** status 200 Successful Response */ ContentPreviewResponse;
export type PreviewLessonLessonsLessonIdPreviewGetApiArg = {
  lessonId: number;
};
export type ThemeSchema = {
  theme_key: string;
  title: string;
  week_number: number;
  duration_days: number;
  id: number;
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
export type ThemeCreateSchema = {
  theme_key: string;
  title: string;
  week_number: number;
  duration_days: number;
};
export type ThemeUpdateSchema = {
  title?: string | null;
  week_number?: number | null;
  duration_days?: number | null;
};
export type LessonSchema = {
  id: number;
  theme_id: number;
  day_number: number;
  lesson_type: string;
  learning_goals: object;
  vocabulary: string[];
  created_at: string;
};
export type AgeProfile = {
  expected_action: string;
  guiding_question?: string | null;
  extension_question?: string | null;
  educational_goal: string;
};
export type SocraticStep = {
  opening_question: string;
  age_profiles: {
    [key: string]: AgeProfile;
  };
};
export type SevenStepStructure = {
  step_1_hook: string;
  step_2_core_activity: string;
  step_3_do: string;
  step_4_socratic: SocraticStep;
  step_5_extension: string;
  step_6_reflection: string;
};
export type ContentJson = {
  ai_action: string;
  activity_narrative: string;
  seven_step_structure: SevenStepStructure;
  vocabulary?: string[];
  learning_goals?: string[];
  lesson_key?: string | null;
};
export type LessonContent = {
  title: string;
  subject_lens?: string | null;
  eyfs_focus?: string[];
  content_json: ContentJson;
  lesson_key?: string | null;
};
export type LessonCreateSchema = {
  theme_id: number;
  day_number: number;
  lesson_type: string;
  learning_goals: LessonContent;
  vocabulary: string[];
};
export type LessonUpdateSchema = {
  day_number?: number | null;
  lesson_type?: string | null;
  learning_goals?: LessonContent | null;
  vocabulary?: string[] | null;
};
export type ContentPreviewResponse = {
  lesson_id: number;
  lesson_type: string;
  vocabulary: string[];
  rendered_system_prompt: string;
  structural_warnings?: string[];
};
export const {
  useGetThemesThemesGetQuery,
  useCreateThemeThemesPostMutation,
  useUpdateThemeThemesThemeIdPutMutation,
  useGetLessonsByThemeThemesThemeIdLessonsGetQuery,
  useCreateLessonLessonsPostMutation,
  useUpdateLessonLessonsLessonIdPutMutation,
  usePreviewLessonLessonsLessonIdPreviewGetQuery,
} = injectedRtkApi;
