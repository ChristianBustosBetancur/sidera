#!/usr/bin/env node
// STUB SIMULADO de IMPLEMENT — TASK-003.2 FASE 1.
// NO invoca Codex. NO invoca ningun modelo. No escribe codigo de produccion.
// Existe para ejercitar la maquina de estados, la observabilidad y el abort humano.

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).slice(n.length + 3);

const task = arg("task", "UNKNOWN");
const attempt = arg("attempt", "1");
const delay = Number(arg("delay", "600"));
const out = arg("out", join(REPO, ".agent", "implement.log"));
const writeRepoFile = process.argv.includes("--write-repo-file");

const header = `SIMULATED OUTPUT — NOT PRODUCED BY ANY MODEL
=============================================
Este archivo lo genero el stub tools/agent/stubs/implement.mjs.
Codex NO fue invocado. Ningun modelo real participo.
task=${task} attempt=${attempt} delay=${delay}ms
`;

console.log("[SIMULATED] IMPLEMENT — ningun modelo fue invocado");

// Espacio de trabajo simulado, dentro de .agent/ (ignorado por git).
const ws = join(REPO, ".agent", "simulated-workspace", task);
mkdirSync(ws, { recursive: true });
writeFileSync(join(ws, `implement-attempt-${attempt}.txt`), `${header}\nCambio simulado numero ${attempt}.\n`);

// Solo para la prueba manual T5: deja un archivo real en el working tree,
// para poder comprobar que un Ctrl+C NO lo destruye.
if (writeRepoFile) {
  const scratch = join(REPO, "SIMULATED-T5-SCRATCH.md");
  writeFileSync(scratch, `${header}\nArchivo de prueba para T5. Borralo a mano cuando termines.\n`);
  console.log("[SIMULATED] escribio SIMULATED-T5-SCRATCH.md en el working tree (solo para T5)");
}

const finish = () => {
  appendFileSync(out, `${header}\nSTUB IMPLEMENT completado para attempt ${attempt}.\n`);
  console.log("[SIMULATED] IMPLEMENT terminado");
};

// El retardo hace que exista un proceso hijo real al que enviar Ctrl+C.
setTimeout(finish, delay);
