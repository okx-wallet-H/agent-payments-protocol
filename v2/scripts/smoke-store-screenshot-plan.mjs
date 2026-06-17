import { readFile } from "node:fs/promises";

const checks = [];

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const screenshotPlan = await readFile("docs/HWALLET_STORE_SCREENSHOT_PLAN.md", "utf8");
const submissionPacket = await readFile("docs/HWALLET_STORE_SUBMISSION_PACKET.md", "utf8");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const distributionPlan = await readFile("docs/HWALLET_STORE_DISTRIBUTION_PLAN.md", "utf8");
const ownerPacket = await readFile("docs/HWALLET_OWNER_RELEASE_PACKET.md", "utf8");

const scripts = packageJson.scripts || {};

assert(typeof scripts["smoke:store-screenshot-plan"] === "string", "package exposes store screenshot plan smoke");
assert(
  String(scripts["verify:merge"] || "").includes("smoke:store-screenshot-plan"),
  "verify:merge includes store screenshot plan smoke"
);

for (const section of [
  "Screenshot Story",
  "Required Device Frames",
  "Copy Overlay Rules",
  "Redaction Rules",
  "Owner Approval Checklist",
  "Validation"
]) {
  assertIncludes(screenshotPlan, `## ${section}`, `screenshot plan includes ${section}`);
}

for (const screen of [
  "Agent Home",
  "HWallet Receive",
  "Assets Ready",
  "Agent Analysis",
  "Audit / Records"
]) {
  assertIncludes(screenshotPlan, `**${screen}**`, `screenshot story includes ${screen}`);
}

for (const frame of [
  "iPhone 6.7-inch portrait",
  "iPhone 6.5-inch or 6.1-inch portrait fallback",
  "Android phone portrait"
]) {
  assertIncludes(screenshotPlan, frame, `screenshot plan requires ${frame}`);
}

for (const productFact of [
  "HWallet is the wallet entry",
  "Agent is the core experience",
  "Email login creates a user session",
  "one receive address",
  "tx hash is optional",
  "observe/simulate only",
  "Live signing, swaps, orders, and autonomous money movement are closed"
]) {
  assertIncludes(screenshotPlan, productFact, `screenshot copy preserves ${productFact}`);
}

for (const redaction of [
  "Raw email addresses",
  "Full wallet addresses",
  "Full transaction hashes",
  "Verification codes",
  "Access tokens",
  "Private keys or seed phrases",
  "Dashboard credentials",
  "`.tmp` local evidence paths"
]) {
  assertIncludes(screenshotPlan, redaction, `screenshot plan blocks ${redaction}`);
}

assertIncludes(screenshotPlan, "https://app.hwallet.vip", "screenshot plan requires staging API build");
assertIncludes(screenshotPlan, "Owner approves final visual order and copy", "screenshot plan keeps owner approval gate");
assertIncludes(screenshotPlan, "Strict public release still requires owner-approved screenshot files", "screenshot plan keeps strict owner gate");
assertIncludes(screenshotPlan, "npm run smoke:store-screenshot-plan", "screenshot plan is self-verifiable");
assertIncludes(submissionPacket, "docs/HWALLET_STORE_SCREENSHOT_PLAN.md", "submission packet links screenshot plan");
assertIncludes(submissionPacket, "Store screenshots are approved by the owner", "submission packet keeps screenshot approval blocker");
assertIncludes(releaseChecklist, "Store screenshots", "release checklist names screenshot gate");
assertIncludes(distributionPlan, "screenshots", "distribution plan references screenshots");
assertIncludes(ownerPacket, "screenshots", "owner packet requests screenshots");

assertNoRawSecrets({
  "docs/HWALLET_STORE_SCREENSHOT_PLAN.md": screenshotPlan,
  "docs/HWALLET_STORE_SUBMISSION_PACKET.md": submissionPacket,
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist,
  "docs/HWALLET_STORE_DISTRIBUTION_PLAN.md": distributionPlan,
  "docs/HWALLET_OWNER_RELEASE_PACKET.md": ownerPacket
});
checks.push("screenshot plan and linked release docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  screenshots: {
    requiredScreens: 5,
    requiredDeviceFrames: 3,
    ownerApprovalRequired: true,
    liveExecutionClosed: true,
    redactionRequired: true
  }
}, null, 2));

function assertIncludes(text, value, label) {
  assert(String(text || "").includes(value), label);
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
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /0x[a-fA-F0-9]{40}/,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Store screenshot plan smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Store screenshot plan smoke failed: ${label}`);
  checks.push(label);
}
