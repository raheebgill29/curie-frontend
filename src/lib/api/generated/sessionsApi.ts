import { baseApi as api } from "../baseApi";
export const addTagTypes = ["sessions"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getChildSessionsSessionsChildIdGet: build.query<
        GetChildSessionsSessionsChildIdGetApiResponse,
        GetChildSessionsSessionsChildIdGetApiArg
      >({
        query: (queryArg) => ({
          url: `/sessions/${queryArg.childId}`,
          params: {
            page: queryArg.page,
            page_size: queryArg.pageSize,
          },
        }),
        providesTags: ["sessions"],
      }),
      getSessionDetailSessionsSessionIdDetailGet: build.query<
        GetSessionDetailSessionsSessionIdDetailGetApiResponse,
        GetSessionDetailSessionsSessionIdDetailGetApiArg
      >({
        query: (queryArg) => ({
          url: `/sessions/${queryArg.sessionId}/detail`,
        }),
        providesTags: ["sessions"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as enhancedApi };
export type GetChildSessionsSessionsChildIdGetApiResponse =
  /** status 200 Successful Response */ PaginatedResponseSessionSchema;
export type GetChildSessionsSessionsChildIdGetApiArg = {
  childId: number;
  page?: number;
  pageSize?: number;
};
export type GetSessionDetailSessionsSessionIdDetailGetApiResponse =
  /** status 200 Successful Response */ SessionDetailSchema;
export type GetSessionDetailSessionsSessionIdDetailGetApiArg = {
  sessionId: number;
};
export type SessionSchema = {
  child_id: number;
  lesson_id: number;
  id: number;
  started_at: string;
  ended_at?: string | null;
};
export type PaginatedResponseSessionSchema = {
  items: SessionSchema[];
  total: number;
  page: number;
  page_size: number;
};
export type ValidationError = {
  loc: (string | number)[];
  msg: string;
  type: string;
};
export type HttpValidationError = {
  detail?: ValidationError[];
};
export type SessionEventSchema = {
  id: number;
  session_id: number;
  turn_number: number;
  actor: string;
  text: string;
  created_at: string;
};
export type SessionDetailSchema = {
  child_id: number;
  lesson_id: number;
  id: number;
  started_at: string;
  ended_at?: string | null;
  events?: SessionEventSchema[];
};
export const {
  useGetChildSessionsSessionsChildIdGetQuery,
  useGetSessionDetailSessionsSessionIdDetailGetQuery,
} = injectedRtkApi;
