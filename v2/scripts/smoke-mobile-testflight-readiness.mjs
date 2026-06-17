import { readFile } from "node:fs/promises";

const checks = [];

const rootPackage = await readJson("package.json");
const mobilePackage = await readJson("apps/mobile/package.json");
const mobileAppConfig = await readJson("apps/mobile/app.json");
const easConfig = await readJson("apps/mobile/eas.json");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const deviceQa = await readFile("docs/HWALLET_DEVICE_MULTI_USER_QA.md", "utf8");
const easRunbook = await readFile("docs/HWALLET_EAS_UPDATE_RUNBOOK.md", "utf8");

const rootScripts = rootPackage.scripts || {};
const mobileScripts = mobilePackage.scripts || {};
const expoConfig = mobileAppConfig.expo || {};
const profiles = easConfig.build || {};

const requiredRootScripts = [
  "smoke:mobile-store-readiness",
  "smoke:mobile-testflight-readiness",
  "smoke:mobile-build-env",
  "smoke:mobile-staging-env",
  "smoke:mobile-device-hwallet:live",
  "smoke:hwallet-device-evidence",
  "smoke:mobile-session",
  "smoke:mobile-user-label",
  "smoke:mobile-hwallet-ux",
  "smoke:mobile-api-auth",
  "smoke:privy-wallet-status",
  "mobile:typecheck",
  "mobile:build:ios",
  "mobile:build:android",
  "verify:merge"
];

for (const scriptName of requiredRootScripts) {
  assert(typeof rootScripts[scriptName] === "string", `root package script ${scriptName} exists`);
}
assert(
  String(rootScripts["verify:merge"] || "").includes("smoke:mobile-store-readiness"),
  "verify:merge includes mobile store readiness gate"
);
assert(
  String(rootScripts["smoke:mobile-testflight-readiness"] || "").includes("smoke:mobile-store-readiness"),
  "legacy TestFlight readiness script delegates to mobile store readiness"
);
checks.push("root scripts expose and run the iOS and Android mobile store readiness gate");

const requiredMobileScripts = [
  "eas:whoami",
  "build:ios:development-staging",
  "build:android:development-staging",
  "build:ios:preview",
  "build:android:preview",
  "build:ios",
  "build:android",
  "update:development-staging",
  "update:preview",
  "update:production",
  "submit:ios",
  "submit:android"
];

for (const scriptName of requiredMobileScripts) {
  assert(typeof mobileScripts[scriptName] === "string", `mobile package script ${scriptName} exists`);
}
checks.push("mobile workspace exposes EAS iOS/Android build, update, and submit commands");

assert(String(mobilePackage.dependencies?.expo || "").startsWith("56."), "mobile Expo SDK 56 is pinned");
assert(Boolean(mobilePackage.dependencies?.["expo-updates"]), "expo-updates dependency is configured");
assert(Boolean(mobilePackage.dependencies?.["@privy-io/expo"]), "Privy Expo dependency is configured");
assert(Boolean(mobilePackage.dependencies?.["@privy-io/expo-native-extensions"]), "Privy native extension dependency is configured");
assert(Boolean(mobilePackage.devDependencies?.["eas-cli"] || mobilePackage.dependencies?.["eas-cli"]), "EAS CLI dependency is configured");
checks.push("native dependencies needed for installable HWallet builds are present");

assert(expoConfig.orientation === "portrait", "mobile app is portrait locked");
assert(Boolean(expoConfig.scheme), "mobile deep-link scheme is configured");
assert(Boolean(expoConfig.ios?.bundleIdentifier), "iOS bundle identifier is configured");
assert(Boolean(expoConfig.ios?.buildNumber), "iOS build number is configured");
assert(Number(expoConfig.ios?.buildNumber) > 0, "iOS build number is positive");
assert(Boolean(expoConfig.android?.package), "Android package name is configured");
assert(Number(expoConfig.android?.versionCode) > 0, "Android version code is positive");
assert(!isPlaceholderEasProject(expoConfig.extra?.eas?.projectId), "EAS project id is initialized");
assert(
  expoConfig.updates?.url === `https://u.expo.dev/${expoConfig.extra?.eas?.projectId}`,
  "EAS Update URL matches the initialized project id"
);
assert(expoConfig.runtimeVersion?.policy === "appVersion", "EAS Update runtime version uses app version policy");
checks.push("native app config is ready for installable internal builds");

assertProfile("development-staging", {
  developmentClient: true,
  distribution: "internal",
  channel: "development-staging",
  requireHttpsApi: true
});
assertProfile("preview", {
  distribution: "internal",
  channel: "preview",
  requireHttpsApi: true
});
assertProfile("production", {
  channel: "production",
  requireHttpsApi: true
});
checks.push("EAS staging, preview, and production profiles use public HTTPS HWallet API URLs");

assertUpdateScript("update:development-staging", "development-staging", "preview");
assertUpdateScript("update:preview", "preview", "preview");
assertUpdateScript("update:production", "production", "production");
checks.push("EAS Update scripts target the expected channels and environments");

assertIncludes(releaseChecklist, "npm run smoke:mobile-store-readiness", "release checklist includes mobile store readiness smoke");
assertIncludes(releaseChecklist, "npm run smoke:hwallet-device-evidence", "release checklist includes device evidence smoke");
assertIncludes(releaseChecklist, "npm run mobile:build:ios", "release checklist includes iOS build command");
assertIncludes(releaseChecklist, "npm run mobile:build:android", "release checklist includes Android build command");
assertIncludes(releaseChecklist, "npm --prefix apps/mobile run update:preview", "release checklist includes preview OTA update command");
assertIncludes(releaseChecklist, "docs/HWALLET_DEVICE_MULTI_USER_QA.md", "release checklist points to the device multi-user QA");
assertPattern(releaseChecklist, /Do not submit to TestFlight/i, "release checklist blocks TestFlight on failed gates");
assertPattern(releaseChecklist, /internal Android/i, "release checklist blocks internal Android testing on failed gates");
checks.push("release checklist documents the iOS and Android mobile release gate");

assertIncludes(deviceQa, "User A", "device QA includes User A");
assertIncludes(deviceQa, "User B", "device QA includes User B");
assertIncludes(deviceQa, "Switch Back To User A", "device QA includes switch-back test");
assertIncludes(deviceQa, "Signed-Out Boundary", "device QA includes signed-out boundary");
assertIncludes(deviceQa, "Copy feedback visible as `已复制`", "device QA includes copy feedback evidence");
assertIncludes(deviceQa, "smoke:mobile-device-hwallet:live", "device QA includes live device API smoke");
assertIncludes(deviceQa, "smoke:hwallet-device-evidence", "device QA includes redacted evidence smoke");
checks.push("device QA covers multi-user, signed-out, copy, HWallet live-smoke, and evidence gates");

assertIncludes(easRunbook, "update:preview", "EAS runbook documents preview update");
assertIncludes(easRunbook, "update:production", "EAS runbook documents production update");
assertPattern(easRunbook, /What Still Needs A New Build/i, "EAS runbook distinguishes native-build changes");
assertPattern(easRunbook, /Validation Before Publishing/i, "EAS runbook includes validation before publishing");
checks.push("EAS Update runbook is present for OTA-safe fixes");

assertNoRawSecrets({
  "apps/mobile/eas.json": JSON.stringify(easConfig, null, 2),
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist,
  "docs/HWALLET_DEVICE_MULTI_USER_QA.md": deviceQa,
  "docs/HWALLET_EAS_UPDATE_RUNBOOK.md": easRunbook
});
checks.push("release docs and EAS profile avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  mobile: {
    expoSdk: mobilePackage.dependencies?.expo || null,
    iosBuildNumber: expoConfig.ios?.buildNumber || null,
    androidVersionCode: expoConfig.android?.versionCode || null,
    easProjectConfigured: !isPlaceholderEasProject(expoConfig.extra?.eas?.projectId)
  },
  apiProfiles: {
    developmentStaging: profiles["development-staging"]?.env?.EXPO_PUBLIC_API_BASE_URL || null,
    preview: profiles.preview?.env?.EXPO_PUBLIC_API_BASE_URL || null,
    production: profiles.production?.env?.EXPO_PUBLIC_API_BASE_URL || null
  },
  liveExecution: {
    agent: false,
    onchainos: false,
    predictionTrading: false
  }
}, null, 2));

function assertProfile(name, expected) {
  const profile = profiles[name];
  assert(Boolean(profile), `EAS ${name} profile exists`);
  if (expected.developmentClient !== undefined) {
    assert(profile.developmentClient === expected.developmentClient, `EAS ${name} development client setting is correct`);
  }
  if (expected.distribution) {
    assert(profile.distribution === expected.distribution, `EAS ${name} distribution is ${expected.distribution}`);
  }
  assert(profile.channel === expected.channel, `EAS ${name} update channel is ${expected.channel}`);
  assert(profile.env?.EXPO_PUBLIC_AGENT_WALLET_V2_UI === "true", `EAS ${name} ships real V2 HWallet UI`);
  assert(profile.env?.EXPO_PUBLIC_AGENT_WALLET_PREVIEW !== "true", `EAS ${name} does not ship preview-only UI`);
  if (expected.requireHttpsApi) {
    assert(isHttpsPublicApi(profile.env?.EXPO_PUBLIC_API_BASE_URL), `EAS ${name} API URL is public HTTPS`);
  }
}

function assertUpdateScript(scriptName, channel, environment) {
  const value = String(mobileScripts[scriptName] || "");
  assert(value.includes("EXPO_PUBLIC_API_BASE_URL=https://app.hwallet.vip"), `${scriptName} uses the public HWallet API`);
  assert(value.includes("EXPO_PUBLIC_AGENT_WALLET_V2_UI=true"), `${scriptName} ships V2 HWallet UI`);
  assert(!value.includes("EXPO_PUBLIC_AGENT_WALLET_PREVIEW=true"), `${scriptName} does not ship preview-only UI`);
  assert(value.includes("eas update"), `${scriptName} runs eas update`);
  assert(value.includes(`--channel ${channel}`), `${scriptName} targets ${channel}`);
  assert(value.includes(`--environment ${environment}`), `${scriptName} targets ${environment} environment`);
}

function isHttpsPublicApi(value) {
  const url = parseUrl(value || "");
  return url?.protocol === "https:" && classifyApiBaseUrl(url) === "https";
}

function parseUrl(value) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function classifyApiBaseUrl(url) {
  if (!url) return "missing";
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1") {
    return "localhost";
  }
  if (hostname.startsWith("10.") || hostname.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
    return "lan";
  }
  if (url.protocol === "https:") return "https";
  return "public-http";
}

function isPlaceholderEasProject(value) {
  return !value || value === "replace-with-eas-project-id" || value === "00000000-0000-0000-0000-000000000000";
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), label);
}

function assertPattern(text, pattern, label) {
  assert(pattern.test(text), label);
}

function assertNoRawSecrets(files) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Mobile store readiness smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile store readiness smoke failed: ${label}`);
  checks.push(label);
}
