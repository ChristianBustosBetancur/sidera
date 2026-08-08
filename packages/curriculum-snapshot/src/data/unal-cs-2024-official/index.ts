import type {
  AcademicProgram,
  AcademicProgramId,
  Component,
  ComponentId,
  Course,
  CourseId,
  CurriculumPlan,
  CurriculumPlanId,
  Grouping,
  GroupingId,
  PlanVersion,
  PlanVersionId,
  RequirementExpression,
  University,
  UniversityId,
  VersionCourse,
  VersionCourseId,
} from "@sidera/curriculum-domain";

// Fuente exclusiva: docs/curriculum-sources/acuerdo-0018-2024-materias.md
export const UNAL_CS_2024_OFFICIAL_SOURCE =
  "docs/curriculum-sources/acuerdo-0018-2024-materias.md";

const universityId = "unal" as UniversityId;
const academicProgramId = "unal-cs-medellin" as AcademicProgramId;
const curriculumPlanId = "unal-cs-medellin" as CurriculumPlanId;
const planVersionId = "unal-cs-medellin-acuerdo-0018-2024" as PlanVersionId;

const componentIds = {
  foundation: "unal-cs-2024-foundation" as ComponentId,
  disciplinary: "unal-cs-2024-disciplinary" as ComponentId,
  freeChoice: "unal-cs-2024-free-choice" as ComponentId,
};

const groupingIds = {
  mathematics: "unal-cs-2024-mathematics" as GroupingId,
  programming: "unal-cs-2024-programming" as GroupingId,
  naturalSciences: "unal-cs-2024-natural-sciences-statistics" as GroupingId,
  algorithms: "unal-cs-2024-algorithms-computing" as GroupingId,
  scientificComputing: "unal-cs-2024-scientific-computing" as GroupingId,
  computerSystems: "unal-cs-2024-computer-systems" as GroupingId,
  appliedComputing: "unal-cs-2024-applied-computing" as GroupingId,
  degreeWork: "unal-cs-2024-degree-work" as GroupingId,
};

export const university: University = {
  id: universityId,
  name: "Universidad Nacional de Colombia",
};

export const academicProgram: AcademicProgram = {
  id: academicProgramId,
  universityId,
  name: "Ciencias de la Computación (Sede Medellín)",
};

export const curriculumPlan: CurriculumPlan = {
  id: curriculumPlanId,
  academicProgramId,
  name: "Ciencias de la Computación (Sede Medellín)",
};

export const planVersion: PlanVersion = {
  id: planVersionId,
  curriculumPlanId,
  name: "Acuerdo 0018 de 2024",
  provenance: "official",
  lifecycle: "draft",
  requiredCredits: 146,
};

export const components: Component[] = [
  { id: componentIds.foundation, planVersionId, name: "Componente de Fundamentación", requiredCredits: 61 },
  { id: componentIds.disciplinary, planVersionId, name: "Componente de Formación Disciplinar o Profesional", requiredCredits: 56 },
  { id: componentIds.freeChoice, planVersionId, name: "Componente de Libre Elección", requiredCredits: 29 },
];

export const groupings: Grouping[] = [
  { id: groupingIds.mathematics, componentId: componentIds.foundation, name: "Matemáticas", requiredCredits: 44 },
  { id: groupingIds.programming, componentId: componentIds.foundation, name: "Programación", requiredCredits: 9 },
  { id: groupingIds.naturalSciences, componentId: componentIds.foundation, name: "Ciencias Naturales y Estadística", requiredCredits: 8 },
  { id: groupingIds.algorithms, componentId: componentIds.disciplinary, name: "Algoritmos y Computación", requiredCredits: 19 },
  { id: groupingIds.scientificComputing, componentId: componentIds.disciplinary, name: "Computación Científica", requiredCredits: 16 },
  { id: groupingIds.computerSystems, componentId: componentIds.disciplinary, name: "Sistemas de Cómputo", requiredCredits: 6 },
  { id: groupingIds.appliedComputing, componentId: componentIds.disciplinary, name: "Computación Aplicada", requiredCredits: 7 },
  { id: groupingIds.degreeWork, componentId: componentIds.disciplinary, name: "Trabajo de Grado", requiredCredits: 8 },
];

type CourseDefinition = {
  code: string;
  name: string;
  credits: number;
  mandatory: boolean;
  groupingId: GroupingId;
  prerequisites?: string[];
  corequisites?: string[];
  requirements?: RequirementExpression;
};

const definitions: CourseDefinition[] = [
  { code: "1000004-M", name: "Cálculo diferencial", credits: 4, mandatory: true, groupingId: groupingIds.mathematics },
  { code: "1000005-M", name: "Cálculo integral", credits: 4, mandatory: true, groupingId: groupingIds.mathematics, prerequisites: ["1000004-M"] },
  { code: "1000006-M", name: "Cálculo en varias variables", credits: 4, mandatory: true, groupingId: groupingIds.mathematics, prerequisites: ["1000005-M"] },
  { code: "1000008-M", name: "Geometría vectorial y analítica", credits: 4, mandatory: true, groupingId: groupingIds.mathematics },
  { code: "1000003-M", name: "Álgebra lineal", credits: 4, mandatory: true, groupingId: groupingIds.mathematics, prerequisites: ["1000008-M"] },
  { code: "1000007-M", name: "Ecuaciones diferenciales", credits: 4, mandatory: true, groupingId: groupingIds.mathematics, prerequisites: ["1000003-M"] },
  { code: "3010334", name: "Fundamentos de matemáticas", credits: 4, mandatory: true, groupingId: groupingIds.mathematics },
  { code: "3010390", name: "Fundamentos de matemáticas discretas", credits: 4, mandatory: true, groupingId: groupingIds.mathematics, prerequisites: ["3010334"] },
  { code: "3010389", name: "Fundamentos de análisis", credits: 4, mandatory: true, groupingId: groupingIds.mathematics, prerequisites: ["3010334", "1000004-M"] },
  { code: "3006934", name: "Probabilidad", credits: 4, mandatory: true, groupingId: groupingIds.mathematics, prerequisites: ["1000005-M"] },
  { code: "3006994", name: "Introducción al análisis real", credits: 4, mandatory: false, groupingId: groupingIds.mathematics, prerequisites: ["3010389"] },
  { code: "3006993", name: "Grupos y anillos", credits: 4, mandatory: false, groupingId: groupingIds.mathematics, prerequisites: ["3010390"] },
  { code: "3011247", name: "Combinatoria Intermedia", credits: 4, mandatory: false, groupingId: groupingIds.mathematics, prerequisites: ["3010390"] },
  { code: "3006900", name: "Introducción a la teoría de grafos", credits: 4, mandatory: false, groupingId: groupingIds.mathematics, prerequisites: ["3010390"] },
  { code: "3009257", name: "Teoría elemental de números", credits: 4, mandatory: false, groupingId: groupingIds.mathematics, prerequisites: ["3010390"] },
  { code: "3006905", name: "Matemáticas especiales", credits: 4, mandatory: false, groupingId: groupingIds.mathematics, prerequisites: ["1000007-M"], corequisites: ["1000006-M"] },

  { code: "3010435", name: "Fundamentos de programación", credits: 3, mandatory: true, groupingId: groupingIds.programming },
  { code: "3007744", name: "Programación orientada a objetos", credits: 3, mandatory: true, groupingId: groupingIds.programming, prerequisites: ["3010435"] },
  { code: "3007741", name: "Estructura de datos", credits: 3, mandatory: true, groupingId: groupingIds.programming, prerequisites: ["3007744"] },

  { code: "3006929", name: "Inferencia estadística", credits: 4, mandatory: true, groupingId: groupingIds.naturalSciences, prerequisites: ["3006934"] },
  { code: "1000019-M", name: "Física mecánica", credits: 4, mandatory: false, groupingId: groupingIds.naturalSciences, prerequisites: ["1000004-M"] },
  { code: "1000018-M", name: "Física moderna", credits: 3, mandatory: false, groupingId: groupingIds.naturalSciences, prerequisites: ["1000006-M"] },
  { code: "3006829", name: "Química general", credits: 3, mandatory: false, groupingId: groupingIds.naturalSciences },
  { code: "3006817", name: "Biología molecular", credits: 4, mandatory: false, groupingId: groupingIds.naturalSciences },
  { code: "3007826", name: "Termodinámica general", credits: 4, mandatory: false, groupingId: groupingIds.naturalSciences, prerequisites: ["1000004-M"] },

  { code: "3010393", name: "Introducción a la teoría de la computación", credits: 4, mandatory: true, groupingId: groupingIds.algorithms, prerequisites: ["3010390", "3007741"] },
  { code: "3010392", name: "Introducción a algoritmos", credits: 4, mandatory: true, groupingId: groupingIds.algorithms, prerequisites: ["3007741", "3010390", "3006934"] },
  { code: "3008082", name: "Criptografía y seguridad", credits: 4, mandatory: true, groupingId: groupingIds.algorithms, prerequisites: ["3006934"] },
  { code: "3006995", name: "Programación lineal y optimización combinatórica", credits: 4, mandatory: false, groupingId: groupingIds.algorithms, prerequisites: ["1000006-M", "1000003-M", "3010390"] },
  { code: "3010426", name: "Teoría de lenguajes de programación", credits: 3, mandatory: false, groupingId: groupingIds.algorithms, prerequisites: ["3010435", "3010390"] },
  { code: "3006894", name: "Introducción al álgebra computacional", credits: 4, mandatory: false, groupingId: groupingIds.algorithms, prerequisites: ["3006993"] },
  { code: "3010590", name: "Tópicos avanzados en criptografía", credits: 4, mandatory: false, groupingId: groupingIds.algorithms, prerequisites: ["3008082"] },
  { code: "3010591", name: "Tópicos especiales en algoritmos", credits: 4, mandatory: false, groupingId: groupingIds.algorithms, prerequisites: ["3010392"] },
  { code: "3011112", name: "Introducción al programa de Ciencias de la Computación", credits: 2, mandatory: false, groupingId: groupingIds.algorithms },

  { code: "3006886", name: "Análisis numérico", credits: 4, mandatory: true, groupingId: groupingIds.scientificComputing, prerequisites: ["3010389", "1000005-M"], corequisites: ["1000007-M"] },
  { code: "3010391", name: "Geometría aplicada", credits: 4, mandatory: true, groupingId: groupingIds.scientificComputing, prerequisites: ["1000003-M", "1000006-M"] },
  { code: "3006909", name: "Programación científica", credits: 4, mandatory: false, groupingId: groupingIds.scientificComputing, prerequisites: ["1000003-M"] },
  { code: "3006888", name: "Diseño Geométrico Asistido por Computadora", credits: 4, mandatory: false, groupingId: groupingIds.scientificComputing, prerequisites: ["1000006-M", "3010391"] },
  { code: "3011075", name: "Modelamiento matemático", credits: 4, mandatory: false, groupingId: groupingIds.scientificComputing, prerequisites: ["1000007-M"] },
  { code: "3006884", name: "Álgebra lineal aplicada", credits: 4, mandatory: false, groupingId: groupingIds.scientificComputing, prerequisites: ["1000006-M", "1000003-M"] },
  { code: "3006996", name: "Programación no lineal", credits: 4, mandatory: false, groupingId: groupingIds.scientificComputing, prerequisites: ["3010389", "1000006-M", "1000003-M"] },
  { code: "3010588", name: "Computación gráfica y visualización científica", credits: 4, mandatory: false, groupingId: groupingIds.scientificComputing, prerequisites: ["3010391", "3007744"] },

  { code: "3007867", name: "Sistemas operativos", credits: 3, mandatory: false, groupingId: groupingIds.computerSystems, prerequisites: ["3010426"] },
  { code: "3007865", name: "Redes y telecomunicaciones I", credits: 3, mandatory: false, groupingId: groupingIds.computerSystems, prerequisites: ["3007867"] },
  { code: "3007866", name: "Redes y telecomunicaciones II", credits: 3, mandatory: false, groupingId: groupingIds.computerSystems, prerequisites: ["3007867"] },
  { code: "3007847", name: "Base de datos I", credits: 3, mandatory: false, groupingId: groupingIds.computerSystems, prerequisites: ["3007741", "3010390"] },
  { code: "3007848", name: "Base de datos II", credits: 3, mandatory: false, groupingId: groupingIds.computerSystems, prerequisites: ["3007847"] },

  { code: "3009754", name: "Física computacional", credits: 3, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["1000019-M"] },
  { code: "3006830", name: "Bioinformática", credits: 4, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3006817"] },
  { code: "3006988", name: "Fundamentos de sistemas de información geográfica", credits: 3, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3010435"] },
  { code: "3010476", name: "Introducción a la inteligencia artificial", credits: 3, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3007847", "3006934"] },
  { code: "3007854", name: "Técnicas en aprendizaje estadístico", credits: 3, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3010476"] },
  { code: "3009150", name: "Redes neuronales artificiales y algoritmos bio-inspirados", credits: 3, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3010476"] },
  { code: "3009151", name: "Introducción a la robótica", credits: 3, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3010476"] },
  { code: "3010589", name: "Realidad virtual y aumentada", credits: 4, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3010391", "3007744"] },
  { code: "3011063", name: "Aprendizaje automático", credits: 4, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3006934", "1000006-M", "3007744"] },
  { code: "3006935", name: "Procesos estocásticos", credits: 4, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3006934"] },
  { code: "3006926", name: "Estadística bayesiana", credits: 4, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3006929"] },
  { code: "3010604", name: "Introducción a analítica", credits: 4, mandatory: false, groupingId: groupingIds.appliedComputing, prerequisites: ["3006929"] },

  { code: "3010664", name: "Trabajo de grado", credits: 8, mandatory: true, groupingId: groupingIds.degreeWork, requirements: { type: "MIN_COMPONENT_CREDITS", componentId: componentIds.disciplinary, credits: 34 } },
];

const versionCourseId = (code: string): VersionCourseId =>
  `unal-cs-2024:${code}` as VersionCourseId;

const requirementFor = (definition: CourseDefinition): RequirementExpression | undefined => {
  if (definition.requirements !== undefined) return definition.requirements;

  const children: RequirementExpression[] = [
    ...(definition.prerequisites ?? []).map((code) => ({
      type: "COURSE_COMPLETED" as const,
      versionCourseId: versionCourseId(code),
    })),
    ...(definition.corequisites ?? []).map((code) => ({
      type: "COURSE_COMPLETED_OR_CONCURRENT" as const,
      versionCourseId: versionCourseId(code),
    })),
  ];

  if (children.length === 0) return undefined;
  return children.length === 1 ? children[0]! : { type: "ALL", children };
};

export const courses: Course[] = definitions.map(({ code, name }) => ({
  id: `unal:${code}` as CourseId,
  universityId,
  name,
}));

export const versionCourses: VersionCourse[] = definitions.map((definition) => {
  const requirements = requirementFor(definition);
  return {
    id: versionCourseId(definition.code),
    planVersionId,
    courseId: `unal:${definition.code}` as CourseId,
    groupingId: definition.groupingId,
    academicCode: definition.code,
    credits: definition.credits,
    mandatory: definition.mandatory,
    ...(requirements === undefined ? {} : { requirements }),
  };
});

export const unalCs2024Official = {
  university,
  academicProgram,
  curriculumPlan,
  planVersion,
  components,
  groupings,
  courses,
  versionCourses,
};
