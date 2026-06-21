import { readFile } from "node:fs/promises";

const files = [
  "v2/storage/agent-action-store.ts",
  "v2/storage/audit-timeline-store.ts",
  "v2/storage/phase-one-store.ts",
  "v2/storage/user-session-store.ts"
];

const checks = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  check(!source.includes('"demo-user"'), `${file} does not hydrate legacy rows as demo-user`);
  check(source.includes("legacy-missing-user"), `${file} keeps a clearly labeled legacy missing-user bucket`);
}

console.log(JSON.stringify({
  ok: true,
  files,
  checks
}, null, 2));

function check(condition, label) {
  if (!condition) throw new Error(`Storage legacy user boundary smoke failed: ${label}`);
  checks.push(label);
}
