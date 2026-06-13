// The headline demo. Run with: npm run demo
//
// Simulates an AI agent that makes a mess of a project, then rewinds the whole
// thing with one call. Uses the Rust engine in-process via NAPI.

import undo from "../src/engine.js";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const step = (n: number, s: string) => console.log(`\n${bold(`${n}.`)} ${s}`);

const project = mkdtempSync(join(tmpdir(), "undo-demo-"));
const file = (name: string) => join(project, name);

console.log(bold("\n  undo — Ctrl-Z for AI agents\n"));
console.log(dim(`  scratch project: ${project}`));

// A project that already has important files.
writeFileSync(file("config.ts"), 'export const API_KEY = "sk-live-prod-do-not-lose";\n');
writeFileSync(file("auth.ts"), "export function login() {\n  return true;\n}\n");

step(1, "The project, before the agent touches it:");
console.log(dim("   config.ts → ") + readFileSync(file("config.ts"), "utf8").trim());
console.log(dim("   auth.ts   → exists, working login()"));

step(2, "We init undo and drop a checkpoint:");
undo.init(project);
const cp = undo.checkpoint(project, "before the agent runs");
console.log(green(`   ✓ checkpoint ${cp}`));

step(3, "The agent declares what it's about to touch:");
console.log("   " + undo.track(project, "config.ts"));
console.log("   " + undo.track(project, "auth.ts"));
console.log("   " + undo.track(project, "experimental.ts"));

step(4, red("The agent goes rogue:"));
writeFileSync(file("config.ts"), 'export const API_KEY = "";\n'); // wiped the secret
rmSync(file("auth.ts")); // deleted auth entirely
writeFileSync(file("experimental.ts"), "// half-finished nonsense\n"); // dumped junk
undo.recordHttp(
  project,
  "POST",
  "https://api.stripe.com/v1/charges",
  "POST",
  "https://api.stripe.com/v1/refunds",
  '{"charge":"ch_123"}',
);
console.log(red("   ✗ wiped the API key in config.ts"));
console.log(red("   ✗ deleted auth.ts"));
console.log(red("   ✗ created experimental.ts full of junk"));
console.log(red("   ✗ POSTed a real charge to Stripe"));

step(5, "You check what happened:");
const status = JSON.parse(undo.statusJson(project));
for (const e of status.effects) console.log(dim("   • ") + describe(e));

step(6, bold("One button:"));
const report = JSON.parse(undo.rollback(project, null));
console.log(green(`   ✓ rewound to ${report.checkpoint}`));
for (const r of report.reverted) console.log(green(`     ⟲ ${r}`));
for (const s of report.skipped) console.log(`     ${dim("•")} ${s}`);

step(7, "The world, restored:");
const restored = readFileSync(file("config.ts"), "utf8").trim();
console.log(dim("   config.ts → ") + restored);
console.log(dim("   auth.ts   → ") + (existsSync(file("auth.ts")) ? green("back!") : red("still gone")));
console.log(
  dim("   experimental.ts → ") +
    (existsSync(file("experimental.ts")) ? red("still here") : green("gone")),
);

const allGood =
  restored.includes("sk-live-prod-do-not-lose") &&
  existsSync(file("auth.ts")) &&
  !existsSync(file("experimental.ts"));
console.log("\n" + (allGood ? green(bold("  ✓ Everything is exactly as it was.")) : red("  ✗ mismatch")));
console.log(
  dim("\n  (The Stripe charge is flagged for manual reversal — its compensating refund is recorded.)\n"),
);

rmSync(project, { recursive: true, force: true });

function describe(e: any): string {
  switch (e.kind) {
    case "path_create": return `created  ${e.path}`;
    case "file": return `captured ${e.path}`;
    case "symlink": return `symlink  ${e.path}`;
    case "dir": return `dir      ${e.path}`;
    case "http_mutation": return `${e.method} ${e.url}`;
    case "exec": return `ran      ${e.command}`;
    default: return JSON.stringify(e);
  }
}
