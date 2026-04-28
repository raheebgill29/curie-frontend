import type { SerializedError } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

export {
  useCreateLessonLessonsPostMutation,
  useCreateThemeThemesPostMutation,
  useGetLessonsByThemeThemesThemeIdLessonsGetQuery,
  useGetThemesThemesGetQuery,
  usePreviewLessonLessonsLessonIdPreviewGetQuery,
  useUpdateLessonLessonsLessonIdPutMutation,
  useUpdateThemeThemesThemeIdPutMutation,
} from "./generated/curriculumApi";

export { useGetChildCurriculumBoardChildrenChildIdCurriculumBoardGetQuery } from "./generated/childrenApi";

export type {
  ContentPreviewResponse,
  LessonCreateSchema,
  LessonSchema,
  LessonUpdateSchema,
  ThemeCreateSchema,
  ThemeSchema,
  ThemeUpdateSchema,
} from "./generated/curriculumApi";

/** Flatten FastAPI 422 `detail` array or string into a single message */
export function parseApiError(error: unknown): string {
  if (!error) return "Something went wrong.";
  const fb = error as FetchBaseQueryError;
  if (typeof fb.status === "number" && fb.data && typeof fb.data === "object") {
    const data = fb.data as { detail?: unknown };
    const d = data.detail;
    if (Array.isArray(d)) {
      return d
        .map((item: { msg?: string }) => item?.msg || JSON.stringify(item))
        .filter(Boolean)
        .join(" ");
    }
    if (typeof d === "string") return d;
  }
  const se = error as SerializedError;
  if (se?.message) return se.message;
  return "Request failed.";
}

export function isHttpNotFound(error: unknown): boolean {
  const fb = error as FetchBaseQueryError;
  return fb?.status === 404;
}

export function isHttpClientError(error: unknown): boolean {
  const fb = error as FetchBaseQueryError;
  const s = fb?.status;
  return typeof s === "number" && s >= 400 && s < 500;
}
