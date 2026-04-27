import { baseApi as api } from "../baseApi";
export const addTagTypes = ["health"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      healthCheckHealthGet: build.query<
        HealthCheckHealthGetApiResponse,
        HealthCheckHealthGetApiArg
      >({
        query: () => ({ url: `/health` }),
        providesTags: ["health"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as enhancedApi };
export type HealthCheckHealthGetApiResponse =
  /** status 200 Successful Response */ HealthResponse;
export type HealthCheckHealthGetApiArg = void;
export type HealthResponse = {
  status: string;
  timestamp: string;
};
export const { useHealthCheckHealthGetQuery } = injectedRtkApi;
