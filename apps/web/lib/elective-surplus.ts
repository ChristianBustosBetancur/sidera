import type { VersionCourse, VersionCourseId } from "@sidera/curriculum-domain";

/* Lectura de presentación sobre el cupo optativo de una agrupación.

   No calcula créditos ni porcentajes: reproduce el reparto que el motor ya
   hizo —`electiveCapacity = requeridos − obligatorias`, y las optativas
   contadas hasta ese tope— para poder decir en la interfaz qué asignatura
   quedó fuera y por qué la barra no se mueve.

   El orden es determinista y no depende de en qué orden se marcaron las
   asignaturas: primero las Completadas, que es como el motor consume el cupo,
   y dentro de cada estado por código académico ascendente. Así la misma
   trayectoria produce siempre el mismo excedente, con o sin Doble Titulación. */

export type ElectiveSurplus = {
  /** Créditos optativos que la agrupación puede reconocer. */
  capacity: number;
  /** Optativas marcadas que no caben en el cupo. */
  surplus: VersionCourseId[];
  /** Créditos marcados por encima del cupo. */
  surplusCredits: number;
  /** El cupo optativo está cubierto: marcar más optativas no mueve la barra. */
  electivesFull: boolean;
  /** Obligatorias de la agrupación aún sin aprobar. */
  missingMandatory: VersionCourseId[];
};

export function electiveSurplus({ courses, requiredCredits, completed, inProgress }: {
  courses: readonly VersionCourse[];
  requiredCredits: number;
  completed: ReadonlySet<VersionCourseId>;
  inProgress: ReadonlySet<VersionCourseId>;
}): ElectiveSurplus {
  const mandatoryCredits = courses
    .filter(course => course.mandatory)
    .reduce((total, course) => total + course.credits, 0);
  const capacity = Math.max(requiredCredits - mandatoryCredits, 0);

  const byCode = (a: VersionCourse, b: VersionCourse) => a.academicCode.localeCompare(b.academicCode);
  const electives = courses.filter(course => !course.mandatory);
  const marked = [
    ...electives.filter(course => completed.has(course.id)).sort(byCode),
    ...electives.filter(course => inProgress.has(course.id)).sort(byCode),
  ];
  const markedCredits = marked.reduce((total, course) => total + course.credits, 0);

  const surplus: VersionCourseId[] = [];
  let counted = 0;
  for (const course of marked) {
    // Una asignatura que empieza dentro del cupo cuenta, aunque lo rebase:
    // así el recuento por asignatura nunca contradice al del motor.
    if (counted >= capacity) surplus.push(course.id);
    else counted += course.credits;
  }

  return {
    capacity,
    surplus,
    surplusCredits: Math.max(markedCredits - capacity, 0),
    electivesFull: capacity > 0 && markedCredits >= capacity,
    missingMandatory: courses
      .filter(course => course.mandatory && !completed.has(course.id))
      .sort(byCode)
      .map(course => course.id),
  };
}

/* «Optativas completas · falta 3006886 Análisis numérico»: sin esta línea, una
   agrupación con el cupo lleno parece congelada al marcar más optativas. */
export function electivesFullNote(
  surplus: ElectiveSurplus,
  reference: (versionCourseId: VersionCourseId) => string,
): string | undefined {
  if (!surplus.electivesFull || surplus.missingMandatory.length === 0) return undefined;
  const [first, second, ...rest] = surplus.missingMandatory;
  const names = [first, second].filter((id): id is VersionCourseId => id !== undefined).map(reference);
  const tail = rest.length > 0 ? ` y ${rest.length} más` : "";
  return `Optativas completas · ${names.length === 1 ? "falta" : "faltan"} ${names.join(", ")}${tail}`;
}

export function surplusNote(surplus: ElectiveSurplus): string | undefined {
  if (surplus.surplusCredits === 0) return undefined;
  return surplus.surplusCredits === 1
    ? "+1 crédito excedente"
    : `+${surplus.surplusCredits} créditos excedentes`;
}
