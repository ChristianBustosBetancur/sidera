#!/usr/bin/env node
// Sidera agent runner — TASK-003.2 FASE 1 (simulada).
// No invoca ningun modelo real. IMPLEMENT y REVIEW son stubs marcados SIMULATED.
// Uso: node tools/agent/run.mjs <TASK-ID> [--review=pass|fail|invalid] [--reset] ...

import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENT_DIR = join(REPO, ".agent");
const STATE_FILE = join(AGENT_DIR, "state.json");
const MAX_ATTEMPTS = 3; // intento inicial + 2 reparaciones (TASK-003.2, decision C)
const VALIDATIONS = ["lint", "typecheck", "test", "build"];
const TERMINAL = ["HUMAN_GATE", "STOPPED"];

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => argv.includes(`--${name}`);
const taskId = argv.find((a) => !a.startsWith("--"));

const opts = {
  review: flag("review", "pass"),
  implementDelay: Number(flag("implement-delay", "600")),
  writeRepoFile: flag("implement", "") === "write-repo-file",
  injectValidateFailure: flag("inject-validate-failure", ""),
};

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`.padStart(7);
let state = null;
let runDir = null;
let currentChild = null;
let aborting = false;

// ---------- observabilidad (decision K: solo eventos operativos y artefactos) ----------

const say = (kind, msg) => console.log(`[${elapsed()}] ${kind.padEnd(9)} ${msg}`);

function event(type, data = {}) {
  const rec = { ts: new Date().toISOString(), type, simulated: true, ...data };
  if (runDir) appendFileSync(join(runDir, "events.jsonl"), `${JSON.stringify(rec)}\n`);
}

function setPhase(phase, extra = {}) {
  state = { ...state, phase, ...extra, updatedAt: new Date().toISOString() };
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
  event("phase", { phase, attempt: state.attempt, activeProcess: state.activeProcess });
  say("PHASE", `→ ${phase}  (attempt ${state.attempt}/${MAX_ATTEMPTS})`);
}

function setActive(name) {
  state.activeProcess = name;
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

// ---------- procesos ----------

function git(args) {
  try {
    return execFileSync("git", args, { cwd: REPO, encoding: "utf8" });
  } catch {
    return "";
  }
}

function killTree(pid) {
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch {
    /* el hijo ya habia terminado */
  }
}

// shell:true solo para pnpm (en Windows es un .cmd/.ps1); node se lanza directo.
function run(label, command, args, useShell = false) {
  return new Promise((resolve) => {
    say("EXEC", `▶ ${label}`);
    event("command:start", { label, command: `${command} ${args.join(" ")}` });
    setActive(label);
    const child = useShell
      ? spawn([command, ...args].join(" "), { cwd: REPO, shell: true, stdio: ["ignore", "pipe", "pipe"] })
      : spawn(command, args, { cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
    currentChild = child;
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => {
      currentChild = null;
      setActive(null);
      if (aborting) return;
      const ok = code === 0;
      say("EXEC", `${ok ? "PASS" : "FAIL"}  ${label} (exit ${code})`);
      event("command:end", { label, exitCode: code, result: ok ? "PASS" : "FAIL" });
      resolve({ ok, code, out });
    });
  });
}

// ---------- fases ----------

async function implement(attemptDir, attempt, blockers) {
  writeFileSync(
    join(attemptDir, "10-implement-prompt.md"),
    `# SIMULATED IMPLEMENT PROMPT — ningun modelo fue invocado\n\nTASK: ${taskId}\nbranch: ${state.branch}\nattempt: ${attempt}/${MAX_ATTEMPTS}\n\n${blockers ? `## Blockers de la vuelta anterior\n\n${blockers}\n` : "(sin blockers previos)\n"}`,
  );
  const args = [
    join(REPO, "tools", "agent", "stubs", "implement.mjs"),
    `--task=${taskId}`,
    `--attempt=${attempt}`,
    `--delay=${opts.implementDelay}`,
    `--out=${join(attemptDir, "11-implement-output.log")}`,
  ];
  if (opts.writeRepoFile) args.push("--write-repo-file");
  return run("stub:implement [SIMULATED]", process.execPath, args);
}

async function validate(attemptDir) {
  const results = [];
  for (const step of VALIDATIONS) {
    const injected = opts.injectValidateFailure === step;
    const r = injected
      ? await run(`pnpm ${step} [SYNTHETIC FAILURE]`, process.execPath, [
          "-e",
          `console.error("SYNTHETIC VALIDATION FAILURE injected for step ${step}"); process.exit(1)`,
        ])
      : await run(`pnpm ${step}`, "pnpm", [step], true);
    results.push({ step, ok: r.ok, exitCode: r.code, synthetic: injected });
    appendFileSync(join(attemptDir, "21-validate.log"), `\n===== ${step} (exit ${r.code}) =====\n${r.out}`);
    if (!r.ok) {
      writeFileSync(join(attemptDir, "20-validate.json"), `${JSON.stringify(results, null, 2)}\n`);
      return { ok: false, failedStep: step, results, output: r.out };
    }
  }
  writeFileSync(join(attemptDir, "20-validate.json"), `${JSON.stringify(results, null, 2)}\n`);
  return { ok: true, results };
}

async function review(attemptDir, validateResults) {
  const diff = git(["diff", "--find-renames"]);
  const status = git(["status", "--porcelain"]);
  writeFileSync(join(attemptDir, "30-diff.patch"), diff);
  writeFileSync(join(attemptDir, "31-status.txt"), status);
  const files = status.trim() ? status.trim().split("\n").length : 0;
  say("FILES", `${files} archivo(s) con cambios segun git status`);
  event("worktree", { changedFiles: files });
  writeFileSync(
    join(attemptDir, "40-review-prompt.md"),
    `# SIMULATED REVIEW PROMPT — ningun modelo fue invocado\n\nTASK: ${taskId}\n\n## git status\n\n\`\`\`\n${status}\`\`\`\n\n## Validaciones\n\n\`\`\`json\n${JSON.stringify(validateResults, null, 2)}\n\`\`\`\n\n## Diff\n\n\`\`\`diff\n${diff}\`\`\`\n`,
  );
  const outFile = join(attemptDir, "41-review-output.md");
  await run("stub:review [SIMULATED]", process.execPath, [
    join(REPO, "tools", "agent", "stubs", "review.mjs"),
    `--verdict=${opts.review}`,
    `--task=${taskId}`,
    `--out=${outFile}`,
  ]);
  const raw = readFileSync(outFile, "utf8");
  const blocks = [...raw.matchAll(/```json\s*\n([\s\S]*?)```/g)];
  if (blocks.length === 0) return null;
  try {
    const parsed = JSON.parse(blocks[blocks.length - 1][1]);
    if (parsed.verdict !== "PASS" && parsed.verdict !== "FAIL") return null;
    writeFileSync(join(attemptDir, "42-verdict.json"), `${JSON.stringify(parsed, null, 2)}\n`);
    return parsed;
  } catch {
    return null;
  }
}

// ---------- terminales ----------

function stop(reason, detail = {}) {
  setPhase("STOPPED", { stopReason: reason, activeProcess: null });
  event("stopped", { reason, ...detail });
  say("STOPPED", `motivo: ${reason}`);
  console.log(`\nRun detenido. Estado congelado en .agent/state.json — el working tree NO fue modificado por el runner.`);
  console.log(`Para arrancar otro run: node tools/agent/run.mjs <TASK-ID> --reset\n`);
  process.exit(1);
}

function humanGate() {
  setPhase("HUMAN_GATE", { activeProcess: null, lastVerdict: "PASS" });
  event("human_gate", {});
  say("GATE", "PASS simulado — requiere aprobacion humana");
  console.log(`\n[SIMULATED] Ningun modelo fue invocado. mode=simulated.`);
  console.log(`Artefactos: ${runDir}`);
  console.log(`El runner NO hace merge, NO hace push y NO inicia otra TASK.\n`);
  process.exit(0);
}

// ---------- abort humano (decision L) ----------

process.on("SIGINT", () => {
  if (aborting) return;
  aborting = true;
  console.log("\n");
  say("ABORT", "SIGINT recibido — congelando estado, sin rollback");
  if (currentChild?.pid) killTree(currentChild.pid);
  const snapshot = {
    ts: new Date().toISOString(),
    stopReason: "HUMAN_ABORT",
    phase: state?.phase ?? null,
    attempt: state?.attempt ?? null,
    activeProcess: state?.activeProcess ?? null,
    gitStatus: git(["status", "--porcelain"]),
    gitDiffStat: git(["diff", "--stat"]),
  };
  if (runDir) writeFileSync(join(runDir, "abort.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  if (state) {
    state = { ...state, phase: "STOPPED", stopReason: "HUMAN_ABORT", activeProcess: null, updatedAt: snapshot.ts };
    writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
    event("stopped", { reason: "HUMAN_ABORT", phase: snapshot.phase, attempt: snapshot.attempt });
  }
  say("ABORT", "STOPPED / HUMAN_ABORT — working tree preservado tal cual");
  console.log(`\nNo se ejecuto rollback: sin git reset, sin git clean, sin borrado de archivos.`);
  console.log(`Un run detenido no se reanuda solo. Accion humana explicita requerida.\n`);
  process.exit(130);
});

// ---------- main ----------

async function main() {
  if (!taskId) {
    console.error("Uso: node tools/agent/run.mjs <TASK-ID> [--review=pass|fail|invalid] [--reset]");
    process.exit(2);
  }
  mkdirSync(AGENT_DIR, { recursive: true });

  if (existsSync(STATE_FILE)) {
    if (!has("reset")) {
      const prev = JSON.parse(readFileSync(STATE_FILE, "utf8"));
      const active = !TERMINAL.includes(prev.phase);
      console.error(
        `\nRECHAZADO: ya existe un run para ${prev.task} en fase ${prev.phase}${active ? " (ACTIVO)" : " (terminal)"}.\n` +
          `Una TASK por ejecucion (TASK-003.2, decision M). Usa --reset para descartarlo explicitamente.\n`,
      );
      process.exit(3);
    }
    rmSync(STATE_FILE);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "Z");
  runDir = join(AGENT_DIR, "runs", taskId, stamp);
  mkdirSync(runDir, { recursive: true });
  const branch = git(["branch", "--show-current"]).trim();

  state = {
    task: taskId,
    phase: "IMPLEMENT",
    attempt: 1,
    branch,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastVerdict: null,
    mode: "simulated",
    activeProcess: null,
    stopReason: null,
    runDir,
  };

  const taskFile = join(REPO, "docs", "tasks", `${taskId}.md`);
  if (existsSync(taskFile)) writeFileSync(join(runDir, "00-task.md"), readFileSync(taskFile, "utf8"));

  console.log(`
──────────────────────────────────────────────────────────────
 Sidera agent runner                              [SIMULATED]
 TASK       ${taskId}
 branch     ${branch}
 mode       simulated  (ningun modelo real es invocado)
 attempts   max ${MAX_ATTEMPTS}  (inicial + 2 reparaciones)
 run dir    ${runDir}
 Ctrl+C detiene el workflow: congela el estado, no borra trabajo
──────────────────────────────────────────────────────────────`);
  event("run:start", { task: taskId, branch, mode: "simulated" });

  const heartbeat = setInterval(() => {
    if (state?.activeProcess) say("···", `activo: ${state.activeProcess}  |  fase ${state.phase}`);
  }, 5000);
  heartbeat.unref();

  let blockers = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    state.attempt = attempt;
    const attemptDir = join(runDir, `attempt-${attempt}`);
    mkdirSync(attemptDir, { recursive: true });
    if (blockers) writeFileSync(join(attemptDir, "05-blockers.md"), blockers);

    setPhase("IMPLEMENT");
    await implement(attemptDir, attempt, blockers);

    setPhase("VALIDATE");
    const v = await validate(attemptDir);
    if (!v.ok) {
      say("BLOCKER", `validacion '${v.failedStep}' fallo — REVIEW no se ejecuta`);
      event("validate:failed", { failedStep: v.failedStep, reviewSkipped: true });
      blockers = `# Blockers de validacion (attempt ${attempt})\n\nLa validacion \`pnpm ${v.failedStep}\` fallo.\n\n\`\`\`\n${v.output.slice(-4000)}\n\`\`\`\n`;
      if (attempt === MAX_ATTEMPTS) stop("repair-budget-exhausted", { lastFailure: v.failedStep });
      continue;
    }

    setPhase("REVIEW");
    const verdict = await review(attemptDir, v.results);
    if (!verdict) stop("unparseable-verdict");
    if (verdict.verdict === "PASS") humanGate();

    const list = verdict.blockers ?? [];
    if (list.length === 0) stop("empty-blockers");
    say("BLOCKER", `REVIEW FAIL con ${list.length} blocker(s)`);
    event("review:fail", { blockers: list.length });
    state.lastVerdict = "FAIL";
    blockers = `# Blockers de REVIEW (attempt ${attempt})\n\n${list.map((b, i) => `${i + 1}. \`${b.file ?? "-"}\` — ${b.issue ?? ""}`).join("\n")}\n`;
    if (attempt === MAX_ATTEMPTS) stop("repair-budget-exhausted", { lastVerdict: "FAIL" });
  }
}

main();
