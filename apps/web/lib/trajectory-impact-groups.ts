import type {
  TrajectoryMark,
  TrajectoryReconciliation,
} from "@sidera/curriculum-engine";
import { blockingReasonsFromNodes, courseReference } from "./curriculum-data";

/* Agrupación y orden del impacto de un cambio de trayectoria, sin JSX: es
   presentación, pero presentación pura, y separarla del componente permite
   probarla sin montar React.

   No decide nada académico. El engine ya calculó qué se invalida, en qué ronda
   y por qué; aquí solo se traduce a algo legible y se ordena.

   Solo agrupa INVALIDACIONES. El engine sigue calculando incoherencias
   históricas sobre materias aprobadas, pero hoy no tienen superficie: como no
   se retira nada, no hay decisión que pedirle al estudiante. Quedan
   disponibles en el resultado de la reconciliación para cuando exista un sitio
   adecuado donde consultarlas. */
const markLabels: Record<TrajectoryMark, string> = {
  UNMARKED: "Sin marcar",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
};

export type ImpactItem = {
  id: string;
  name: string;
  reasons: readonly string[];
};

export type DepthImpactItem = ImpactItem & { depth: number };

export type ImpactGroups = {
  requestedName: string;
  requestedMark: string;
  direct: readonly DepthImpactItem[];
  cascade: readonly DepthImpactItem[];
};

/* Partición y orden del impacto, separados del render para poder probarlos sin
   montar React. No decide nada académico: solo agrupa y ordena lo que el
   engine ya calculó. */
export function groupImpacts(
  reconciliation: TrajectoryReconciliation,
): ImpactGroups {
  const toItem = (
    versionCourseId: TrajectoryReconciliation["requested"]["versionCourseId"],
    blocking: Parameters<typeof blockingReasonsFromNodes>[0],
  ): ImpactItem => ({
    id: String(versionCourseId),
    name: courseReference(versionCourseId),
    reasons: blockingReasonsFromNodes(blocking),
  });

  /* Orden determinista: primero la ronda en que se invalidó, luego el nombre.
     Sin esto el listado dependería del orden de recorrido interno, que es un
     detalle de implementación y no debería ser visible. */
  const sorted: DepthImpactItem[] = reconciliation.invalidations
    .map((invalidation) => ({
      ...toItem(invalidation.versionCourseId, invalidation.blocking),
      depth: invalidation.depth,
    }))
    .sort(
      (left, right) =>
        left.depth - right.depth || left.name.localeCompare(right.name, "es"),
    );

  return {
    requestedName: courseReference(reconciliation.requested.versionCourseId),
    requestedMark: markLabels[reconciliation.requested.mark],
    /* `depth` 1 es lo que el cambio rompe por sí mismo; a partir de 2, lo que
       se rompe por culpa de las invalidaciones anteriores. Es la distinción
       que convierte una lista plana en una explicación causal. */
    direct: sorted.filter((item) => item.depth === 1),
    cascade: sorted.filter((item) => item.depth > 1),
  };
}
