import type { CourseId } from "@sidera/curriculum-domain";
import { unalCs2024Official, unalMathematics2020 } from "@sidera/curriculum-snapshot";
import { createCurriculumData } from "./curriculum-data";
import { orderMathematicsGroupings } from "./program-presentation";

export const programs = [
  { id: "computing", label: "Ciencias de la Computación", ...createCurriculumData(unalCs2024Official) },
  { id: "mathematics", label: "Matemáticas", ...createCurriculumData({ ...unalMathematics2020, groupings: orderMathematicsGroupings(unalMathematics2020.groupings) }) },
];
export type AcademicProgramData = typeof programs[number];
export const programModels = programs.map(program => ({ id: program.id, context: program.evaluationContext }));

// These full-code identities occur in both official transcriptions. Different
// prerequisites belong to the plan, rather than changing institutional identity.
// OOP is a verified external requirement in Mathematics, never a credit-bearing
// VersionCourse in that plan.
const confirmedCodes = [
  "1000003-M", "1000004-M", "1000005-M", "1000006-M", "1000007-M", "1000008-M", "1000019-M",
  "3010334", "3010390", "3010389", "3006994", "3006993", "3006900", "3009257", "3010393", "3010392",
  "3008082", "3006995", "3006894", "3010590", "3010591", "3006886", "3010391", "3006909", "3006888", "3006884", "3006996", "3010588", "3007744",
];
export const verifiedShared: CourseId[] = confirmedCodes.flatMap(code => {
  const computing = programs[0]!.snapshot.versionCourses.find(course => course.academicCode === code);
  const mathematics = programs[1]!.snapshot.versionCourses.find(course => course.academicCode === code);
  if (!computing) return [];
  if (mathematics && computing.courseId === mathematics.courseId && computing.credits === mathematics.credits) return [computing.courseId];
  return code === "3007744" && unalMathematics2020.externalCourses.some(course => course.id === computing.courseId) ? [computing.courseId] : [];
});

export function academicCourseName(courseId: CourseId): string {
  const course = programs.flatMap(program => [...program.coursesById.values()]).find(course => course.id === courseId);
  return `${courseId.replace("unal:", "")} — ${course?.name ?? "Asignatura"}`;
}
