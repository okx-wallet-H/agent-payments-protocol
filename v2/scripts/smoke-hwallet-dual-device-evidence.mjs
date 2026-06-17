import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const checks = [];
const requireRealEvidence = process.env.HWALLET_DUAL_DEVICE_EVIDENCE_REQUIRED === "true";
const iosPath = process.env.HWALLET_IOS_DEVICE_EVIDENCE_FILE || "";
const androidPath = process.env.HWALLET_ANDROID_DEVICE_EVIDENCE_FILE || "";

assertNoRawSecrets(JSON.stringify({
  iosPath,
  androidPath,
  required: requireRealEvidence
}), "dual-device-evidence-env");

if (!requireRealEvidence) {
  assert(!iosPath && !androidPath, "non-strict mode does not consume local device evidence");
  console.log(JSON.stringify({
    ok: true,
    mode: "strict-not-requested",
    checks,
    nextStrictCommand:
      "HWALLET_IOS_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-ios.json " +
      "HWALLET_ANDROID_DEVICE_EVIDENCE_FILE=.tmp/hwallet-device-evidence-android.json " +
      "HWALLET_DUAL_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-dual-device-evidence"
  }, null, 2));
  process.exit(0);
}

assert(iosPath.length > 0, "iOS device evidence file is provided");
assert(androidPath.length > 0, "Android device evidence file is provided");
assert(iosPath !== androidPath, "iOS and Android evidence files are separate");
assertGitIgnored(iosPath);
assertGitIgnored(androidPath);

const iosEvidence = await readEvidence(iosPath, "ios");
const androidEvidence = await readEvidence(androidPath, "android");

runSingleEvidenceSmoke(iosPath, "iOS");
runSingleEvidenceSmoke(androidPath, "Android");

assert(iosEvidence.environment.platform === "ios", "iOS evidence records ios platform");
assert(androidEvidence.environment.platform === "android", "Android evidence records android platform");
assert(iosEvidence.environment.apiBaseUrl === androidEvidence.environment.apiBaseUrl, "both platforms target the same API base URL");
assert(iosEvidence.environment.appVersion === androidEvidence.environment.appVersion, "both platforms use the same App version");
assert(iosEvidence.users.userA.shortAddress !== iosEvidence.users.userB.shortAddress, "iOS evidence has distinct user addresses");
assert(androidEvidence.users.userA.shortAddress !== androidEvidence.users.userB.shortAddress, "Android evidence has distinct user addresses");
assert(iosEvidence.confirmations.liveExecutionStillClosed === true, "iOS confirms live execution remains closed");
assert(androidEvidence.confirmations.liveExecutionStillClosed === true, "Android confirms live execution remains closed");

console.log(JSON.stringify({
  ok: true,
  mode: "dual-device-evidence",
  checks,
  summary: {
    ios: summarize(iosEvidence),
    android: summarize(androidEvidence),
    apiBaseUrl: iosEvidence.environment.apiBaseUrl,
    appVersion: iosEvidence.environment.appVersion,
    liveExecutionClosed: true
  }
}, null, 2));

async function readEvidence(path, expectedPlatform) {
  const raw = await readFile(path, "utf8");
  assertNoRawSecrets(raw, path);
  const evidence = JSON.parse(raw);
  assert(evidence.kind === "hwallet-device-multi-user-evidence", `${expectedPlatform} evidence kind is HWallet multi-user`);
  assert(evidence.version === 1, `${expectedPlatform} evidence version is supported`);
  assert(evidence.environment?.platform === expectedPlatform, `${expectedPlatform} evidence platform matches file role`);
  return evidence;
}

function runSingleEvidenceSmoke(path, label) {
  const result = spawnSync(
    process.execPath,
    ["v2/scripts/smoke-hwallet-device-evidence.mjs"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HWALLET_DEVICE_EVIDENCE_FILE: path,
        HWALLET_DEVICE_EVIDENCE_REQUIRED: "true"
      },
      encoding: "utf8"
    }
  );

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${label} device evidence failed strict single-device smoke.\n${output}`);
  }
  checks.push(`${label} strict single-device evidence smoke passed`);
}

function assertGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  if (ignoreCheck.status !== 0) {
    throw new Error(`${path} is not ignored by git. Keep real device evidence in ignored .tmp files.`);
  }
  checks.push(`${path} is git ignored`);
}

function summarize(evidence) {
  return {
    buildChannel: evidence.environment.buildChannel,
    buildNumber: evidence.environment.buildNumber,
    userA: evidence.users.userA.shortAddress,
    userB: evidence.users.userB.shortAddress,
    artifacts: evidence.artifacts.length
  };
}

function assertNoRawSecrets(text, file) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i,
    /MOBILE_DEVICE_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
    /MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/
  ];

  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      throw new Error(`HWallet dual-device evidence smoke failed: ${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`HWallet dual-device evidence smoke failed: ${label}`);
  checks.push(label);
}
