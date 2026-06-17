import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = "docs/HWALLET_DEVICE_EVIDENCE.example.json";
const outputPath = process.env.HWALLET_DEVICE_EVIDENCE_FILE || ".tmp/hwallet-device-evidence.json";
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const mobileApp = JSON.parse(await readFile("apps/mobile/app.json", "utf8"));
const expo = mobileApp.expo || {};

const confirmAll = process.env.HWALLET_DEVICE_EVIDENCE_CONFIRM_ALL === "true";
assert(confirmAll, "Set HWALLET_DEVICE_EVIDENCE_CONFIRM_ALL=true only after the physical-device pass is complete.");

const platform = normalizePlatform(process.env.HWALLET_DEVICE_PLATFORM || source.environment.platform || "ios");
const userA = {
  emailLabel: requiredEnv("HWALLET_DEVICE_USER_A_LABEL"),
  shortAddress: normalizeAddress(requiredEnv("HWALLET_DEVICE_USER_A_SHORT_ADDRESS"), "HWALLET_DEVICE_USER_A_SHORT_ADDRESS")
};
const userB = {
  emailLabel: requiredEnv("HWALLET_DEVICE_USER_B_LABEL"),
  shortAddress: normalizeAddress(requiredEnv("HWALLET_DEVICE_USER_B_SHORT_ADDRESS"), "HWALLET_DEVICE_USER_B_SHORT_ADDRESS")
};

assert(userA.emailLabel !== userB.emailLabel, "User A and User B labels must be different.");
assert(userA.shortAddress !== userB.shortAddress, "User A and User B receive addresses must be different.");

const evidence = {
  ...source,
  environment: {
    ...source.environment,
    platform,
    buildChannel: process.env.HWALLET_DEVICE_BUILD_CHANNEL || source.environment.buildChannel || "preview",
    apiBaseUrl: process.env.HWALLET_DEVICE_API_BASE_URL || source.environment.apiBaseUrl || "https://app.hwallet.vip",
    appVersion: process.env.HWALLET_DEVICE_APP_VERSION || expo.version || source.environment.appVersion,
    buildNumber: process.env.HWALLET_DEVICE_BUILD_NUMBER || defaultBuildNumber(platform, expo) || source.environment.buildNumber,
    otaUpdateMessage:
      process.env.HWALLET_DEVICE_OTA_UPDATE_MESSAGE ||
      source.environment.otaUpdateMessage ||
      "manual device evidence"
  },
  tester: {
    label: process.env.HWALLET_DEVICE_TESTER_LABEL || "owner-device-qa",
    testedAt: process.env.HWALLET_DEVICE_TESTED_AT || new Date().toISOString()
  },
  users: {
    userA,
    userB
  },
  checks: mapValues(source.checks, true),
  flow: source.flow.map((item) => ({
    ...item,
    observed: true
  })),
  confirmations: mapValues(source.confirmations, true),
  artifacts: artifactLabels().map((label) => ({
    label,
    redacted: true
  })),
  notes:
    process.env.HWALLET_DEVICE_NOTES ||
    "Owner-confirmed installed-App pass. Evidence contains redacted labels only; no verification codes, tokens, private keys, API keys, or database URLs."
};

assertNoRawSecrets(JSON.stringify(evidence), outputPath);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
assertGitIgnored(outputPath);

console.log(JSON.stringify({
  ok: true,
  outputPath,
  summary: {
    platform: evidence.environment.platform,
    buildChannel: evidence.environment.buildChannel,
    apiBaseUrl: evidence.environment.apiBaseUrl,
    appVersion: evidence.environment.appVersion,
    buildNumber: evidence.environment.buildNumber,
    userA: evidence.users.userA.shortAddress,
    userB: evidence.users.userB.shortAddress,
    artifacts: evidence.artifacts.length
  },
  nextSteps: [
    `HWALLET_DEVICE_EVIDENCE_FILE=${outputPath} HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence`,
    "Keep the generated file local and ignored. Do not commit real device evidence."
  ]
}, null, 2));

function requiredEnv(name) {
  const value = process.env[name];
  assert(typeof value === "string" && value.trim().length > 0, `${name} is required.`);
  return value.trim();
}

function normalizePlatform(value) {
  const platform = String(value || "").trim().toLowerCase();
  assert(["ios", "android"].includes(platform), "HWALLET_DEVICE_PLATFORM must be ios or android.");
  return platform;
}

function normalizeAddress(value, name) {
  const trimmed = value.trim().replace(/\*+/g, "...");
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
  }

  assert(
    /^0x[a-fA-F0-9]{4,}\.\.\.[a-fA-F0-9]{4,}$/.test(trimmed),
    `${name} must be a full 0x address or a redacted 0x1234...abcd label.`
  );
  return trimmed;
}

function defaultBuildNumber(platform, expoConfig) {
  if (platform === "android") return String(expoConfig.android?.versionCode || "");
  return String(expoConfig.ios?.buildNumber || "");
}

function artifactLabels() {
  const labels = (process.env.HWALLET_DEVICE_ARTIFACT_LABELS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (labels.length >= 2) return labels;
  return [
    "user-a-hwallet-ready",
    "copy-feedback-visible",
    "user-b-hwallet-ready",
    "signed-out-boundary"
  ];
}

function mapValues(object, value) {
  return Object.fromEntries(Object.keys(object || {}).map((key) => [key, value]));
}

function assertGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  if (ignoreCheck.status !== 0) {
    throw new Error(`${path} is not ignored by git. Add it to .gitignore before recording real device evidence.`);
  }
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
      throw new Error(`HWallet device evidence recorder failed: ${file} must not contain raw secret material`);
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`HWallet device evidence recorder failed: ${message}`);
}
