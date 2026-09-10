"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * False during SSR and the hydration render, true afterwards.
 *
 * Use this to gate anything that reads browser-only state, rather than the
 * mounted-flag-in-an-effect pattern, which costs an extra render pass and is
 * flagged by react-hooks/set-state-in-effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
