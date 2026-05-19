"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import {
  useGetHomeSummaryQuery,
  useGetParentChildrenQuery,
  useGetParentQuery,
  useGetToyStatusQuery,
  type ActiveSessionCard,
  type ChildResponse,
  type HomeSummaryResponse,
  type ParentResponse,
  type ToyStatusResponse,
} from "../api/homeApi";

const TOY_POLL_MS = 5_000;
const HOME_POLL_MS = 30_000;

export type UseHomeDataArgs = {
  parentId: number | null | undefined;
  childId: number | null | undefined;
};

export type UseHomeDataResult = {
  parent: ParentResponse | undefined;
  child: ChildResponse | null;
  children: ChildResponse[];
  home: HomeSummaryResponse | undefined;
  toy: ToyStatusResponse | undefined;
  activeSession: ActiveSessionCard | null;
  /** Local-ticking elapsed seconds (floor to minutes for display). */
  elapsedSeconds: number;
  isInitialLoading: boolean;
  isFocused: boolean;
  /** Account not found: parent or child returned 404. */
  isAccountNotFound: boolean;
  /** We have stale data but the most recent poll/fetch failed. */
  isReconnecting: boolean;
  refetchAll: () => void;
};

function isFetchError(err: unknown): err is FetchBaseQueryError {
  return !!err && typeof err === "object" && "status" in (err as object);
}

function is404(err: unknown): boolean {
  return isFetchError(err) && err.status === 404;
}

function isNetworkLikeError(err: unknown): boolean {
  if (!isFetchError(err)) return false;
  // FETCH_ERROR / TIMEOUT_ERROR or any 5xx counts as reconnecting territory.
  if (err.status === "FETCH_ERROR" || err.status === "TIMEOUT_ERROR") return true;
  if (typeof err.status === "number" && err.status >= 500) return true;
  return false;
}

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState !== "hidden";
  });
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("blur", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("blur", onVis);
    };
  }, []);
  return visible;
}

/**
 * Owns fetching, polling, and the local elapsed ticker for the Home screen.
 *
 * Polling rules (spec):
 *  - /toys/{id}/status every 5s while focused.
 *  - /children/{id}/home-summary every 30s while focused AND active_session != null.
 *  - All polling paused when the page is hidden; resumes on visibility.
 *  - Local clock ticks once per second between server snaps; snap on each
 *    new /home-summary payload.
 */
export function useHomeData({ parentId, childId }: UseHomeDataArgs): UseHomeDataResult {
  const isFocused = useDocumentVisible();

  // ── /parents/{id} ────────────────────────────────────────────────────────
  const parentArg = parentId != null ? { parentId } : skipToken;
  const parentQuery = useGetParentQuery(parentArg);

  // ── /parents/{id}/children ───────────────────────────────────────────────
  const childrenArg = parentId != null ? { parentId } : skipToken;
  const childrenQuery = useGetParentChildrenQuery(childrenArg);
  const children = childrenQuery.data ?? [];
  const selectedChild = useMemo<ChildResponse | null>(() => {
    if (childId == null) return null;
    return children.find((c) => c.id === childId) ?? null;
  }, [children, childId]);

  // ── /toys/{child_id}/status ──────────────────────────────────────────────
  const toyArg = childId != null ? { childId } : skipToken;
  const toyQuery = useGetToyStatusQuery(toyArg, {
    pollingInterval: isFocused && childId != null ? TOY_POLL_MS : 0,
    // RTKQ 2.x: pause polling when the tab is hidden, even if pollingInterval is set.
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // ── /children/{child_id}/home-summary ────────────────────────────────────
  // The initial fetch happens regardless of pollingInterval; we read its data
  // first to decide whether the 30s poll should engage. Options update reactively
  // when `activeSession` flips, so polling arms/disarms correctly across refetches.
  const homeArg = childId != null ? { childId } : skipToken;
  const homeQuery = useGetHomeSummaryQuery(homeArg, { skipPollingIfUnfocused: true });
  const home = homeQuery.data;
  const activeSession = home?.active_session ?? null;
  const homeShouldPoll = isFocused && childId != null && !!activeSession;
  useGetHomeSummaryQuery(homeArg, {
    pollingInterval: homeShouldPoll ? HOME_POLL_MS : 0,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // ── Local elapsed ticker ─────────────────────────────────────────────────
  // Anchor: (sessionId, server elapsed_seconds, receivedAt).
  // Display: elapsed = anchor.elapsed_seconds + ticks since anchor.
  const anchorRef = useRef<{
    sessionId: number;
    elapsedAtAnchor: number;
  } | null>(null);
  const [ticks, setTicks] = useState(0);

  // Snap whenever the server gives us a fresh elapsed_seconds or a new session.
  // `started_at` covers the case where session_id is reused but the clock reset.
  const snapSignature = activeSession
    ? `${activeSession.session_id}:${activeSession.elapsed_seconds}:${activeSession.started_at}`
    : null;
  useEffect(() => {
    if (!snapSignature || !activeSession) {
      anchorRef.current = null;
      setTicks(0);
      return;
    }
    anchorRef.current = {
      sessionId: activeSession.session_id,
      elapsedAtAnchor: activeSession.elapsed_seconds,
    };
    setTicks(0);
  }, [snapSignature, activeSession]);

  // Tick once per second while focused and there is an active session.
  const hasActiveSessionForTicker = !!activeSession;
  useEffect(() => {
    if (!isFocused || !hasActiveSessionForTicker) return;
    const id = window.setInterval(() => {
      setTicks((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isFocused, hasActiveSessionForTicker]);

  const elapsedSeconds = activeSession
    ? (anchorRef.current?.elapsedAtAnchor ?? activeSession.elapsed_seconds) + ticks
    : 0;

  // ── Derived status: 404 / reconnecting / loading ─────────────────────────
  const isAccountNotFound =
    is404(parentQuery.error) ||
    is404(homeQuery.error) ||
    is404(childrenQuery.error) ||
    // childId was supplied but is not in the children list
    (childId != null &&
      childrenQuery.isSuccess &&
      children.length > 0 &&
      selectedChild == null);

  const isReconnecting =
    // We've already shown data once, but the latest network attempt failed.
    (!!homeQuery.data && isNetworkLikeError(homeQuery.error)) ||
    (!!toyQuery.data && isNetworkLikeError(toyQuery.error));

  const isInitialLoading =
    (parentQuery.isUninitialized || parentQuery.isLoading) ||
    (childrenQuery.isUninitialized || childrenQuery.isLoading) ||
    (childId != null && (homeQuery.isUninitialized || homeQuery.isLoading)) ||
    (childId != null && (toyQuery.isUninitialized || toyQuery.isLoading));

  const refetchAll = () => {
    if (parentId != null) {
      parentQuery.refetch();
      childrenQuery.refetch();
    }
    if (childId != null) {
      toyQuery.refetch();
      homeQuery.refetch();
    }
  };

  return {
    parent: parentQuery.data,
    child: selectedChild,
    children,
    home,
    toy: toyQuery.data,
    activeSession,
    elapsedSeconds,
    isInitialLoading,
    isFocused,
    isAccountNotFound,
    isReconnecting,
    refetchAll,
  };
}
