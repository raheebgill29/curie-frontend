import { baseApi as api } from "../baseApi";
export const addTagTypes = ["toy"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      generateSessionToyGenerateSessionPost: build.mutation<
        GenerateSessionToyGenerateSessionPostApiResponse,
        GenerateSessionToyGenerateSessionPostApiArg
      >({
        query: (queryArg) => ({
          url: `/toy/generate-session`,
          method: "POST",
          body: queryArg.generateSessionRequest,
        }),
        invalidatesTags: ["toy"],
      }),
      respondToyRespondPost: build.mutation<
        RespondToyRespondPostApiResponse,
        RespondToyRespondPostApiArg
      >({
        query: (queryArg) => ({
          url: `/toy/respond`,
          method: "POST",
          body: queryArg.respondRequest,
        }),
        invalidatesTags: ["toy"],
      }),
      evaluateToyEvaluatePost: build.mutation<
        EvaluateToyEvaluatePostApiResponse,
        EvaluateToyEvaluatePostApiArg
      >({
        query: (queryArg) => ({
          url: `/toy/evaluate`,
          method: "POST",
          body: queryArg.evaluateRequest,
        }),
        invalidatesTags: ["toy"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as enhancedApi };
export type GenerateSessionToyGenerateSessionPostApiResponse =
  /** status 200 Successful Response */ GenerateSessionResponse;
export type GenerateSessionToyGenerateSessionPostApiArg = {
  generateSessionRequest: GenerateSessionRequest;
};
export type RespondToyRespondPostApiResponse =
  /** status 200 Successful Response */ RespondResponse;
export type RespondToyRespondPostApiArg = {
  respondRequest: RespondRequest;
};
export type EvaluateToyEvaluatePostApiResponse =
  /** status 200 Successful Response */ EvaluateResponse;
export type EvaluateToyEvaluatePostApiArg = {
  evaluateRequest: EvaluateRequest;
};
export type GenerateSessionResponse = {
  session_id: number;
  system_prompt: string;
  first_message: string;
  first_message_audio_base64?: string | null;
};
export type ValidationError = {
  loc: (string | number)[];
  msg: string;
  type: string;
};
export type HttpValidationError = {
  detail?: ValidationError[];
};
export type GenerateSessionRequest = {
  child_id: number;
  lesson_id: number;
};
export type RespondResponse = {
  response_text: string;
  child_state: string;
  current_goal: string;
};
export type RespondRequest = {
  session_id: number;
  child_input: string;
};
export type EvaluateResponse = {
  eyfs_scores: {
    [key: string]: number;
  };
  insight_summary: string;
  memory_summary: string;
};
export type EvaluateRequest = {
  session_id: number;
};
export const {
  useGenerateSessionToyGenerateSessionPostMutation,
  useRespondToyRespondPostMutation,
  useEvaluateToyEvaluatePostMutation,
} = injectedRtkApi;
