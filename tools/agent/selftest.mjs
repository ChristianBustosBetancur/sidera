#!/usr/bin/env node
// Regresiones del snapshot de REVIEW y del manejo estricto de evidencia git.
// Usa un repositorio temporal aislado y elimina exclusivamente ese fixture.

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMP_ROOT = join(REPO, ".agent");
mkdirSync(TEMP_ROOT, { recursive: true });
const FIXTURE = mkdtempSync(join(TEMP_ROOT, "selftest-"));
const RUNNER = join(FIXTURE, "tools", "agent", "run.mjs");
const STATE = join(FIXTURE, ".agent", "state.json");
const TASK = "TASK-SELFTEST";
const SHIM_DIR = join(FIXTURE, "selftest-bin");

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const command = (program, args, options = {}) =>
  spawnSync(program, args, { cwd: FIXTURE, encoding: "utf8", ...options });

function git(args) {
  const result = command("git", args);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} fallo:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

const runner = (args) =>
  command(process.execPath, [RUNNER, ...args], {
    env: { ...process.env, PATH: `${SHIM_DIR}${delimiter}${process.env.PATH ?? ""}` },
  });

function latestRunDir() {
  const base = join(FIXTURE, ".agent", "runs", TASK);
  return readdirSync(base)
    .map((name) => join(base, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

function installFixtureRepo() {
  mkdirSync(join(FIXTURE, "tools", "agent", "stubs"), { recursive: true });
  mkdirSync(join(FIXTURE, "docs", "tasks"), { recursive: true });
  mkdirSync(SHIM_DIR, { recursive: true });
  copyFileSync(join(REPO, "tools", "agent", "run.mjs"), RUNNER);
  copyFileSync(join(REPO, "tools", "agent", "stubs", "implement.mjs"), join(FIXTURE, "tools", "agent", "stubs", "implement.mjs"));
  copyFileSync(join(REPO, "tools", "agent", "stubs", "review.mjs"), join(FIXTURE, "tools", "agent", "stubs", "review.mjs"));
  writeFileSync(join(FIXTURE, ".gitignore"), ".agent/\n");
  writeFileSync(join(FIXTURE, "pnpm-workspace.yaml"), "packages: []\n");
  if (process.platform === "win32") {
    writeFileSync(join(SHIM_DIR, "pnpm.cmd"), "@echo off\r\nexit /b 0\r\n");
  } else {
    const shim = join(SHIM_DIR, "pnpm");
    writeFileSync(shim, "#!/bin/sh\nexit 0\n");
    chmodSync(shim, 0o755);
  }
  writeFileSync(join(FIXTURE, "docs", "tasks", `${TASK}.md`), `# ${TASK}\n`);
  writeFileSync(
    join(FIXTURE, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        scripts: Object.fromEntries(["lint", "typecheck", "test", "build"].map((name) => [name, "node -e \"process.exit(0)\""])),
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(FIXTURE, "tracked-modified.txt"), "original modified\n");
  writeFileSync(join(FIXTURE, "tracked-deleted.txt"), "original deleted\n");
  writeFileSync(join(FIXTURE, "tracked-renamed-old.txt"), "rename body\n");
  writeFileSync(join(FIXTURE, "tracked-staged.txt"), "original staged\n");
  git(["init", "-b", "task/selftest"]);
  git(["add", "."]);
  git(["-c", "user.name=Sidera Selftest", "-c", "user.email=selftest@example.invalid", "commit", "-m", "fixture baseline"]);
}

function createChanges() {
  writeFileSync(join(FIXTURE, "tracked-modified.txt"), "MODIFIED_MARKER\n");
  unlinkSync(join(FIXTURE, "tracked-deleted.txt"));
  git(["mv", "tracked-renamed-old.txt", "tracked-renamed-new.txt"]);
  writeFileSync(join(FIXTURE, "tracked-staged.txt"), "STAGED_MARKER\n");
  git(["add", "tracked-staged.txt"]);
  writeFileSync(join(FIXTURE, "untracked with spaces.txt"), "SPACES_MARKER\n");
  writeFileSync(join(FIXTURE, "untracked-café-ñ.txt"), "UNICODE_MARKER\n");
  mkdirSync(join(FIXTURE, "nested", "deep"), { recursive: true });
  writeFileSync(join(FIXTURE, "nested", "deep", "untracked.txt"), "NESTED_MARKER\n");
  writeFileSync(join(FIXTURE, "untracked-binary.bin"), Buffer.from([0, 255, 1, 2, 3, 0, 128]));
}

console.log("\n== Snapshot completo de REVIEW ==");
try {
  installFixtureRepo();
  createChanges();

  const result = runner([TASK, "--review=pass", "--reset", "--implement-delay=0"]);
  check(
    "runner termino en HUMAN_GATE",
    result.status === 0,
    `exit ${result.status}${result.status === 0 ? "" : `\n${result.stdout}\n${result.stderr}`}`,
  );
  if (result.status !== 0) {
    throw new Error("el runner no produjo un snapshot");
  }

  const attempt = join(latestRunDir(), "attempt-1");
  const patch = readFileSync(join(attempt, "30-diff.patch"), "utf8");
  const status = readFileSync(join(attempt, "31-status.txt"), "utf8");
  const reviewPrompt = readFileSync(join(attempt, "40-review-prompt.md"), "utf8");
  const records = status.split("\n").filter(Boolean);

  check("status no contiene bytes NUL", !status.includes("\0"));
  check("review prompt no contiene bytes NUL de status", !reviewPrompt.includes("\0"));
  check("status con multiples entradas produce multiples lineas", records.length > 1);
  check("untracked con espacios conserva el path", records.includes("?? untracked with spaces.txt"));
  check("untracked Unicode conserva el path", records.includes("?? untracked-café-ñ.txt"));
  check("nested path conserva el path", records.includes("?? nested/deep/untracked.txt"));
  check(
    "rename conserva destino y origen",
    records.some((record) => /^R. tracked-renamed-new\.txt <- tracked-renamed-old\.txt$/.test(record)),
  );
  check("contenido de untracked con espacios incluido", patch.includes("SPACES_MARKER"));
  check("contenido de untracked Unicode incluido", patch.includes("UNICODE_MARKER"));
  check("contenido de nested untracked incluido", patch.includes("NESTED_MARKER"));
  check("binario incluido como evidencia", patch.includes("untracked-binary.bin") && /Binary files|GIT binary patch/.test(patch));
  check("regresion modified", patch.includes("MODIFIED_MARKER"));
  check("regresion deleted", patch.includes("deleted file mode") && patch.includes("tracked-deleted.txt"));
  check("regresion renamed", patch.includes("tracked-renamed-old.txt") && patch.includes("tracked-renamed-new.txt"));
  check("regresion staged", patch.includes("STAGED_MARKER"));
  check("el index staged permanece intacto", git(["diff", "--cached"]).includes("STAGED_MARKER"));

  console.log("\n== Untracked desaparecido entre status y diff ==");
  const missing = runner([TASK, "--review=pass", "--reset", "--implement-delay=0", "--force-git-failure=untracked-missing"]);
  check("runner se detiene ante el archivo desaparecido", missing.status === 1, `exit ${missing.status}`);
  check("terminal reporta fallo de evidencia untracked", /GIT\s+FAIL\s+git untracked/.test(missing.stdout));
  const state = JSON.parse(readFileSync(STATE, "utf8"));
  check("phase = STOPPED", state.phase === "STOPPED", `phase=${state.phase}`);
  check("stopReason = git-evidence-failure", state.stopReason === "git-evidence-failure", `stopReason=${state.stopReason}`);
  const events = readFileSync(join(latestRunDir(), "events.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const failed = events.find((event) => event.type === "git:failed" && event.label === "untracked");
  check("events registra exit 1 con stderr", failed?.exitCode === 1 && failed.stderr.length > 0);
  check("no se escribe el patch tras el fallo", !existsSync(join(latestRunDir(), "attempt-1", "30-diff.patch")));
} catch (error) {
  check("selftest completo sin excepciones", false, error.stack ?? String(error));
} finally {
  const fixturePath = resolve(FIXTURE);
  const safeRoot = `${resolve(TEMP_ROOT)}${sep}`;
  if (!fixturePath.startsWith(safeRoot)) throw new Error(`fixture fuera de .agent: ${fixturePath}`);
  rmSync(fixturePath, { recursive: true, force: true });
  console.log(`\n  limpieza: ${fixturePath} ${existsSync(fixturePath) ? "NO eliminado" : "eliminado"}`);
}

console.log(`\n${failures === 0 ? "SELFTEST PASS" : `SELFTEST FAIL (${failures} comprobacion(es))`}\n`);
process.exit(failures === 0 ? 0 : 1);
