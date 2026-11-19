import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGestureGuidance } from "./gesture-guidance-state";

function session() {
  const flags = new Map<string, string>();
  return { getItem: (key: string) => flags.get(key) ?? null, setItem: (key: string, value: string) => { flags.set(key, value); } };
}

describe("gesture guidance across routes and sessions", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("appears once and automatically closes after five seconds", () => {
    const storage = session();
    const hint = createGestureGuidance(() => storage);
    const subscriber = vi.fn();
    const unsubscribe = hint.subscribe(subscriber);
    hint.showAutomatically();
    expect(hint.getSnapshot()).toBe(true);
    vi.advanceTimersByTime(4999);
    expect(hint.getSnapshot()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hint.getSnapshot()).toBe(false);
    hint.showAutomatically();
    expect(hint.getSnapshot()).toBe(false);
    expect(subscriber).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
  it("remembers a consumed hint after remount/reload, but allows a new session", () => {
    const storage = session();
    const first = createGestureGuidance(() => storage);
    first.showAutomatically();
    first.dismiss();
    const nextRoute = createGestureGuidance(() => storage);
    nextRoute.showAutomatically();
    expect(nextRoute.getSnapshot()).toBe(false);
    const newSession = createGestureGuidance(() => session());
    newSession.showAutomatically();
    expect(newSession.getSnapshot()).toBe(true);
    newSession.dismiss();
  });
  it("manual help reopens and renews the timeout without an old timer closing it", () => {
    const hint = createGestureGuidance(() => session());
    hint.showAutomatically();
    vi.advanceTimersByTime(4000);
    hint.show();
    vi.advanceTimersByTime(1000);
    expect(hint.getSnapshot()).toBe(true);
    vi.advanceTimersByTime(4000);
    expect(hint.getSnapshot()).toBe(false);
  });
  it("falls back to one in-memory session when storage is unavailable", () => {
    const hint = createGestureGuidance(() => { throw new Error("storage denied"); });
    hint.showAutomatically();
    hint.dismiss();
    hint.showAutomatically();
    expect(hint.getSnapshot()).toBe(false);
    hint.show();
    expect(hint.getSnapshot()).toBe(true);
    hint.dismiss();
  });
});
