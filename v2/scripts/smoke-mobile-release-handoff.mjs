import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const checks = [];
const strict = process.env.HWALLET_RELEASE_HANDOFF_STRICT === "true";

const storeEvidenceFile = process.env.HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE || "";
const iosEvidenceFile = process.env.HWALLET_IOS_DEVICE_EVIDENCE_FILE || "";
const androidEvidenceFile = process.env.HWALLET_ANDROID_DEVICE_EVIDENCE_FILE || "";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const handoff = await readFile("docs/HWALLET_MOBILE_RELEASE_HANDOFF.md", "utf8");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const distributionPlan = await readFile("docs/HWALLET_STORE_DISTRIBUTION_PLAN.md", "utf8");
const releasePreflight = await readFile("v2/scripts/smoke-mobile-release-preflight.mjs", "utf8");

assertNoRawSecrets(JSON.stringify({
  strict,
  storeEvidenceFile,
  iosEvidenceFile,
  androidEvidenceFile
}), "mobile-release-handoff-env");

assert(typeof packageJson.scripts?.["smoke:mobile-release-handoff"] === "string", "package exposes mobile release handoff smoke");
assert(
  String(packageJson.scripts?.["verify:merge"] || "").includes("smoke:mobile-release-handoff"),
  "verify:merge includes mobile release handoff smoke"
);

assertIncludes(handoff, "HWallet wallet entry plus Agent experience", "handoff names HWallet product body");
assertIncludes(handoff, "https://app.hwallet.vip", "handoff records public staging API");
assertIncludes(handoff, "Current Preview Builds", "handoff records current preview builds");
assertIncludes(handoff, "e4603d5d-2123-4502-94f9-3e9035ba3c9e", "handoff records iOS preview build id");
assertIncludes(handoff, "ab124aea-fbe7-47e1-aea8-b69ceddae248", "handoff records Android preview build id");
assertIncludes(handoff, ".tmp/hwallet-mobile-store-build-evidence.json", "handoff points to local store-build evidence");
assertIncludes(handoff, ".tmp/hwallet-device-evidence-ios.json", "handoff points to local iOS device evidence");
assertIncludes(handoff, ".tmp/hwallet-device-evidence-android.json", "handoff points to local Android device evidence");
assertIncludes(handoff, "HWALLET_RELEASE_PREFLIGHT_STRICT=true", "handoff documents strict release preflight");
assertIncludes(handoff, "npm run smoke:mobile-release-preflight", "handoff runs release preflight");
assertIncludes(handoff, "npm run smoke:mobile-release-handoff", "handoff runs handoff smoke");
assertIncludes(handoff, "TestFlight", "handoff keeps iOS TestFlight route visible");
assertIncludes(handoff, "Android internal testing", "handoff keeps Android internal route visible");
assertIncludes(handoff, "real execution closed", "handoff keeps live execution closed");
checks.push("handoff document links current builds, dual evidence, strict preflight, and release routes");

assertIncludes(releaseChecklist, "npm run smoke:mobile-release-handoff", "release checklist runs mobile release handoff smoke");
assertIncludes(releaseChecklist, "HWALLET_RELEASE_HANDOFF_STRICT=true", "release checklist documents strict handoff");
assertIncludes(distributionPlan, "npm run smoke:mobile-release-handoff", "distribution plan runs mobile release handoff smoke");
assertIncludes(distributionPlan, "HWALLET_RELEASE_HANDOFF_STRICT=true", "distribution plan documents strict handoff");
assertIncludes(releasePreflight, "HWALLET_RELEASE_PREFLIGHT_STRICT", "release preflight keeps strict mode");
checks.push("release checklist and distribution plan include handoff gate");

if (strict) {
  assert(storeEvidenceFile.length > 0, "strict handoff has store-build evidence file");
  assert(iosEvidenceFile.length > 0, "strict handoff has iOS device evidence file");
  assert(androidEvidenceFile.length > 0, "strict handoff has Android device evidence file");

  const storeEvidence = JSON.parse(await readLocalEvidence(storeEvidenceFile));
  const iosEvidence = JSON.parse(await readLocalEvidence(iosEvidenceFile));
  const androidEvidence = JSON.parse(await readLocalEvidence(androidEvidenceFile));

  assert(storeEvidence.kind === "hwallet-mobile-store-build-evidence", "strict handoff store-build evidence kind is valid");
  assert(storeEvidence.builds?.ios?.buildId === "e4603d5d-2123-4502-94f9-3e9035ba3c9e", "strict handoff iOS build matches handoff");
  assert(storeEvidence.builds?.android?.buildId === "ab124aea-fbe7-47e1-aea8-b69ceddae248", "strict handoff Android build matches handoff");
  assert(iosEvidence.environment?.platform === "ios", "strict handoff iOS evidence is ios");
  assert(androidEvidence.environment?.platform === "android", "strict handoff Android evidence is android");
  assert(iosEvidence.confirmations?.liveExecutionStillClosed === true, "strict handoff iOS confirms live execution closed");
  assert(androidEvidence.confirmations?.liveExecutionStillClosed === true, "strict handoff Android confirms live execution closed");

  runStrictPreflight();
}

console.log(JSON.stringify({
  ok: true,
  mode: strict ? "strict-release-handoff" : "static-release-handoff",
  checks,
  handoff: {
    previewBuildsRecorded: true,
    strictEvidenceRequired: strict,
    liveExecutionClosed: true,
    nextRoutes: ["TestFlight", "Android internal testing"]
  }
}, null, 2));

async function readLocalEvidence(path) {
  assertGitIgnored(path);
  const raw = await readFile(path, "utf8");
  assertNoRawSecrets(raw, path);
  return raw;
}

function runStrictPreflight() {
  const result = spawnSync("npm", ["run", "smoke:mobile-release-preflight"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HWALLET_RELEASE_PREFLIGHT_STRICT: "true",
      HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE: storeEvidenceFile,
      HWALLET_IOS_DEVICE_EVIDENCE_FILE: iosEvidenceFile,
      HWALLET_ANDROID_DEVICE_EVIDENCE_FILE: androidEvidenceFile
    },
    encoding: "utf8"
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Mobile release handoff failed strict preflight.\n${output}`);
  }
  checks.push("strict handoff release preflight passed");
}

function assertGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  if (ignoreCheck.status !== 0) {
    throw new Error(`${path} is not ignored by git. Keep release handoff evidence in ignored .tmp files.`);
  }
  checks.push(`${path} is git ignored`);
}

function assertIncludes(text, needle, label) {
  assert(String(text || "").includes(needle), label);
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
      throw new Error(`Mobile release handoff failed: ${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile release handoff failed: ${label}`);
  checks.push(label);
}
