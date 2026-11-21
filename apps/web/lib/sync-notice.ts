/* Texto del aviso que acompaña a un cambio aplicado sin diálogo.

   Función pura: recibe lo que ya está resuelto a nombres legibles y decide
   qué se dice. No consulta el engine ni los catálogos, de modo que el texto
   se puede probar sin montar la aplicación. */

export type SyncNoticeInput = {
  /** Programas distintos del activo donde el cambio también se escribió. */
  mirrored: readonly string[];
  /** Asignaturas retiradas de «En curso» por la reconciliación. */
  retired: readonly string[];
  /** Frases ya compuestas sobre requisitos incumplidos: informan, no cambian. */
  warned: readonly string[];
};

/* Los motivos del engine se redactan en segunda persona («Te falta aprobar
   X»). Dentro de una frase que ya habla del programa simulado encajan mejor
   como complemento: «No cumple requisitos: falta aprobar X». */
export function requirementShortfall(reasons: readonly string[]): string | undefined {
  const missing = reasons.map(reason => reason.replace(/^Te /, "")).filter(reason => reason.length > 0);
  return missing.length > 0 ? `No cumple requisitos: ${missing.join(". ")}` : undefined;
}

function enumerate(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

export function syncNoticeText({ mirrored, retired, warned }: SyncNoticeInput): string | undefined {
  const sentences: string[] = [];
  if (mirrored.length > 0) sentences.push(`Reflejado también en ${enumerate(mirrored)}.`);
  if (retired.length > 0) {
    sentences.push(`${retired.length === 1 ? "Se retiró de «En curso»" : "Se retiraron de «En curso»"}: ${enumerate(retired)}.`);
  }
  // Los avisos llegan ya redactados: cada uno nombra su programa y lo que
  // falta, así que se añaden tal cual en lugar de enumerarlos.
  for (const warning of warned) sentences.push(warning);
  return sentences.length > 0 ? sentences.join(" ") : undefined;
}
