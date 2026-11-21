import { z } from "zod";

const mark = z.enum(["UNMARKED", "IN_PROGRESS", "COMPLETED"]);
export const academicRecordsSchema = z.strictObject({
  formatVersion: z.literal(2),
  activeProgram: z.string().min(1),
  dual: z.boolean(),
  plans: z.record(z.string(), z.strictObject({
    marks: z.record(z.string(), mark),
    externalCompleted: z.record(z.string(), z.boolean()),
  })),
  sharedFacts: z.record(z.string(), mark),
});
