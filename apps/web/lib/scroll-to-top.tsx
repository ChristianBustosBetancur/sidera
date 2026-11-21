"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./scroll-to-top.module.css";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const returning = useRef(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 76rem)");
    const update = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      // Graph pages can have less than a full viewport of document scroll.
      // Still offer the exit near their bottom, but skip short documents.
      const threshold = Math.min(window.innerHeight, available * 0.8);
      if (window.scrollY === 0) returning.current = false;
      // Keep the focused control mounted until a smooth return finishes.
      setVisible(mobile.matches && available >= 320 && (returning.current || window.scrollY >= threshold));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    mobile.addEventListener("change", update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      mobile.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return (
    <button
      type="button"
      className={styles.button}
      hidden={!visible}
      aria-label="Volver arriba"
      title="Volver arriba"
      onClick={() => {
        returning.current = true;
        window.scrollTo({
          top: 0,
          left: window.scrollX,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
      }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5m-6 6 6-6 6 6" />
      </svg>
    </button>
  );
}
