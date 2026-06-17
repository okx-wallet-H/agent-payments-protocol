import { readFile } from "node:fs/promises";

const checks = [];

const rootPackage = await readJson("package.json");
const mobilePackage = await readJson("apps/mobile/package.json");
const mobileApp = await readJson("apps/mobile/app.json");
const easConfig = await readJson("apps/mobile/eas.json");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const releaseHandoff = await readFile("docs/HWALLET_MOBILE_RELEASE_HANDOFF.md", "utf8");
const deviceQa = await readFile("docs/HWALLET_DEVICE_MULTI_USER_QA.md", "utf8");
const distributionPlan = await readFile("docs/HWALLET_STORE_DISTRIBUTION_PLAN.md", "utf8");

const rootScripts = rootPackage.scripts || {};
const mobileScripts = mobilePackage.scripts || {};
const expoConfig = mobileApp.expo || {};
const buildProfiles = easConfig.build || {};
const submitProfiles = easConfig.submit || {};

assert(typeof rootScripts["smoke:mobile-distribution-readiness"] === "string", "root exposes distribution readiness smoke");
assert(
  String(rootScripts["verify:merge"] || "").includes("smoke:mobile-distribution-readiness"),
  "verify:merge includes distribution readiness smoke"
);

assert(typeof mobileScripts["build:ios"] === "string", "mobile iOS production build script exists");
assert(typeof mobileScripts["build:android"] === "string", "mobile Android production build script exists");
assert(typeof mobileScripts["submit:ios"] === "string", "mobile iOS submit script exists");
assert(typeof mobileScripts["submit:android"] === "string", "mobile Android submit script exists");
assertIncludes(mobileScripts["build:ios"], "eas build --platform ios --profile production", "iOS build targets production profile");
assertIncludes(mobileScripts["build:android"], "eas build --platform android --profile production", "Android build targets production profile");
assertIncludes(mobileScripts["submit:ios"], "eas submit --platform ios --profile production", "iOS submit targets production profile");
assertIncludes(mobileScripts["submit:android"], "eas submit --platform android --profile production", "Android submit targets production profile");
checks.push("mobile workspace has production build and submit commands for both platforms");

const production = buildProfiles.production || {};
assert(Boolean(production), "EAS production build profile exists");
assert(production.autoIncrement === true, "EAS production build auto-increments native versions");
assert(production.channel === "production", "EAS production build uses production channel");
assert(isPublicHttps(production.env?.EXPO_PUBLIC_API_BASE_URL), "EAS production API URL is public HTTPS");
assert(production.env?.EXPO_PUBLIC_AGENT_WALLET_V2_UI === "true", "EAS production ships V2 HWallet UI");
assert(production.env?.EXPO_PUBLIC_AGENT_WALLET_PREVIEW !== "true", "EAS production does not ship preview-only UI");
assert(Boolean(submitProfiles.production), "EAS production submit profile exists");
checks.push("EAS production build and submit profiles are present");

assert(expoConfig.name === "Agent Wallet", "Expo app name is recorded");
assert(expoConfig.slug === "agent-wallet-xlayer-mvp", "Expo slug is recorded");
assert(isSemverLike(expoConfig.version), "Expo app version is semver-like");
assert(Boolean(expoConfig.icon), "Expo app icon is configured");
assert(Boolean(expoConfig.scheme), "Expo deep-link scheme is configured");
assert(expoConfig.orientation === "portrait", "Expo app is portrait locked");
assert(expoConfig.ios?.bundleIdentifier === "com.agentwallet.xlayer", "iOS bundle id is configured");
assert(Number(expoConfig.ios?.buildNumber) > 0, "iOS build number is positive");
assert(expoConfig.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false, "iOS export compliance flag is configured");
assert(expoConfig.android?.package === "com.agentwallet.xlayer", "Android package is configured");
assert(Number(expoConfig.android?.versionCode) > 0, "Android version code is positive");
assert(Array.isArray(expoConfig.android?.permissions), "Android permissions are explicit");
assert(expoConfig.android.permissions.length === 0, "Android permissions remain minimal");
assert(Boolean(expoConfig.extra?.eas?.projectId), "EAS project id is configured");
assert(
  expoConfig.updates?.url === `https://u.expo.dev/${expoConfig.extra?.eas?.projectId}`,
  "EAS update URL matches project id"
);
checks.push("native app identifiers and minimal permission boundary are configured");

assertIncludes(releaseChecklist, "docs/HWALLET_STORE_DISTRIBUTION_PLAN.md", "release checklist links store distribution plan");
assertIncludes(releaseHandoff, "docs/HWALLET_DEVICE_MULTI_USER_QA.md", "release handoff points to device QA");
assertIncludes(releaseHandoff, "e4603d5d-2123-4502-94f9-3e9035ba3c9e", "release handoff records current iOS preview build");
assertIncludes(releaseHandoff, "ab124aea-fbe7-47e1-aea8-b69ceddae248", "release handoff records current Android preview build");
assertIncludes(deviceQa, "Installed-App Regression Gate", "device QA includes installed-App regression gate");
assertIncludes(deviceQa, "Android", "device QA covers Android expectations");
checks.push("distribution readiness is tied to handoff and device QA evidence");

assertIncludes(distributionPlan, "TestFlight", "distribution plan covers TestFlight");
assertIncludes(distributionPlan, "Google Play Console", "distribution plan covers Google Play Console");
assertIncludes(distributionPlan, "Internal testing", "distribution plan covers Android internal testing");
assertIncludes(distributionPlan, "App Store Connect", "distribution plan covers App Store Connect");
assertIncludes(distributionPlan, "Privacy policy URL", "distribution plan requires privacy policy URL");
assertIncludes(distributionPlan, "Support URL", "distribution plan requires support URL");
assertIncludes(distributionPlan, "Data safety", "distribution plan requires Android data safety answers");
assertIncludes(distributionPlan, "Content rating", "distribution plan requires Android content rating");
assertIncludes(distributionPlan, "Screenshots", "distribution plan requires store screenshots");
assertIncludes(distributionPlan, "HWALLET_DEVICE_EVIDENCE_REQUIRED=true", "distribution plan requires strict device evidence");
assertIncludes(distributionPlan, "HWALLET_DUAL_DEVICE_EVIDENCE_REQUIRED=true", "distribution plan requires strict dual-device evidence");
assertIncludes(distributionPlan, "HWALLET_IOS_DEVICE_EVIDENCE_FILE", "distribution plan requires iOS device evidence");
assertIncludes(distributionPlan, "HWALLET_ANDROID_DEVICE_EVIDENCE_FILE", "distribution plan requires Android device evidence");
assertIncludes(distributionPlan, "MOBILE_DEVICE_API_BASE_URL=https://app.hwallet.vip", "distribution plan requires staging device auth boundary smoke");
assertIncludes(distributionPlan, "npm run submit:ios", "distribution plan documents iOS submit command");
assertIncludes(distributionPlan, "npm run submit:android", "distribution plan documents Android submit command");
assertIncludes(distributionPlan, "Live execution remains closed", "distribution plan keeps live execution closed");
assertIncludes(distributionPlan, "No secrets are committed", "distribution plan keeps secret hygiene visible");
checks.push("distribution plan documents store metadata, evidence, submit, and safety requirements");

assertNoRawSecrets({
  "apps/mobile/eas.json": JSON.stringify(easConfig, null, 2),
  "apps/mobile/app.json": JSON.stringify(mobileApp, null, 2),
  "docs/HWALLET_STORE_DISTRIBUTION_PLAN.md": distributionPlan,
  "docs/HWALLET_MOBILE_RELEASE_HANDOFF.md": releaseHandoff,
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist
});
checks.push("distribution readiness docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  distribution: {
    iosBundleIdentifier: expoConfig.ios?.bundleIdentifier || null,
    androidPackage: expoConfig.android?.package || null,
    appVersion: expoConfig.version || null,
    iosBuildNumber: expoConfig.ios?.buildNumber || null,
    androidVersionCode: expoConfig.android?.versionCode || null,
    productionApi: production.env?.EXPO_PUBLIC_API_BASE_URL || null,
    submitProfileConfigured: Boolean(submitProfiles.production),
    externalTesterGate: "requires-redacted-device-evidence"
  }
}, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function isSemverLike(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function isPublicHttps(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const local =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
    return url.protocol === "https:" && !local;
  } catch {
    return false;
  }
}

function assertIncludes(text, needle, label) {
  assert(String(text || "").includes(needle), label);
}

function assertNoRawSecrets(files) {
  const forbidden = [
    /gho_[A-Za-z0-9_]+/,
    /sk-[A-Za-z0-9_-]{20,}/,
    /privy_[A-Za-z0-9_-]{20,}/,
    /postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/i,
    /APPLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/,
    /GOOGLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Mobile distribution readiness failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile distribution readiness failed: ${label}`);
  checks.push(label);
}
