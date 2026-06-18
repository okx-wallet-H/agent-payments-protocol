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
const submissionPacket = await readFile("docs/HWALLET_STORE_SUBMISSION_PACKET.md", "utf8");
const storeConsoleEvidenceExample = await readFile("docs/HWALLET_STORE_CONSOLE_EVIDENCE.example.json", "utf8");
const privacyPage = await readFile("app/privacy/page.tsx", "utf8");
const supportPage = await readFile("app/support/page.tsx", "utf8");
const iconPng = await readFile("apps/mobile/assets/icon.png");
const adaptiveIconPng = await readFile("apps/mobile/assets/adaptive-icon.png");
const splashPng = await readFile("apps/mobile/assets/splash.png");

const rootScripts = rootPackage.scripts || {};
const mobileScripts = mobilePackage.scripts || {};
const expoConfig = mobileApp.expo || {};
const buildProfiles = easConfig.build || {};
const submitProfiles = easConfig.submit || {};

assert(typeof rootScripts["smoke:mobile-distribution-readiness"] === "string", "root exposes distribution readiness smoke");
assert(typeof rootScripts["smoke:mobile-release-preflight"] === "string", "root exposes mobile release preflight smoke");
assert(typeof rootScripts["smoke:mobile-release-handoff"] === "string", "root exposes mobile release handoff smoke");
assert(typeof rootScripts["smoke:mobile-store-submission"] === "string", "root exposes mobile store submission smoke");
assert(typeof rootScripts["smoke:hwallet-store-console-evidence"] === "string", "root exposes store console evidence smoke");
assert(typeof rootScripts["hwallet:store-console-evidence:init"] === "string", "root exposes store console evidence initializer");
assert(typeof rootScripts["hwallet:store-console-evidence:record"] === "string", "root exposes store console evidence recorder");
assert(
  String(rootScripts["verify:merge"] || "").includes("smoke:mobile-distribution-readiness"),
  "verify:merge includes distribution readiness smoke"
);
assert(
  String(rootScripts["verify:merge"] || "").includes("smoke:mobile-release-preflight"),
  "verify:merge includes mobile release preflight smoke"
);
assert(
  String(rootScripts["verify:merge"] || "").includes("smoke:mobile-release-handoff"),
  "verify:merge includes mobile release handoff smoke"
);
assert(
  String(rootScripts["verify:merge"] || "").includes("smoke:mobile-store-submission"),
  "verify:merge includes mobile store submission smoke"
);
assert(
  String(rootScripts["verify:merge"] || "").includes("smoke:hwallet-store-console-evidence"),
  "verify:merge includes store console evidence smoke"
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

assert(expoConfig.name === "海豚社区", "Expo app name is owner-approved");
assert(expoConfig.slug === "agent-wallet-xlayer-mvp", "Expo slug is recorded");
assert(isSemverLike(expoConfig.version), "Expo app version is semver-like");
assert(Boolean(expoConfig.icon), "Expo app icon is configured");
assert(isPng(iconPng), "Expo app icon asset is PNG");
assert(isPng(adaptiveIconPng), "Expo adaptive icon asset is PNG");
assert(isPng(splashPng), "Expo splash icon asset is PNG");
assert(Boolean(expoConfig.scheme), "Expo deep-link scheme is configured");
assert(expoConfig.orientation === "portrait", "Expo app is portrait locked");
assert(expoConfig.ios?.bundleIdentifier === "com.agentwallet.xlayer", "iOS bundle id is configured");
assert(Number(expoConfig.ios?.buildNumber) > 0, "iOS build number is positive");
assert(expoConfig.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false, "iOS export compliance flag is configured");
assert(expoConfig.ios?.infoPlist?.CFBundleDisplayName === "海豚社区", "iOS display name is owner-approved");
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
assertIncludes(releaseHandoff, "60425e71-5a50-4143-92df-5aefc7499aab", "release handoff records current iOS production build");
assertIncludes(releaseHandoff, "281cbee1-d288-45d4-a3d3-15ed92c9aef4", "release handoff records current iOS EAS Submit job");
assertIncludes(releaseHandoff, "6c66eb31-ea1b-40f2-b23d-bfb3ee2fa547", "release handoff records current Android production build");
assertIncludes(releaseHandoff, ".tmp/hwallet-device-evidence-ios.json", "release handoff records iOS device evidence path");
assertIncludes(releaseHandoff, ".tmp/hwallet-device-evidence-android.json", "release handoff records Android device evidence path");
assertIncludes(releaseHandoff, "HWALLET_RELEASE_HANDOFF_STRICT=true", "release handoff documents strict handoff gate");
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
assertIncludes(distributionPlan, "HWALLET_RELEASE_PREFLIGHT_STRICT=true", "distribution plan requires strict release preflight");
assertIncludes(distributionPlan, "npm run smoke:mobile-release-preflight", "distribution plan documents release preflight");
assertIncludes(distributionPlan, "HWALLET_RELEASE_HANDOFF_STRICT=true", "distribution plan requires strict release handoff");
assertIncludes(distributionPlan, "npm run smoke:mobile-release-handoff", "distribution plan documents release handoff");
assertIncludes(distributionPlan, "docs/HWALLET_STORE_SUBMISSION_PACKET.md", "distribution plan links store submission packet");
assertIncludes(distributionPlan, "npm run smoke:mobile-store-submission", "distribution plan documents store submission gate");
assertIncludes(distributionPlan, "npm run hwallet:store-console-evidence:init", "distribution plan initializes store console evidence");
assertIncludes(distributionPlan, "npm run hwallet:store-console-evidence:record", "distribution plan records store console evidence");
assertIncludes(distributionPlan, "HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED=true", "distribution plan requires strict store console evidence");
assertIncludes(distributionPlan, "npm run smoke:hwallet-store-console-evidence", "distribution plan documents store console evidence gate");
assertIncludes(distributionPlan, "MOBILE_DEVICE_API_BASE_URL=https://app.hwallet.vip", "distribution plan requires staging device auth boundary smoke");
assertIncludes(distributionPlan, "npm run submit:ios", "distribution plan documents iOS submit command");
assertIncludes(distributionPlan, "npm run submit:android", "distribution plan documents Android submit command");
assertIncludes(distributionPlan, "Live execution remains closed", "distribution plan keeps live execution closed");
assertIncludes(distributionPlan, "No secrets are committed", "distribution plan keeps secret hygiene visible");
checks.push("distribution plan documents store metadata, evidence, submit, and safety requirements");

assertIncludes(submissionPacket, "Product: 海豚社区", "submission packet names owner-approved public app");
assertIncludes(submissionPacket, "Internal wallet module: HWallet", "submission packet preserves HWallet wallet module");
assertIncludes(submissionPacket, "Privacy policy URL: `https://app.hwallet.vip/privacy`", "submission packet records privacy URL");
assertIncludes(submissionPacket, "Support URL: `https://app.hwallet.vip/support`", "submission packet records support URL");
assertIncludes(submissionPacket, "Review notes must include the read-only/local-draft boundary", "submission packet records App Store review boundary");
assertIncludes(submissionPacket, "Data safety answers must include", "submission packet records Play data safety boundary");
assertIncludes(submissionPacket, "Store console evidence", "submission packet records store console evidence blocker");
assertIncludes(submissionPacket, "Live execution remains closed", "submission packet keeps live execution closed");
assertIncludes(privacyPage, "Privacy Policy", "privacy page exists");
assertIncludes(supportPage, "Support", "support page exists");
checks.push("distribution readiness includes public store submission packet, store console evidence, and legal pages");

const storeConsoleEvidence = JSON.parse(storeConsoleEvidenceExample);
assert(storeConsoleEvidence.kind === "hwallet-store-console-evidence", "store console evidence example has expected kind");
assert(storeConsoleEvidence.ios?.console === "App Store Connect", "store console evidence covers App Store Connect");
assert(storeConsoleEvidence.android?.console === "Google Play Console", "store console evidence covers Google Play Console");
assert(storeConsoleEvidence.checks?.liveExecutionClosed === true, "store console evidence keeps live execution closed");
assert(storeConsoleEvidence.confirmations?.noCredentialsInEvidence === true, "store console evidence confirms no credentials");
checks.push("store console evidence example covers iOS, Android, safety, and no-secret confirmations");

assertNoRawSecrets({
  "apps/mobile/eas.json": JSON.stringify(easConfig, null, 2),
  "apps/mobile/app.json": JSON.stringify(mobileApp, null, 2),
  "docs/HWALLET_STORE_DISTRIBUTION_PLAN.md": distributionPlan,
  "docs/HWALLET_STORE_SUBMISSION_PACKET.md": submissionPacket,
  "docs/HWALLET_STORE_CONSOLE_EVIDENCE.example.json": storeConsoleEvidenceExample,
  "docs/HWALLET_MOBILE_RELEASE_HANDOFF.md": releaseHandoff,
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist,
  "app/privacy/page.tsx": privacyPage,
  "app/support/page.tsx": supportPage
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

function isPng(buffer) {
  return Buffer.isBuffer(buffer)
    && buffer.length > 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a;
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
