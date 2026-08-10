"use client";

import {
  type RefObject,
  useEffect,
  useSyncExternalStore,
} from "react";

type SampleLabel =
  | "pointerdown"
  | "pointerup"
  | "click"
  | "t0"
  | "t1"
  | "rAF1"
  | "rAF2"
  | "post-focus";

type ProbeSample = {
  label: SampleLabel;
  // Instante real de LECTURA (ms desde el arranque de la página). La chronología
  // verdadera es este valor, no el orden en que las filas se publican: `post-focus`
  // se lee en el efecto de foco, que ocurre ANTES de rAF1/rAF2 aunque se muestre al final.
  readAt: number;
  scrollY: number;
  innerHeight: number;
  viewportHeight?: number;
  viewportOffsetTop?: number;
  scrollHeight: number;
  nodeTop?: number;
  detailTop?: number;
  graphScrollTop?: number;
  activeElement: string;
};

type ProbeElements = {
  node: HTMLElement | null;
};

const MEDIA_QUERY = "(max-width: 72rem)";
const listeners = new Set<() => void>();
let samples: ProbeSample[] = [];
let pendingGesture: ProbeSample[] = [];
let activeBatch = 0;
// Holds a post-focus sample already read at focus time, waiting only to be
// published once rAF2 has been appended, so the visible order stays correct.
let pendingPostFocus: { batch: number; sample: ProbeSample } | null = null;
let elements: ProbeElements = {
  node: null,
};
let graphRegionProbeRef: RefObject<HTMLElement | null> | null = null;
let detailPanelProbeRef: RefObject<HTMLElement | null> | null = null;

function enabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    window.matchMedia(MEDIA_QUERY).matches
  );
}

function describeElement(element: Element | null) {
  if (!element) return "none";
  const classes = [...element.classList]
    .map((className) =>
      className.includes("courseSelector")
        ? "courseSelector"
        : className.slice(0, 24),
    )
    .join(".");
  return `${element.tagName}${classes ? `.${classes}` : ""}`;
}

function readSample(label: SampleLabel, selectedNode = elements.node): ProbeSample {
  const visualViewport = window.visualViewport;
  return {
    label,
    readAt: performance.now(),
    scrollY: window.scrollY,
    innerHeight: window.innerHeight,
    viewportHeight: visualViewport?.height,
    viewportOffsetTop: visualViewport?.offsetTop,
    scrollHeight: document.documentElement.scrollHeight,
    nodeTop: selectedNode?.getBoundingClientRect().top,
    detailTop: detailPanelProbeRef?.current?.getBoundingClientRect().top,
    graphScrollTop: graphRegionProbeRef?.current?.scrollTop,
    activeElement: describeElement(document.activeElement),
  };
}

function publish(nextSamples: ProbeSample[]) {
  samples = nextSamples;
  for (const listener of listeners) listener();
}

function append(label: SampleLabel, batch: number) {
  if (!enabled() || batch !== activeBatch) return;
  publish([...samples, readSample(label)]);
}

// Publishes a sample that was already read at its own moment, without re-reading.
function appendSample(sample: ProbeSample, batch: number) {
  if (!enabled() || batch !== activeBatch) return;
  publish([...samples, sample]);
}

export function probeSelection(
  selectedNode: HTMLElement | null,
  changeSelection: () => void,
) {
  if (!enabled()) {
    changeSelection();
    return;
  }

  activeBatch += 1;
  const batch = activeBatch;
  pendingPostFocus = null;
  elements.node = selectedNode;
  samples = pendingGesture;
  pendingGesture = [];
  append("t0", batch);
  changeSelection();
  append("t1", batch);
  requestAnimationFrame(() => {
    append("rAF1", batch);
    requestAnimationFrame(() => {
      append("rAF2", batch);
      // Only publishes the sample already read at focus time; never re-reads here.
      if (pendingPostFocus?.batch === batch) {
        appendSample(pendingPostFocus.sample, batch);
        pendingPostFocus = null;
      }
    });
  });
}

export function probePostFocus() {
  if (!enabled() || samples.length === 0) return;
  // Read at the exact moment focus happened; publication may be deferred, the read never is.
  const sample = readSample("post-focus");
  if (samples.some(({ label }) => label === "rAF2")) {
    appendSample(sample, activeBatch);
  } else {
    pendingPostFocus = { batch: activeBatch, sample };
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return samples;
}

const emptySnapshot: ProbeSample[] = [];

function format(value: number | undefined) {
  return value === undefined ? "—" : Math.round(value).toString();
}

export function SelectionScrollProbe({
  graphRegionRef,
  detailPanelRef,
}: {
  graphRegionRef: RefObject<HTMLElement | null>;
  detailPanelRef: RefObject<HTMLElement | null>;
}) {
  const currentSamples = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => emptySnapshot,
  );

  useEffect(() => {
    // Se instala en cualquier ancho (solo en desarrollo) y se decide por evento en
    // `capture`/`enabled`; así rotar una tablet a través de 72rem no deja la sonda muerta.
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
      return;
    }
    graphRegionProbeRef = graphRegionRef;
    detailPanelProbeRef = detailPanelRef;

    const capture = (event: Event) => {
      // Reevaluado en cada evento: el viewport puede cruzar 72rem al rotar una tablet.
      if (!enabled()) return;
      const target = event.target;
      const node = target instanceof Element ? target.closest("article") : null;
      if (!(node instanceof HTMLElement)) return;
      elements.node = node;
      if (event.type === "pointerdown") pendingGesture = [];
      pendingGesture = [
        ...pendingGesture,
        readSample(event.type as "pointerdown" | "pointerup" | "click", node),
      ];
    };

    document.addEventListener("pointerdown", capture, true);
    document.addEventListener("pointerup", capture, true);
    document.addEventListener("click", capture, true);

    // Cruzar el breakpoint descarta la tanda en curso y fuerza el re-render del overlay,
    // para no mezclar muestras de dos regímenes de layout distintos.
    const media = window.matchMedia(MEDIA_QUERY);
    const onBreakpointChange = () => {
      // Invalida la tanda en curso: los callbacks rAF pendientes comparan contra
      // activeBatch y quedan descartados en vez de publicar muestras obsoletas.
      activeBatch += 1;
      pendingGesture = [];
      pendingPostFocus = null;
      publish([]);
    };
    media.addEventListener("change", onBreakpointChange);

    return () => {
      document.removeEventListener("pointerdown", capture, true);
      document.removeEventListener("pointerup", capture, true);
      document.removeEventListener("click", capture, true);
      media.removeEventListener("change", onBreakpointChange);
      elements = { node: null };
      graphRegionProbeRef = null;
      detailPanelProbeRef = null;
      pendingGesture = [];
      pendingPostFocus = null;
    };
  }, [detailPanelRef, graphRegionRef]);

  if (!enabled() || currentSamples.length === 0) return null;

  // Referencia para los deltas de tiempo: la muestra leída más temprano de la tanda.
  const baseline = Math.min(...currentSamples.map(({ readAt }) => readAt));

  return (
    <aside
      aria-label="Selection scroll probe"
      style={{
        position: "fixed",
        inset: "auto 0 0 0",
        zIndex: 2147483647,
        maxHeight: "70vh",
        overflow: "hidden",
        pointerEvents: "none",
        background: "rgba(0, 0, 0, 0.92)",
        color: "#fff",
        font: "9px/1.25 monospace",
        padding: "6px",
        whiteSpace: "normal",
      }}
    >
      <div>moment +ms y/ih vvH/vvT sh node/detail gr</div>
      <div>orden real = +ms creciente, NO el orden de las filas</div>
      {currentSamples.map((sample, index) => (
        <div
          key={`${sample.label}-${index}`}
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.18)" }}
        >
          <div>
            {sample.label} +{format(sample.readAt - baseline)}{" "}
            {format(sample.scrollY)}/{format(sample.innerHeight)}{" "}
            {format(sample.viewportHeight)}/{format(sample.viewportOffsetTop)}{" "}
            {format(sample.scrollHeight)} {format(sample.nodeTop)}/
            {format(sample.detailTop)} {format(sample.graphScrollTop)}
          </div>
          <div style={{ overflowWrap: "anywhere" }}>
            active: {sample.activeElement}
          </div>
        </div>
      ))}
    </aside>
  );
}
