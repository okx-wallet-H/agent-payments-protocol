import { spawnSync } from "node:child_process";

const checks = [];
const strict = process.env.HWALLET_RELEASE_PREFLIGHT_STRICT === "true";

const storeEvidenceFile = process.env.HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE || "";
const iosEvidenceFile = process.env.HWALLET_IOS_DEVICE_EVIDENCE_FILE || "";
const androidEvidenceFile = process.env.HWALLET_ANDROID_DEVICE_EVIDENCE_FILE || "";

assertNoRawSecrets(JSON.stringify({
  strict,
  storeEvidenceFile,
  iosEvidenceFile,
  androidEvidenceFile
}), "mobile-release-preflight-env");

if (strict) {
  assert(storeEvidenceFile.length > 0, "strict preflight has mobile store build evidence file");
  assert(iosEvidenceFile.length > 0, "strict preflight has iOS device evidence file");
  assert(androidEvidenceFile.length > 0, "strict preflight has Android device evidence file");
}

run("mobile store readiness", "smoke:mobile-store-readiness");
run("mobile distribution readiness", "smoke:mobile-distribution-readiness");
run("HWallet release candidate", "smoke:hwallet-release-candidate");
run("mobile store build evidence", "smoke:mobile-store-build-evidence", strict ? {
  HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED: "true"
} : {});
run("dual-device HWallet evidence", "smoke:hwallet-dual-device-evidence", strict ? {
  HWALLET_DUAL_DEVICE_EVIDENCE_REQUIRED: "true"
} : {});

console.log(JSON.stringify({
  ok: true,
  mode: strict ? "strict-release-preflight" : "static-release-preflight",
  checks,
  strictRequirements: {
    storeBuildEvidence: strict,
    iosDeviceEvidence: strict,
    androidDeviceEvidence: strict,
    liveExecutionClosed: true
  }
}, null, 2));

function run(label, scriptName, extraEnv = {}) {
  const result = spawnSync("npm", ["run", scriptName], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv
    },
    encoding: "utf8"
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Mobile release preflight failed at ${label} (${scriptName}).\n${output}`);
  }
  checks.push(`${label} passed`);
}

function assertNoRawSecrets(text, file) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i,
    /MOBILE_DEVICE_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
    /MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
    /APPLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/,
    /GOOGLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/
  ];

  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`Mobile release preflight failed: ${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile release preflight failed: ${label}`);
  checks.push(label);
}
