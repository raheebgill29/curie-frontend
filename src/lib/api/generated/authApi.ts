import { baseApi as api } from "../baseApi";
export const addTagTypes = ["auth"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      loginParentAuthLoginPost: build.mutation<
        LoginParentAuthLoginPostApiResponse,
        LoginParentAuthLoginPostApiArg
      >({
        query: (queryArg) => ({
          url: `/auth/login`,
          method: "POST",
          body: queryArg.parentLoginSchema,
        }),
        invalidatesTags: ["auth"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as enhancedApi };
export type LoginParentAuthLoginPostApiResponse =
  /** status 200 Successful Response */ ParentSchema;
export type LoginParentAuthLoginPostApiArg = {
  parentLoginSchema: ParentLoginSchema;
};
export type ParentSchema = {
  email: string;
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
export type ParentLoginSchema = {
  email: string;
  password: string;
};
export const { useLoginParentAuthLoginPostMutation } = injectedRtkApi;
