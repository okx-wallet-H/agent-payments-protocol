import { readFile } from "node:fs/promises";

const checks = [];

const rootPackage = await readJson("package.json");
const mobileApp = await readJson("apps/mobile/app.json");
const easConfig = await readJson("apps/mobile/eas.json");
const distributionPlan = await readFile("docs/HWALLET_STORE_DISTRIBUTION_PLAN.md", "utf8");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const submissionPacket = await readFile("docs/HWALLET_STORE_SUBMISSION_PACKET.md", "utf8");
const screenshotPlan = await readFile("docs/HWALLET_STORE_SCREENSHOT_PLAN.md", "utf8");
const storeConsoleEvidenceExample = await readFile("docs/HWALLET_STORE_CONSOLE_EVIDENCE.example.json", "utf8");
const privacyPage = await readFile("app/privacy/page.tsx", "utf8");
const supportPage = await readFile("app/support/page.tsx", "utf8");
const iconPng = await readFile("apps/mobile/assets/icon.png");
const adaptiveIconPng = await readFile("apps/mobile/assets/adaptive-icon.png");
const splashPng = await readFile("apps/mobile/assets/splash.png");

const scripts = rootPackage.scripts || {};
const expo = mobileApp.expo || {};
const production = easConfig.build?.production || {};

assert(typeof scripts["smoke:mobile-store-submission"] === "string", "package exposes mobile store submission smoke");
assert(typeof scripts["smoke:store-screenshot-plan"] === "string", "package exposes store screenshot plan smoke");
assert(typeof scripts["smoke:hwallet-store-console-evidence"] === "string", "package exposes store console evidence smoke");
assert(
  String(scripts["verify:merge"] || "").includes("smoke:mobile-store-submission"),
  "verify:merge includes mobile store submission smoke"
);

assert(expo.ios?.bundleIdentifier === "com.agentwallet.xlayer", "submission packet uses current iOS bundle id");
assert(expo.android?.package === "com.agentwallet.xlayer", "submission packet uses current Android package");
assert(expo.version === "0.1.0", "submission packet uses current app version");
assert(expo.name === "海豚社区", "submission packet uses owner-approved public app name");
assert(expo.ios?.infoPlist?.CFBundleDisplayName === "海豚社区", "iOS binary display name is owner-approved");
assert(isPng(iconPng), "mobile app icon is a PNG asset");
assert(isPng(adaptiveIconPng), "mobile adaptive icon is a PNG asset");
assert(isPng(splashPng), "mobile splash icon is a PNG asset");
assert(production.env?.EXPO_PUBLIC_API_BASE_URL === "https://app.hwallet.vip", "production build targets public HWallet API");
checks.push("native identifiers and production API are stable for store submission packet");

assertIncludes(submissionPacket, "Product: 海豚社区", "submission packet names owner-approved public app");
assertIncludes(submissionPacket, "HWallet wallet entry plus Agent experience", "submission packet names product body");
assertIncludes(submissionPacket, "Current binary display name: 海豚社区", "submission packet records current binary display name");
assertIncludes(submissionPacket, "Internal wallet module: HWallet", "submission packet preserves HWallet wallet module");
assertIncludes(submissionPacket, "https://app.hwallet.vip/privacy", "submission packet records privacy URL");
assertIncludes(submissionPacket, "https://app.hwallet.vip/support", "submission packet records support URL");
assertIncludes(submissionPacket, "com.agentwallet.xlayer", "submission packet records app identifiers");
assertIncludes(submissionPacket, "Finance", "submission packet records category");
assertIncludes(submissionPacket, "App Store Connect Baseline", "submission packet includes App Store baseline");
assertIncludes(submissionPacket, "Google Play Console Baseline", "submission packet includes Google Play baseline");
assertIncludes(submissionPacket, "read-only observation, simulation, local tracking", "submission packet records review safety boundary");
assertIncludes(submissionPacket, "Live execution status: closed", "submission packet records closed execution");
assertIncludes(submissionPacket, "Data safety answers", "submission packet records Play data safety baseline");
assertIncludes(submissionPacket, "Store screenshots are approved by the owner", "submission packet keeps owner screenshot approval gate");
assertIncludes(submissionPacket, "docs/HWALLET_STORE_SCREENSHOT_PLAN.md", "submission packet links screenshot plan");
assertIncludes(submissionPacket, "Store console evidence", "submission packet keeps store console evidence gate");
checks.push("submission packet records metadata, review notes, data safety, and blockers");

assertIncludes(screenshotPlan, "Agent Home", "screenshot plan covers Agent home");
assertIncludes(screenshotPlan, "HWallet Receive", "screenshot plan covers HWallet receive");
assertIncludes(screenshotPlan, "Assets Ready", "screenshot plan covers assets ready");
assertIncludes(screenshotPlan, "Agent Analysis", "screenshot plan covers Agent analysis");
assertIncludes(screenshotPlan, "Audit / Records", "screenshot plan covers audit records");
assertIncludes(screenshotPlan, "iPhone 6.7-inch portrait", "screenshot plan covers iOS required frame");
assertIncludes(screenshotPlan, "Android phone portrait", "screenshot plan covers Android frame");
assertIncludes(screenshotPlan, "Full wallet addresses", "screenshot plan blocks full wallet address exposure");
assertIncludes(screenshotPlan, "Raw email addresses", "screenshot plan blocks raw email exposure");
assertIncludes(screenshotPlan, "Owner approves final visual order and copy", "screenshot plan keeps owner approval");
checks.push("store screenshot plan covers required screens, frames, redaction, and owner approval");

assertIncludes(privacyPage, "Privacy Policy", "privacy page exists");
assertIncludes(privacyPage, "autonomous money movement are disabled", "privacy page states live execution boundary");
assertIncludes(privacyPage, "Private keys or seed phrases", "privacy page states private key boundary");
assertIncludes(privacyPage, "Transaction hashes", "privacy page discloses tx hash processing");
assertIncludes(privacyPage, "Agent messages", "privacy page discloses Agent records");

assertIncludes(supportPage, "Support", "support page exists");
assertIncludes(supportPage, "store review", "support page covers store review");
assertIncludes(supportPage, "will never ask for a seed phrase or private key", "support page warns against private key sharing");
assertIncludes(supportPage, "does not submit live orders", "support page states no live order boundary");
checks.push("public privacy and support pages cover release-review safety boundaries");

assertIncludes(distributionPlan, "docs/HWALLET_STORE_SUBMISSION_PACKET.md", "distribution plan links store submission packet");
assertIncludes(distributionPlan, "npm run smoke:mobile-store-submission", "distribution plan runs store submission smoke");
assertIncludes(distributionPlan, "npm run smoke:hwallet-store-console-evidence", "distribution plan runs store console evidence smoke");
assertIncludes(releaseChecklist, "npm run smoke:mobile-store-submission", "release checklist runs store submission smoke");
assertIncludes(releaseChecklist, "npm run smoke:hwallet-store-console-evidence", "release checklist runs store console evidence smoke");
assertIncludes(releaseChecklist, "docs/HWALLET_STORE_SUBMISSION_PACKET.md", "release checklist links store submission packet");
checks.push("release docs include store submission gate");

const storeConsoleEvidence = JSON.parse(storeConsoleEvidenceExample);
assert(storeConsoleEvidence.kind === "hwallet-store-console-evidence", "store console evidence example has expected kind");
assert(storeConsoleEvidence.ios?.metadata?.reviewNotesObserveOnly === true, "store console evidence covers App Store review notes");
assert(storeConsoleEvidence.android?.metadata?.dataSafetyCompleted === true, "store console evidence covers Play data safety");
assert(storeConsoleEvidence.confirmations?.readyForInternalReview === true, "store console evidence covers internal review readiness");
checks.push("store console evidence example covers review metadata and internal testing readiness");

assertNoRawSecrets({
  "docs/HWALLET_STORE_SUBMISSION_PACKET.md": submissionPacket,
  "docs/HWALLET_STORE_SCREENSHOT_PLAN.md": screenshotPlan,
  "docs/HWALLET_STORE_CONSOLE_EVIDENCE.example.json": storeConsoleEvidenceExample,
  "app/privacy/page.tsx": privacyPage,
  "app/support/page.tsx": supportPage,
  "docs/HWALLET_STORE_DISTRIBUTION_PLAN.md": distributionPlan,
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist,
  "apps/mobile/app.json": JSON.stringify(mobileApp, null, 2),
  "apps/mobile/eas.json": JSON.stringify(easConfig, null, 2)
});
checks.push("store submission packet and public legal pages avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  submission: {
    product: "海豚社区",
    walletModule: "HWallet",
    iosBundleIdentifier: expo.ios?.bundleIdentifier || null,
    androidPackage: expo.android?.package || null,
    privacyPolicyUrl: "https://app.hwallet.vip/privacy",
    supportUrl: "https://app.hwallet.vip/support",
    liveExecutionClosed: true,
    publicTrackBlockedUntilOwnerScreenshots: true
  }
}, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
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
    /MOBILE_DEVICE_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
    /MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/,
    /APPLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/,
    /GOOGLE_[A-Z0-9_]*\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Mobile store submission smoke failed: ${file} must not contain raw secret material`);
      }
    }
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

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile store submission smoke failed: ${label}`);
  checks.push(label);
}
