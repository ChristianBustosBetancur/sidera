import { z } from "zod";

const mark = z.enum(["UNMARKED", "IN_PROGRESS", "COMPLETED"]);
export const academicRecordsSchema = z.strictObject({
  formatVersion: z.literal(2),
  activeProgram: z.string().min(1),
  dual: z.boolean(),
  // Opcional: los registros guardados antes de la Doble Titulación simulada no
  // lo traen y se migran al cargarlos.
  originProgram: z.string().min(1).optional(),
  plans: z.record(z.string(), z.strictObject({
    marks: z.record(z.string(), mark),
    externalCompleted: z.record(z.string(), z.boolean()),
    /* Asignaturas que el estudiante declara como Libre Elección. Opcional: los
       registros guardados antes de existir esta función siguen siendo válidos
       y se completan con una lista vacía al cargarlos, sin cambiar de versión
       de formato ni invalidar nada. Pertenecen al plan que las contiene, de
       modo que cada programa conserva las suyas. */
    freeChoice: z.array(z.strictObject({
      id: z.string().min(1),
      name: z.string().min(1),
      credits: z.number().int().positive(),
      mark: z.enum(["COMPLETED", "IN_PROGRESS"]),
      academicCode: z.string().min(1).optional(),
      origin: z.literal("manual"),
    })).optional(),
  })),
  sharedFacts: z.record(z.string(), mark),
});
