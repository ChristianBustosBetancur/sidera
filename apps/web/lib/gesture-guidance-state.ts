type SessionFlags = Pick<Storage, "getItem" | "setItem">;
const SESSION_KEY = "sidera:gesture-guidance:v1";

/** One session-wide controller; it never handles pointer or touch events. */
export function createGestureGuidance(storage: () => SessionFlags) {
  let visible = false;
  let seen = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());
  const dismiss = () => {
    clearTimeout(timer);
    visible = false;
    publish();
  };
  const show = () => {
    seen = true;
    try { storage().setItem(SESSION_KEY, "seen"); } catch { /* Memory still covers route navigation. */ }
    clearTimeout(timer);
    visible = true;
    publish();
    timer = setTimeout(dismiss, 5000);
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => visible,
    show,
    dismiss,
    showAutomatically() {
      if (seen) return;
      try { seen = storage().getItem(SESSION_KEY) === "seen"; } catch { /* Session storage is optional. */ }
      if (!seen) show();
    },
  };
}
