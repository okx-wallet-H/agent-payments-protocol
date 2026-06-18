import { readFile } from "node:fs/promises";

const checks = [];

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const plan = await readFile("docs/HWALLET_STORE_REVIEW_ACCOUNT_PLAN.md", "utf8");
const submissionPacket = await readFile("docs/HWALLET_STORE_SUBMISSION_PACKET.md", "utf8");
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const distributionPlan = await readFile("docs/HWALLET_STORE_DISTRIBUTION_PLAN.md", "utf8");
const ownerPacket = await readFile("docs/HWALLET_OWNER_RELEASE_PACKET.md", "utf8");

const scripts = packageJson.scripts || {};

assert(typeof scripts["smoke:store-review-account-plan"] === "string", "package exposes store review account plan smoke");
assert(
  String(scripts["verify:merge"] || "").includes("smoke:store-review-account-plan"),
  "verify:merge includes store review account plan smoke"
);

for (const section of [
  "Review Login Boundary",
  "Test Account Model",
  "Reviewer Instructions Draft",
  "Data And Redaction Rules",
  "Go / No-Go"
]) {
  assertHeading(plan, section, `review account plan includes ${section}`);
}

for (const required of [
  "海豚社区",
  "HWallet",
  "Agent",
  "https://app.hwallet.vip",
  "email-based Privy login",
  "read-only observation, simulation, local tracking",
  "Live execution boundary: read-only observation",
  "autonomous money movement stay closed",
  "Email login and logout",
  "HWallet receive address creation",
  "Copy feedback",
  "Account switching with a second test email",
  "Agent read-only analysis",
  "audit/history visibility"
]) {
  assertIncludes(plan, required, `review account plan covers ${required}`);
}

for (const boundary of [
  "owner controls outside the repository",
  "private reviewer fields",
  "Verification code: never hardcoded",
  "never committed",
  "static password",
  "Static demo codes such as `123456` are not allowed for production review",
  "owner-managed",
  "rotate it after review"
]) {
  assertIncludes(plan, boundary, `review account plan enforces boundary: ${boundary}`);
}

for (const reviewerInstruction of [
  "does not submit live orders",
  "Request the email verification code",
  "Enter the code from the review mailbox",
  "confirm a receive address appears",
  "confirm copy feedback appears",
  "account switch/logout",
  "read-only wallet or market analysis",
  "Private keys and seed phrases are never requested"
]) {
  assertIncludes(plan, reviewerInstruction, `review instructions include ${reviewerInstruction}`);
}

assertIncludes(submissionPacket, "docs/HWALLET_STORE_REVIEW_ACCOUNT_PLAN.md", "submission packet links review account plan");
assertIncludes(submissionPacket, "email-code login", "submission packet records review login method");
assertIncludes(submissionPacket, "Static demo codes are not allowed", "submission packet blocks static demo codes");
assertIncludes(releaseChecklist, "npm run smoke:store-review-account-plan", "release checklist runs store review account smoke");
assertIncludes(distributionPlan, "npm run smoke:store-review-account-plan", "distribution plan runs store review account smoke");
assertIncludes(ownerPacket, "review account", "owner packet mentions review account owner action");
checks.push("release docs link the store review account plan");

assertNoRawSecrets({
  "docs/HWALLET_STORE_REVIEW_ACCOUNT_PLAN.md": plan,
  "docs/HWALLET_STORE_SUBMISSION_PACKET.md": submissionPacket,
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist,
  "docs/HWALLET_STORE_DISTRIBUTION_PLAN.md": distributionPlan,
  "docs/HWALLET_OWNER_RELEASE_PACKET.md": ownerPacket
});
checks.push("review account docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  reviewAccountPlan: {
    loginMethod: "email-code",
    credentialsInGit: false,
    staticVerificationCodeAllowed: false,
    ownerManagedMailboxRequired: true,
    liveExecutionClosed: true
  }
}, null, 2));

function assertIncludes(text, value, label) {
  assert(text.includes(value), label);
}

function assertHeading(text, value, label) {
  assert(new RegExp(`^## ${escapeRegExp(value)}$`, "m").test(text), label);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    /password\s*[:=]\s*["']?[^"'\s]{8,}/i,
    /verification code\s*[:=]\s*["']?\d{6}/i,
    /验证码\s*[:=：]\s*\d{6}/
  ];

  for (const [file, text] of Object.entries(files)) {
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        throw new Error(`Store review account plan smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`Store review account plan smoke failed: ${label}`);
  checks.push(label);
}
