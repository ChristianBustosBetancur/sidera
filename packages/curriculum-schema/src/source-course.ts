import { z } from "zod";

/** Traceable transcription before assigning plan-version identities. */
export const sourceCourseSchema = z.strictObject({
  code: z.string().min(1),
  name: z.string().min(1),
  credits: z.number().int().positive(),
  mandatory: z.boolean(),
  grouping: z.string().min(1),
  page: z.number().int().positive(),
  prerequisites: z.array(z.string().min(1)),
  corequisites: z.array(z.string().min(1)),
  minimumDisciplinaryCredits: z.number().int().positive().optional(),
});
