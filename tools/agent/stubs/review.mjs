#!/usr/bin/env node
// STUB SIMULADO de REVIEW — TASK-003.2 FASE 1.
// NO invoca Claude. NO invoca ningun modelo. El veredicto es fijo y viene por flag.
// --verdict=pass    -> bloque JSON con verdict PASS
// --verdict=fail    -> bloque JSON con verdict FAIL y blockers ficticios
// --verdict=invalid -> salida SIN bloque JSON valido (para probar unparseable-verdict)

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).slice(n.length + 3);

const verdict = arg("verdict", "pass");
const task = arg("task", "UNKNOWN");
const out = arg("out", join(REPO, ".agent", "review.md"));

const header = `# SIMULATED OUTPUT — NOT PRODUCED BY ANY MODEL

Este texto lo genero el stub \`tools/agent/stubs/review.mjs\`.
**Claude NO fue invocado. Ningun modelo real participo.**
No contiene ni pretende contener razonamiento de ningun modelo.

TASK: ${task}
Veredicto forzado por flag: \`--verdict=${verdict}\`
`;

const bodies = {
  pass: `${header}\nRevision simulada sin hallazgos.\n\n\`\`\`json\n${JSON.stringify(
    { verdict: "PASS", blockers: [], nonBlocking: ["observacion simulada, no accionable"] },
    null,
    2,
  )}\n\`\`\`\n`,
  fail: `${header}\nRevision simulada con hallazgos ficticios.\n\n\`\`\`json\n${JSON.stringify(
    {
      verdict: "FAIL",
      blockers: [
        { file: "SIMULATED/path/one.ts", issue: "Blocker ficticio 1 — generado por el stub, no por un modelo." },
        { file: "SIMULATED/path/two.ts", issue: "Blocker ficticio 2 — generado por el stub, no por un modelo." },
      ],
      nonBlocking: [],
    },
    null,
    2,
  )}\n\`\`\`\n`,
  invalid: `${header}\nSalida deliberadamente sin bloque JSON valido.\n\nverdict: probablemente PASS, supongo.\n`,
};

console.log(`[SIMULATED] REVIEW — ningun modelo fue invocado (verdict=${verdict})`);
writeFileSync(out, bodies[verdict] ?? bodies.invalid);
console.log("[SIMULATED] REVIEW terminado");
