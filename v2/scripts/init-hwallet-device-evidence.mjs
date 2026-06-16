import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = "docs/HWALLET_DEVICE_EVIDENCE.example.json";
const outputPath = process.env.HWALLET_DEVICE_EVIDENCE_FILE || ".tmp/hwallet-device-evidence.json";
const force = process.env.HWALLET_DEVICE_EVIDENCE_INIT_FORCE === "true";

if (!force && await exists(outputPath)) {
  assertGitIgnored(outputPath);
  console.log(JSON.stringify({
    ok: true,
    created: false,
    outputPath,
    note: "Existing ignored evidence file left untouched.",
    nextSteps: nextSteps(outputPath)
  }, null, 2));
  process.exit(0);
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const initialized = {
  ...source,
  tester: {
    label: "fill-tester-label",
    testedAt: new Date().toISOString()
  },
  users: {
    userA: {
      emailLabel: "fill-user-a-label",
      shortAddress: "0x0000...0000"
    },
    userB: {
      emailLabel: "fill-user-b-label",
      shortAddress: "0x0001...0001"
    }
  },
  confirmations: {
    observedOnPhysicalDevice: false,
    twoDifferentUsersTested: false,
    screenshotsRedacted: false,
    containsNoSecrets: false,
    liveExecutionStillClosed: false
  },
  artifacts: [
    {
      label: "fill-user-a-hwallet-ready",
      redacted: true
    },
    {
      label: "fill-user-b-hwallet-ready",
      redacted: true
    }
  ],
  notes:
    "Fill this ignored local file after real device QA. Keep only redacted observations. " +
    "Do not paste verification codes, access tokens, private keys, API keys, or database URLs."
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(initialized, null, 2)}\n`, "utf8");

assertGitIgnored(outputPath);

console.log(JSON.stringify({
  ok: true,
  created: true,
  outputPath,
  nextSteps: nextSteps(outputPath)
}, null, 2));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  if (ignoreCheck.status !== 0) {
    throw new Error(`${path} is not ignored by git. Add it to .gitignore before using real device evidence.`);
  }
}

function nextSteps(path) {
  return [
    `Fill ${path} after real iPhone QA.`,
    `HWALLET_DEVICE_EVIDENCE_FILE=${path} HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence`,
    `HWALLET_STAGING_HANDOFF_STRICT=true HWALLET_DEVICE_EVIDENCE_FILE=${path} MOBILE_DEVICE_PRIVY_ACCESS_TOKEN=<short-lived-user-a-token> MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN=<short-lived-user-b-token> npm run smoke:hwallet-staging-handoff`
  ];
}
