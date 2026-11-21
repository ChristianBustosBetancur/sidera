/** Transcription of Article 1. Page numbers refer to the supplied five-page PDF.
 * This source layer deliberately keeps academic codes, before adapting them
 * to VersionCourse identities and the engine's evaluation context.
 */
export const mathematicsSource = {
  title: "Acuerdo 038 de 2020, Consejo de la Facultad de Ciencias, Sede Medellín",
  url: "https://legal.unal.edu.co/rlunal/home/doc.jsp?d_i=95409",
  issued: "2020-04-15",
  effective: "2020-05-26",
} as const;

export const mathematicsComponents = [
  { key: "foundation", name: "Componente de Fundamentación", requiredCredits: 48, mandatoryCredits: 40, electiveCredits: 8 },
  { key: "disciplinary", name: "Componente de Formación Disciplinar o Profesional", requiredCredits: 64, mandatoryCredits: 48, electiveCredits: 16 },
  { key: "free-choice", name: "Componente de Libre Elección", requiredCredits: 28, mandatoryCredits: 0, electiveCredits: 28 },
] as const;

export const mathematicsGroupings = [
  { key: "physics", component: "foundation", name: "Fundamentación en Física", requiredCredits: 8 },
  { key: "geometry", component: "foundation", name: "Geometría Básica", requiredCredits: 4 },
  { key: "mathematics", component: "foundation", name: "Matemática", requiredCredits: 36 },
  { key: "electives", component: "disciplinary", name: "Electivas Disciplinares", requiredCredits: 4 },
  { key: "analysis", component: "disciplinary", name: "Análisis y Topología", requiredCredits: 28 },
  { key: "algebra", component: "disciplinary", name: "Álgebra y Lógica", requiredCredits: 16 },
  { key: "applied", component: "disciplinary", name: "Matemática Aplicada", requiredCredits: 8 },
  { key: "degree", component: "disciplinary", name: "Trabajo de Grado", requiredCredits: 8 },
] as const;

export type MathematicsSourceCourse = {
  code: string;
  name: string;
  credits: number;
  mandatory: boolean;
  grouping: typeof mathematicsGroupings[number]["key"];
  page: 3 | 4 | 5;
  prerequisites: readonly string[];
  corequisites: readonly string[];
  minimumDisciplinaryCredits?: number;
};

function course(code: string, name: string, grouping: MathematicsSourceCourse["grouping"], page: MathematicsSourceCourse["page"], mandatory: boolean, prerequisites: string[] = [], corequisites: string[] = []): MathematicsSourceCourse {
  return { code, name, grouping, page, mandatory, credits: 4, prerequisites, corequisites };
}

export const mathematicsSourceCourses: readonly MathematicsSourceCourse[] = [
  course("1000019-M", "Física mecánica", "physics", 3, true, ["1000004-M"]),
  course("1000020-M", "Física de oscilaciones ondas y óptica", "physics", 3, false, ["1000019-M", "1000007-M"]),
  course("1000017-M", "Física de electricidad y magnetismo", "physics", 3, false, ["1000019-M", "1000005-M"]),
  course("3010594", "Geometría euclidiana y no euclidiana", "geometry", 3, false),
  course("1000008-M", "Geometría vectorial y analítica", "geometry", 3, false),
  course("1000004-M", "Cálculo diferencial", "mathematics", 3, true),
  course("1000005-M", "Cálculo integral", "mathematics", 3, true, ["1000004-M"]),
  course("1000006-M", "Cálculo en varias variables", "mathematics", 3, true, ["1000005-M"]),
  course("1000003-M", "Álgebra lineal", "mathematics", 3, true),
  course("1000007-M", "Ecuaciones diferenciales", "mathematics", 3, true, ["1000005-M", "1000003-M"]),
  course("3010334", "Fundamentos de matemáticas", "mathematics", 3, true),
  course("3010390", "Fundamentos de matemática discretas", "mathematics", 3, true, ["3010334"]),
  course("3010389", "Fundamentos de análisis", "mathematics", 3, true, ["3010334", "1000004-M"]),
  course("3010394", "Teoría básica de la probabilidad", "mathematics", 3, true, ["1000005-M", "3010390"]),
  course("3006903", "Introducción a la teoría de representación de grupos", "electives", 3, false, ["3006993", "3006885"]),
  course("3006893", "Introducción a la geometría algebraica", "electives", 3, false, ["3006993", "3006913"]),
  course("3006900", "Introducción a la teoría de grafos", "electives", 4, false),
  course("3006902", "Introducción a la teoría de nudos", "electives", 4, false),
  course("3009257", "Teoría elemental de números", "electives", 4, false),
  course("3009354", "Introducción al álgebra no necesariamente asociativas", "electives", 4, false, ["3006993"]),
  course("3006898", "Introducción a la teoría de la computabilidad", "electives", 4, false, ["3010390"]),
  course("3006899", "Introducción a la teoría de conjuntos", "electives", 4, false, ["3006994"]),
  course("3006894", "Introducción al álgebra computacional", "electives", 4, false, ["3006993"]),
  course("3006897", "Introducción a las superficies de Riemann", "electives", 4, false, ["3006735"]),
  course("3006895", "Introducción al álgebra conmutativa", "electives", 4, false, ["3006993"]),
  course("3010635", "Pruebas básicas de independencia", "electives", 4, false, ["3006904"]),
  course("3010670", "Introducción a la filosofía de las matemáticas", "electives", 4, false, ["3010389"]),
  course("3010671", "Introducción a la teoría de modelos y la recursión", "electives", 4, false, ["3006904"]),
  course("3010393", "Introducción a la teoría de la computación", "electives", 4, false, ["3010390"]),
  course("3010392", "Introducción a algoritmos", "electives", 4, false, ["3010390"]),
  course("3010590", "Tópicos avanzados en criptografía", "electives", 4, false, ["3008082"]),
  course("3010591", "Tópicos especiales en algoritmos", "electives", 4, false, ["3010392"]),
  course("3010802", "Combinatoria", "electives", 4, false, ["3010394"]),
  course("3010767", "Geometría hiperbólica y grupos fruchsianos", "electives", 4, false, ["3006994", "3006993"]),
  course("3010789", "Tópicos en teoría de números", "electives", 4, false, ["3006993", "3006994"]),
  course("3006994", "Introducción al análisis real", "analysis", 4, true, ["3010389"]),
  course("3006892", "Integración y series", "analysis", 4, true, ["3006994"]),
  course("3006887", "Análisis vectorial", "analysis", 4, true, ["3006892"]),
  course("3006913", "Topología general", "analysis", 4, true, ["3006994"]),
  course("3006735", "Variable compleja", "analysis", 4, true, ["3006892"]),
  course("3006890", "Geometría diferencial", "analysis", 4, false, ["1000003-M", "1000006-M"], ["3006887"]),
  course("3006896", "Introducción al análisis funcional", "analysis", 4, false, ["3006892"]),
  course("3006889", "Ecuaciones diferenciales parciales: introducción", "analysis", 4, false, ["3006892", "1000007-M"]),
  course("3006910", "Sistemas dinámicos", "analysis", 4, false, ["1000007-M"]),
  course("3006912", "Topología algebraica I", "analysis", 4, false, ["3006993", "3006913"]),
  course("3006901", "Introducción a la teoría de la medida", "analysis", 4, false, ["3006892"]),
  course("3009597", "Introducción a la topología diferencial", "analysis", 4, false, ["3006913"], ["3006887"]),
  course("3010586", "Introducción a la topología algebraica avanzada", "analysis", 4, false, ["3006913", "3006993"]),
  course("3006993", "Grupos y anillos", "algebra", 4, true, ["3010390"]),
  course("3006885", "Álgebra multilineal y formas canónicas", "algebra", 4, true, ["3006993"]),
  course("3006911", "Teoría de cuerpos", "algebra", 4, true, ["3006993"]),
  course("3006904", "Lógica matemática", "algebra", 4, true, ["3006993"]),
  course("3006886", "Análisis numérico", "applied", 5, true, ["3006994"]),
  course("3006909", "Programación científica", "applied", 5, false),
  course("3008082", "Criptografía y seguridad", "applied", 5, false, ["3010394"]),
  course("3006884", "Álgebra lineal aplicada", "applied", 5, false, ["1000006-M", "1000003-M"]),
  course("3006908", "Modelamiento matemático", "applied", 5, false, ["1000007-M"]),
  course("3006996", "Programación no lineal", "applied", 5, false, ["3010389", "1000006-M", "1000003-M"]),
  course("3006888", "Diseño geométrico asistido por computadora", "applied", 5, false, ["1000006-M", "1000003-M"]),
  course("3006995", "Programación lineal y optimización combinatórica", "applied", 5, false, ["1000006-M", "1000003-M", "3010390"]),
  course("3010391", "Geometría aplicada", "applied", 5, false, ["1000003-M"]),
  course("3010588", "Computación gráfica y visualización científica", "applied", 5, false, ["3010391", "3007744"]),
  { code: "3006946", name: "Trabajo de grado", credits: 8, mandatory: true, grouping: "degree", page: 5, prerequisites: [], corequisites: [], minimumDisciplinaryCredits: 40 },
];

export const mathematicsExternalReferences = [
  { code: "3007744", name: "Programación orientada a objetos", requiredBy: "3010588", page: 5 },
] as const;

/** Not a second independent mandatory eight-credit course. See source audit. */
export const mathematicsPendingAlternatives = [
  { code: "3006947", name: "Cursos de posgrado", grouping: "degree", alternativeTo: "3006946", page: 5, status: "pending-model-verification" },
] as const;
