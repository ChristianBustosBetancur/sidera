"use client";

import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref, type RefObject } from "react";
import { CameraGesture, frameCamera, revealInCamera, zoomCamera, type Camera, type CameraBounds } from "./graph-camera";
import type { PanoramaFrame } from "./display-geometry";
import styles from "./graph-viewport.module.css";

export function useMobileGraph() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = matchMedia("(max-width: 76rem)");
    const update = () => setMobile(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

export type GraphCameraHandle = { reset: () => void; reveal: (node: HTMLElement) => void };
type Props = ComponentProps<"section"> & {
  mobile: boolean; fullView: boolean; frame: PanoramaFrame; cameraRef: Ref<GraphCameraHandle>;
  regionRef: RefObject<HTMLElement | null>; contentRef: RefObject<HTMLDivElement | null>;
  details?: ReactNode;
  directCamera?: boolean;
};

export function GraphViewport({ mobile, fullView, frame, cameraRef, regionRef, contentRef, children, details, directCamera = false, ...desktopProps }: Props) {
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const cameraValue = useRef(camera);
  const worldRef = useRef<HTMLDivElement>(null);
  const initial = useRef(camera);
  const bounds = useRef<CameraBounds | null>(null);
  const gesture = useRef(new CameraGesture());
  const apply = useCallback((value: Camera) => {
    const previous = cameraValue.current;
    if (directCamera && previous === value) return;
    cameraValue.current = value;
    if (!directCamera) { setCamera(value); return; }
    // One owner for the transform and diagnostic coordinates. React reads the
    // same canonical value on selection/detail renders, so it cannot roll back
    // an in-flight gesture. Controls only need renders at their disabled limits.
    if (worldRef.current) worldRef.current.style.transform = `translate(${value.x}px, ${value.y}px) scale(${value.scale})`;
    const host = regionRef.current;
    if (host) {
      host.dataset.cameraScale = String(value.scale);
      host.dataset.cameraX = String(value.x);
      host.dataset.cameraY = String(value.y);
    }
    const minimum = bounds.current?.minScale ?? 0;
    if ((previous.scale >= 3) !== (value.scale >= 3) ||
        (previous.scale <= minimum + .000001) !== (value.scale <= minimum + .000001)) setCamera(value);
  }, [directCamera, regionRef]);
  const reset = useCallback(() => { gesture.current.clear(); apply(initial.current); }, [apply]);
  useLayoutEffect(() => {
    if (!mobile) return;
    const host = regionRef.current; const content = contentRef.current;
    if (!host || !content) return;
    let previous = "";
    const measure = () => {
      const size = { width: host.clientWidth, height: host.clientHeight, contentWidth: content.offsetWidth, contentHeight: content.offsetHeight };
      const key = JSON.stringify(size);
      if (key === previous || Object.values(size).some(value => value <= 0)) return;
      previous = key;
      const next = frameCamera(size, fullView, frame, parseFloat(getComputedStyle(document.documentElement).fontSize));
      bounds.current = next.bounds; initial.current = next.camera; reset();
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(host); observer.observe(content);
    return () => { observer.disconnect(); gesture.current.clear(); };
  }, [mobile, fullView, frame, regionRef, contentRef, reset]);
  const reveal = useCallback((node: HTMLElement) => {
    const box = node.getBoundingClientRect(); const host = regionRef.current?.getBoundingClientRect(); const limits = bounds.current;
    if (!host || !limits) return;
    const current = cameraValue.current;
    apply(revealInCamera(current, { x: (box.left - host.left - current.x) / current.scale, y: (box.top - host.top - current.y) / current.scale, width: box.width / current.scale, height: box.height / current.scale }, limits));
  }, [apply, regionRef]);
  useImperativeHandle(cameraRef, () => ({ reset, reveal }), [reset, reveal]);
  const zoom = (factor: number) => {
    const limits = bounds.current; if (!limits) return;
    apply(zoomCamera(cameraValue.current, cameraValue.current.scale * factor, { x: limits.width / 2, y: limits.height / 2 }, limits));
  };
  if (!mobile) return <section {...desktopProps} ref={regionRef}>{children}</section>;
  return <div>
    <div className={styles.controls} role="group" aria-label="Cámara del grafo">
      <button type="button" aria-label="Acercar grafo" disabled={camera.scale >= 3} onClick={() => zoom(1.3)}>+</button>
      <button type="button" aria-label="Alejar grafo" disabled={!!bounds.current && camera.scale <= bounds.current.minScale + .000001} onClick={() => zoom(1 / 1.3)}>−</button>
      <button type="button" onClick={reset}>Ajustar vista</button>
      {details ? <span className={styles.details}>{details}</span> : null}
    </div>
    <section ref={regionRef} className={styles.viewport} aria-label={desktopProps["aria-label"]} tabIndex={0}
      data-graph-camera data-camera-scale={cameraValue.current.scale} data-camera-x={cameraValue.current.x} data-camera-y={cameraValue.current.y}
      onScroll={event => {
        // Keyboard focus can trigger native scrolling even on overflow:hidden.
        // Translation belongs exclusively to the camera.
        event.currentTarget.scrollLeft = 0; event.currentTarget.scrollTop = 0;
      }}
      onFocusCapture={event => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement) || !target.matches(":focus-visible")) return;
        requestAnimationFrame(() => {
          const host = regionRef.current;
          if (!host || !target.isConnected) return;
          host.scrollLeft = 0; host.scrollTop = 0;
          const box = target.getBoundingClientRect(); const view = host.getBoundingClientRect();
          if (box.left < view.left || box.right > view.right || box.top < view.top || box.bottom > view.bottom) reveal(target);
        });
      }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        const box = event.currentTarget.getBoundingClientRect();
        gesture.current.down(event.pointerId, { x: event.clientX - box.left, y: event.clientY - box.top }, cameraValue.current);
        if (event.target instanceof Element) event.target.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (!bounds.current) return;
        const box = event.currentTarget.getBoundingClientRect();
        apply(gesture.current.move(event.pointerId, { x: event.clientX - box.left, y: event.clientY - box.top }, cameraValue.current, bounds.current));
      }}
      onPointerUp={event => { gesture.current.up(event.pointerId, cameraValue.current); if (event.target instanceof Element && event.target.hasPointerCapture(event.pointerId)) event.target.releasePointerCapture(event.pointerId); }}
      onPointerCancel={event => gesture.current.up(event.pointerId, cameraValue.current, true)}
      onLostPointerCapture={event => gesture.current.up(event.pointerId, cameraValue.current)}
      onClickCapture={event => { if (event.detail !== 0 && gesture.current.suppressClick) { event.preventDefault(); event.stopPropagation(); } }}
      onClick={desktopProps.onClick}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const limits = bounds.current; if (!limits) return;
        const moves: Record<string, [number, number]> = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] };
        const move = moves[event.key];
        if (move) {
          event.preventDefault(); const [dx, dy] = move; const current = cameraValue.current;
          apply(zoomCamera(current, current.scale, { x: 0, y: 0 }, limits, { x: dx, y: dy }));
        } else if (["+", "=", "-", "0", "Home"].includes(event.key)) {
          event.preventDefault(); if (event.key === "0" || event.key === "Home") reset(); else zoom(event.key === "-" ? 1 / 1.3 : 1.3);
        }
      }}>
      {/* Map panning benefits from a prepared compositing layer at high zoom.
          Keep the hint on its mobile world only, never the shell or details. */}
      <div ref={worldRef} className={styles.world} style={{ willChange: directCamera ? "transform" : undefined, transform: `translate(${cameraValue.current.x}px, ${cameraValue.current.y}px) scale(${cameraValue.current.scale})` }}>{children}</div>
    </section>
  </div>;
}

/** Kept below the existing trajectory confirmation (z-index 300). */
export function CourseDetails({ mobile, onClose, children }: { mobile: boolean; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobile) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + gutter}px`;
    document.body.style.overflow = "hidden";
    root.current?.querySelector<HTMLElement>("aside")?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow; document.body.style.paddingRight = previousPadding;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [mobile]);
  if (!mobile) return children;
  return <div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key !== "Tab") return;
    const elements = root.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), [tabindex='0']");
    const first = elements?.[0]; const last = elements?.[elements.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current?.querySelector("aside"))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}><div className={styles.sheet} ref={root}>{children}</div></div>;
}
