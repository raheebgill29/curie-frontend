import { baseApi as api } from "../baseApi";
export const addTagTypes = ["parents"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      registerParentParentsPost: build.mutation<
        RegisterParentParentsPostApiResponse,
        RegisterParentParentsPostApiArg
      >({
        query: (queryArg) => ({
          url: `/parents`,
          method: "POST",
          body: queryArg.parentCreateSchema,
        }),
        invalidatesTags: ["parents"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as enhancedApi };
export type RegisterParentParentsPostApiResponse =
  /** status 201 Successful Response */ ParentSchema;
export type RegisterParentParentsPostApiArg = {
  parentCreateSchema: ParentCreateSchema;
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
export type ParentCreateSchema = {
  email: string;
  password: string;
};
export const { useRegisterParentParentsPostMutation } = injectedRtkApi;
