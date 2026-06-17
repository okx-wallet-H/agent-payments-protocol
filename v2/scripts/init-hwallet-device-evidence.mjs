import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = "docs/HWALLET_DEVICE_EVIDENCE.example.json";
const outputPath = process.env.HWALLET_DEVICE_EVIDENCE_FILE || ".tmp/hwallet-device-evidence.json";
const force = process.env.HWALLET_DEVICE_EVIDENCE_INIT_FORCE === "true";
const source = JSON.parse(await readFile(sourcePath, "utf8"));

if (!force && await exists(outputPath)) {
  assertGitIgnored(outputPath);
  const existing = JSON.parse(await readFile(outputPath, "utf8"));
  const upgraded = upgradeEvidenceFlow(existing, source.flow);
  if (upgraded.updated) {
    await writeFile(outputPath, `${JSON.stringify(upgraded.evidence, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    ok: true,
    created: false,
    updated: upgraded.updated,
    outputPath,
    note: upgraded.updated
      ? "Existing ignored evidence file was upgraded with missing ordered flow steps."
      : "Existing ignored evidence file left untouched.",
    nextSteps: nextSteps(outputPath)
  }, null, 2));
  process.exit(0);
}

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
  flow: source.flow.map((item) => ({
    ...item,
    observed: false
  })),
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

function upgradeEvidenceFlow(evidence, sourceFlow) {
  const currentFlow = Array.isArray(evidence.flow) ? evidence.flow : [];
  const mergedFlow = sourceFlow.map((sourceStep) => {
    const existingStep = currentFlow.find((item) => item?.step === sourceStep.step);
    return {
      ...sourceStep,
      ...existingStep,
      observed: existingStep?.observed === true
    };
  });

  const hasAllSteps = sourceFlow.every((sourceStep, index) => currentFlow[index]?.step === sourceStep.step);
  const hasBooleanObservations = mergedFlow.every((step) => typeof step.observed === "boolean");
  const updated = !hasAllSteps || !hasBooleanObservations;
  return {
    updated,
    evidence: updated
      ? {
          ...evidence,
          flow: mergedFlow
        }
      : evidence
  };
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
