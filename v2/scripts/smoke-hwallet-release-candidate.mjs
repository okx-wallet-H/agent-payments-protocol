import { readFile } from "node:fs/promises";

const checks = [];

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const mobilePackage = JSON.parse(await readFile("apps/mobile/package.json", "utf8"));
const easConfig = JSON.parse(await readFile("apps/mobile/eas.json", "utf8"));
const releaseChecklist = await readFile("docs/V2_RELEASE_CHECKLIST.md", "utf8");
const mobileReleaseHandoff = await readFile("docs/HWALLET_MOBILE_RELEASE_HANDOFF.md", "utf8");
const stagingDeployment = await readFile("docs/STAGING_SERVER_DEPLOYMENT.md", "utf8");
const deviceQa = await readFile("docs/HWALLET_DEVICE_MULTI_USER_QA.md", "utf8");
const easRunbook = await readFile("docs/HWALLET_EAS_UPDATE_RUNBOOK.md", "utf8");
const deviceEvidenceExample = await readFile("docs/HWALLET_DEVICE_EVIDENCE.example.json", "utf8");
const deviceEvidenceInit = await readFile("v2/scripts/init-hwallet-device-evidence.mjs", "utf8");
const deviceEvidenceRecord = await readFile("v2/scripts/record-hwallet-device-evidence.mjs", "utf8");
const dualDeviceEvidenceSmoke = await readFile("v2/scripts/smoke-hwallet-dual-device-evidence.mjs", "utf8");
const stagingHandoffSmoke = await readFile("v2/scripts/smoke-hwallet-staging-handoff.mjs", "utf8");
const stagingServerSmoke = await readFile("v2/scripts/smoke-staging-server.mjs", "utf8");
const stagingAuthSmoke = await readFile("v2/scripts/smoke-staging-auth-surface.mjs", "utf8");
const mobileDeviceSmoke = await readFile("v2/scripts/smoke-mobile-device-hwallet-live.mjs", "utf8");
const mobileTestflightSmoke = await readFile("v2/scripts/smoke-mobile-testflight-readiness.mjs", "utf8");
const mobileReleasePreflightSmoke = await readFile("v2/scripts/smoke-mobile-release-preflight.mjs", "utf8");
const mobileReleaseHandoffSmoke = await readFile("v2/scripts/smoke-mobile-release-handoff.mjs", "utf8");
const mobileStoreSubmissionSmoke = await readFile("v2/scripts/smoke-mobile-store-submission.mjs", "utf8");
const storeSubmissionPacket = await readFile("docs/HWALLET_STORE_SUBMISSION_PACKET.md", "utf8");
const privacyPage = await readFile("app/privacy/page.tsx", "utf8");
const supportPage = await readFile("app/support/page.tsx", "utf8");
const supabaseReadbackSmoke = await readFile("v2/scripts/smoke-supabase-readback-drill.mjs", "utf8");

const scripts = packageJson.scripts || {};
const mobileScripts = mobilePackage.scripts || {};
const easProfiles = easConfig.build || {};

const requiredScripts = [
  "smoke:hwallet-release-candidate",
  "smoke:supabase-readback-drill",
  "smoke:supabase-closeout",
  "smoke:staging-server",
  "smoke:staging-storage-summary",
  "smoke:staging-auth-surface",
  "smoke:mobile-staging-env",
  "smoke:mobile-device-hwallet:live",
  "smoke:mobile-store-readiness",
  "smoke:mobile-release-preflight",
  "smoke:mobile-release-handoff",
  "smoke:mobile-store-submission",
  "smoke:mobile-store-build-evidence",
  "smoke:hwallet-device-evidence",
  "smoke:hwallet-dual-device-evidence",
  "hwallet:device-evidence:init",
  "hwallet:device-evidence:record",
  "mobile:store-build-evidence:init",
  "smoke:hwallet-staging-handoff",
  "smoke:mobile-testflight-readiness",
  "smoke:mobile-hwallet-ux",
  "smoke:privy-wallet-status",
  "verify:merge"
];

for (const scriptName of requiredScripts) {
  assert(typeof scripts[scriptName] === "string", `package script ${scriptName} exists`);
}
assert(
  String(scripts["verify:merge"] || "").includes("smoke:hwallet-release-candidate"),
  "verify:merge includes HWallet release candidate gate"
);
assert(
  String(scripts["verify:merge"] || "").includes("smoke:hwallet-dual-device-evidence"),
  "verify:merge includes dual-device evidence gate"
);
assert(
  String(scripts["verify:merge"] || "").includes("smoke:mobile-release-preflight"),
  "verify:merge includes mobile release preflight gate"
);
assert(
  String(scripts["verify:merge"] || "").includes("smoke:mobile-release-handoff"),
  "verify:merge includes mobile release handoff gate"
);
assert(
  String(scripts["verify:merge"] || "").includes("smoke:mobile-store-submission"),
  "verify:merge includes mobile store submission gate"
);
checks.push("package exposes the HWallet release candidate gate");

for (const scriptName of ["update:preview", "update:production", "build:ios:preview", "build:android:preview", "build:ios", "build:android"]) {
  assert(typeof mobileScripts[scriptName] === "string", `mobile package script ${scriptName} exists`);
}
checks.push("mobile workspace keeps build and OTA commands available");

const releaseCandidate = sectionFrom(releaseChecklist, "HWallet release candidate gate:");
assertOrder(releaseCandidate, "npm run smoke:hwallet-release-candidate", "npm run smoke:supabase-readback-drill", "static gate comes before Supabase drill");
assertOrder(releaseCandidate, "npm run smoke:supabase-readback-drill", "STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-server", "Supabase drill comes before staging server");
assertOrder(releaseCandidate, "smoke:staging-server", "smoke:staging-storage-summary", "staging server comes before storage summary");
assertOrder(releaseCandidate, "smoke:staging-storage-summary", "smoke:staging-auth-surface", "storage summary comes before auth surface");
assertOrder(releaseCandidate, "smoke:staging-auth-surface", "MOBILE_STAGING_READINESS=true", "auth surface comes before mobile staging env");
assertOrder(releaseCandidate, "MOBILE_STAGING_READINESS=true", "MOBILE_DEVICE_API_BASE_URL=https://app.hwallet.vip", "mobile staging env comes before device API smoke");
assertPattern(releaseCandidate, /MOBILE_DEVICE_PRIVY_ACCESS_TOKEN/, "release gate documents primary Privy token");
assertPattern(releaseCandidate, /MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN/, "release gate documents second-user Privy token");
assertIncludes(releaseCandidate, "HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence", "release gate requires real device evidence");
assertIncludes(releaseCandidate, "npm run hwallet:device-evidence:init", "release gate initializes local device evidence");
assertIncludes(releaseChecklist, "docs/HWALLET_MOBILE_RELEASE_HANDOFF.md", "release checklist links mobile release handoff");
assertIncludes(releaseChecklist, "npm run smoke:hwallet-staging-handoff", "release checklist includes staging handoff gate");
assertIncludes(releaseChecklist, "npm run smoke:mobile-release-preflight", "release checklist includes mobile release preflight gate");
assertIncludes(releaseChecklist, "HWALLET_RELEASE_PREFLIGHT_STRICT=true", "release checklist documents strict mobile release preflight");
assertIncludes(releaseChecklist, "npm run smoke:mobile-release-handoff", "release checklist includes mobile release handoff gate");
assertIncludes(releaseChecklist, "HWALLET_RELEASE_HANDOFF_STRICT=true", "release checklist documents strict mobile release handoff");
assertIncludes(releaseChecklist, "npm run smoke:mobile-store-submission", "release checklist includes mobile store submission gate");
assertIncludes(releaseChecklist, "docs/HWALLET_STORE_SUBMISSION_PACKET.md", "release checklist links store submission packet");
assertIncludes(releaseChecklist, "HWALLET_STAGING_HANDOFF_STRICT=true", "release checklist documents strict staging handoff");
assertPattern(releaseCandidate, /do not submit/i, "release gate blocks submission on failed checks");
checks.push("release checklist keeps HWallet candidate checks in safe order");

assertIncludes(stagingDeployment, "npm run smoke:hwallet-release-candidate", "staging deployment runs the release candidate gate");
assertIncludes(stagingDeployment, "npm run smoke:hwallet-staging-handoff", "staging deployment runs the staging handoff gate");
assertIncludes(stagingDeployment, "npm run hwallet:device-evidence:init", "staging deployment initializes local device evidence");
assertIncludes(stagingDeployment, "STAGING_API_BASE_URL=https://YOUR_STAGING_API npm run smoke:staging-auth-surface", "staging deployment keeps auth surface gate");
assertIncludes(stagingDeployment, "Only after these pass", "staging deployment blocks builds before server gates pass");
assertIncludes(easRunbook, "npm run smoke:hwallet-release-candidate", "EAS runbook requires the release candidate gate");
assertIncludes(easRunbook, "npm run smoke:mobile-release-preflight", "EAS runbook requires the mobile release preflight gate");
assertIncludes(easRunbook, "npm run hwallet:device-evidence:init", "EAS runbook initializes local device evidence");
assertIncludes(easRunbook, "STAGING_API_BASE_URL=https://app.hwallet.vip npm run smoke:staging-auth-surface", "EAS runbook checks staging auth surface before OTA");
assertIncludes(deviceQa, "HWallet release candidate gate", "device QA references the release candidate gate");
assertIncludes(deviceQa, "npm run hwallet:device-evidence:init", "device QA initializes an ignored evidence file");
assertIncludes(deviceQa, "npm run hwallet:device-evidence:record", "device QA documents the evidence recorder");
assertIncludes(deviceQa, "npm run smoke:hwallet-dual-device-evidence", "device QA validates dual-platform evidence");
assertIncludes(deviceQa, "HWALLET_IOS_DEVICE_EVIDENCE_FILE", "device QA names the iOS evidence file env");
assertIncludes(deviceQa, "HWALLET_ANDROID_DEVICE_EVIDENCE_FILE", "device QA names the Android evidence file env");
assertIncludes(deviceQa, "MOBILE_DEVICE_PRIVY_ACCESS_TOKEN", "device QA names the primary device token env");
assertIncludes(deviceQa, "MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN", "device QA names the second-user device token env");
assertIncludes(deviceQa, "HWALLET_DEVICE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-device-evidence", "device QA validates redacted evidence file");
checks.push("release, staging, EAS, and device docs share the same HWallet candidate gate");

assertIncludes(stagingServerSmoke, "server HWallet store is postgres-only", "staging server smoke verifies postgres-only storage");
assertIncludes(stagingServerSmoke, "Privy access token is required", "staging server smoke verifies Privy token enforcement");
assertIncludes(stagingServerSmoke, "Agent real execution is closed", "staging server smoke verifies Agent execution is closed");
assertIncludes(stagingServerSmoke, "protected mobile wallet API rejects missing Privy token", "staging server smoke probes protected wallet API");
assertIncludes(stagingAuthSmoke, "protectedEndpoints", "staging auth smoke summarizes protected endpoint count");
assertIncludes(stagingAuthSmoke, 'expectUnauthorized("POST wallet tx verify"', "staging auth smoke protects tx verification");
assertIncludes(stagingAuthSmoke, 'expectUnauthorized("POST phase-one action"', "staging auth smoke protects Agent actions");
checks.push("staging live smokes protect storage, auth, and execution boundaries");

assertIncludes(mobileDeviceSmoke, "MOBILE_DEVICE_PRIVY_ACCESS_TOKEN", "device smoke supports authenticated User A path");
assertIncludes(mobileDeviceSmoke, "MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN", "device smoke supports authenticated User B path");
assertIncludes(mobileDeviceSmoke, "other user HWallet address is not first user address", "device smoke verifies distinct user addresses");
assertIncludes(mobileDeviceSmoke, "other user memory cannot see verified tx", "device smoke verifies memory isolation");
assertIncludes(mobileDeviceSmoke, "other user audit cannot see verified tx", "device smoke verifies audit isolation");
assertIncludes(mobileDeviceSmoke, "liveExecutionEnabled", "device smoke reports live execution state");
checks.push("device live smoke covers multi-user wallet, memory, audit, and execution state");

const evidence = JSON.parse(deviceEvidenceExample);
assert(evidence.kind === "hwallet-device-multi-user-evidence", "device evidence example has expected kind");
assert(evidence.checks?.appOpensWithoutCrash === true, "device evidence example covers no-crash launch");
assert(evidence.checks?.addressesAreDistinct === true, "device evidence example covers distinct addresses");
assert(evidence.checks?.copyFeedbackVisible === true, "device evidence example covers copy feedback");
assert(evidence.checks?.signedOutHidesWalletAddress === true, "device evidence example covers signed-out clearing");
assert(evidence.checks?.liveExecutionClosed === true, "device evidence example covers closed live execution");
assert(
  evidence.flow?.map((item) => item.step).join(">").includes("user-a-hwallet-ready>copy-feedback>switch-to-user-b"),
  "device evidence example captures ordered A to B flow"
);
assert(
  evidence.flow?.some((item) => item.step === "switch-back-user-a" && item.observed === true),
  "device evidence example captures switch-back flow"
);
assert(evidence.confirmations?.observedOnPhysicalDevice === true, "device evidence example covers physical-device confirmation");
assert(evidence.confirmations?.containsNoSecrets === true, "device evidence example covers no-secret confirmation");
checks.push("device evidence example covers the installed-App multi-user release proof");

assertIncludes(deviceEvidenceInit, ".tmp/hwallet-device-evidence.json", "device evidence initializer writes to ignored .tmp path");
assertIncludes(deviceEvidenceInit, "git\", [\"check-ignore\"", "device evidence initializer verifies git ignore coverage");
assertIncludes(deviceEvidenceInit, "observedOnPhysicalDevice: false", "device evidence initializer requires manual physical-device confirmation");
assertIncludes(deviceEvidenceInit, "observed: false", "device evidence initializer requires ordered flow observations");
checks.push("device evidence initializer creates an ignored local file that cannot pass strict mode untouched");

assertIncludes(deviceEvidenceRecord, "HWALLET_DEVICE_EVIDENCE_CONFIRM_ALL", "device evidence recorder requires explicit owner confirmation");
assertIncludes(deviceEvidenceRecord, "HWALLET_DEVICE_USER_A_SHORT_ADDRESS", "device evidence recorder requires User A address");
assertIncludes(deviceEvidenceRecord, "HWALLET_DEVICE_USER_B_SHORT_ADDRESS", "device evidence recorder requires User B address");
assertIncludes(deviceEvidenceRecord, ".tmp/hwallet-device-evidence.json", "device evidence recorder writes to ignored .tmp path");
assertIncludes(deviceEvidenceRecord, "git\", [\"check-ignore\"", "device evidence recorder verifies git ignore coverage");
assertIncludes(deviceEvidenceRecord, "normalizeAddress", "device evidence recorder normalizes redacted addresses");
assertIncludes(deviceEvidenceRecord, "assertNoRawSecrets", "device evidence recorder scans for raw secrets");
checks.push("device evidence recorder converts owner observations into strict local evidence");

assertIncludes(dualDeviceEvidenceSmoke, "HWALLET_DUAL_DEVICE_EVIDENCE_REQUIRED", "dual-device evidence smoke has strict mode");
assertIncludes(dualDeviceEvidenceSmoke, "HWALLET_IOS_DEVICE_EVIDENCE_FILE", "dual-device evidence smoke requires iOS evidence file");
assertIncludes(dualDeviceEvidenceSmoke, "HWALLET_ANDROID_DEVICE_EVIDENCE_FILE", "dual-device evidence smoke requires Android evidence file");
assertIncludes(dualDeviceEvidenceSmoke, "smoke-hwallet-device-evidence.mjs", "dual-device evidence smoke reuses strict single-device smoke");
assertIncludes(dualDeviceEvidenceSmoke, "iOS evidence records ios platform", "dual-device evidence smoke verifies iOS platform");
assertIncludes(dualDeviceEvidenceSmoke, "Android evidence records android platform", "dual-device evidence smoke verifies Android platform");
assertIncludes(dualDeviceEvidenceSmoke, "assertGitIgnored", "dual-device evidence smoke keeps local evidence ignored");
checks.push("dual-device evidence smoke blocks external testers until iOS and Android evidence pass together");

assertIncludes(mobileReleasePreflightSmoke, "HWALLET_RELEASE_PREFLIGHT_STRICT", "mobile release preflight has strict mode");
assertIncludes(mobileReleasePreflightSmoke, "HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE", "mobile release preflight requires store-build evidence in strict mode");
assertIncludes(mobileReleasePreflightSmoke, "HWALLET_IOS_DEVICE_EVIDENCE_FILE", "mobile release preflight requires iOS device evidence in strict mode");
assertIncludes(mobileReleasePreflightSmoke, "HWALLET_ANDROID_DEVICE_EVIDENCE_FILE", "mobile release preflight requires Android device evidence in strict mode");
assertIncludes(mobileReleasePreflightSmoke, "smoke:mobile-store-readiness", "mobile release preflight runs store readiness");
assertIncludes(mobileReleasePreflightSmoke, "smoke:mobile-distribution-readiness", "mobile release preflight runs distribution readiness");
assertIncludes(mobileReleasePreflightSmoke, "smoke:hwallet-release-candidate", "mobile release preflight runs HWallet release candidate");
assertIncludes(mobileReleasePreflightSmoke, "smoke:mobile-store-build-evidence", "mobile release preflight runs store-build evidence");
assertIncludes(mobileReleasePreflightSmoke, "smoke:hwallet-dual-device-evidence", "mobile release preflight runs dual-device evidence");
checks.push("mobile release preflight aggregates store, distribution, release, build, and dual-device gates");

assertIncludes(mobileReleaseHandoffSmoke, "HWALLET_RELEASE_HANDOFF_STRICT", "mobile release handoff has strict mode");
assertIncludes(mobileReleaseHandoffSmoke, "HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE", "mobile release handoff requires store-build evidence in strict mode");
assertIncludes(mobileReleaseHandoffSmoke, "HWALLET_IOS_DEVICE_EVIDENCE_FILE", "mobile release handoff requires iOS device evidence in strict mode");
assertIncludes(mobileReleaseHandoffSmoke, "HWALLET_ANDROID_DEVICE_EVIDENCE_FILE", "mobile release handoff requires Android device evidence in strict mode");
assertIncludes(mobileReleaseHandoffSmoke, "smoke:mobile-release-preflight", "mobile release handoff runs strict release preflight");
assertIncludes(mobileReleaseHandoffSmoke, "assertGitIgnored", "mobile release handoff keeps local evidence ignored");
checks.push("mobile release handoff verifies docs, build evidence, dual-device evidence, and strict preflight together");

assertIncludes(mobileStoreSubmissionSmoke, "Privacy Policy", "mobile store submission smoke checks privacy page");
assertIncludes(mobileStoreSubmissionSmoke, "Support", "mobile store submission smoke checks support page");
assertIncludes(mobileStoreSubmissionSmoke, "App Store Connect Baseline", "mobile store submission smoke checks App Store baseline");
assertIncludes(mobileStoreSubmissionSmoke, "Google Play Console Baseline", "mobile store submission smoke checks Google Play baseline");
assertIncludes(storeSubmissionPacket, "Product: HWallet", "store submission packet names HWallet");
assertIncludes(storeSubmissionPacket, "https://app.hwallet.vip/privacy", "store submission packet records privacy URL");
assertIncludes(storeSubmissionPacket, "https://app.hwallet.vip/support", "store submission packet records support URL");
assertIncludes(privacyPage, "Private keys or seed phrases", "privacy page records private-key boundary");
assertIncludes(supportPage, "does not submit live orders", "support page records no-live-order boundary");
checks.push("mobile store submission packet, public legal pages, and review boundaries are part of the release candidate");

assertIncludes(
  stagingHandoffSmoke,
  "const requireRealDeviceEvidence = strict || evidenceFile.length > 0",
  "staging handoff requires real evidence when an evidence file is supplied"
);
assertIncludes(
  stagingHandoffSmoke,
  "suppliedDeviceEvidenceMustBeReal: true",
  "staging handoff summary reports supplied evidence strictness"
);
checks.push("staging handoff cannot treat a supplied device evidence file as an example template");

assertIncludes(mobileTestflightSmoke, "root scripts expose and run the iOS and Android mobile store readiness gate", "mobile store smoke exposes iOS/Android gate");
assertIncludes(mobileTestflightSmoke, "mobile store build evidence covers iOS and Android build artifacts", "mobile store smoke covers iOS/Android build evidence");
assertIncludes(mobileTestflightSmoke, "device QA covers multi-user, signed-out, copy, HWallet live-smoke, and evidence gates", "mobile store smoke includes device QA boundary");
assertIncludes(mobileTestflightSmoke, "API URL is public HTTPS", "mobile store smoke checks public HTTPS API URLs");
assertIncludes(supabaseReadbackSmoke, "release drill mentions other-user isolation", "Supabase readback smoke enforces other-user isolation docs");
checks.push("existing release smokes are chained into the HWallet candidate gate");

assertIncludes(mobileReleaseHandoff, "HWallet wallet entry plus Agent experience", "mobile release handoff names the product body");
assertIncludes(mobileReleaseHandoff, "https://app.hwallet.vip", "mobile release handoff records staging API");
assertIncludes(mobileReleaseHandoff, "preview build source commit", "mobile release handoff labels the build source commit");
assertIncludes(mobileReleaseHandoff, "253ef6830dc894137701d0ee35aef3340b09a57d", "mobile release handoff records preview build source commit");
assertIncludes(mobileReleaseHandoff, "e4603d5d-2123-4502-94f9-3e9035ba3c9e", "mobile release handoff records current iOS preview build");
assertIncludes(mobileReleaseHandoff, "ab124aea-fbe7-47e1-aea8-b69ceddae248", "mobile release handoff records current Android preview build");
assertIncludes(mobileReleaseHandoff, "MOBILE_DEVICE_API_BASE_URL=https://app.hwallet.vip npm run smoke:mobile-device-hwallet:live", "mobile release handoff records staging device auth boundary smoke");
assertIncludes(mobileReleaseHandoff, "HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED=true", "mobile release handoff records strict store-build evidence smoke");
assertIncludes(mobileReleaseHandoff, "HWALLET_RELEASE_HANDOFF_STRICT=true", "mobile release handoff records strict release handoff smoke");
assertIncludes(mobileReleaseHandoff, ".tmp/hwallet-device-evidence-ios.json", "mobile release handoff records iOS device evidence file");
assertIncludes(mobileReleaseHandoff, ".tmp/hwallet-device-evidence-android.json", "mobile release handoff records Android device evidence file");
assertIncludes(mobileReleaseHandoff, "docs/HWALLET_DEVICE_MULTI_USER_QA.md", "mobile release handoff points to device multi-user QA");
assertIncludes(mobileReleaseHandoff, "User B has a different receive address", "mobile release handoff requires distinct user addresses");
assertIncludes(mobileReleaseHandoff, "Sign out and confirm no stale receive address", "mobile release handoff requires signed-out clearing");
assertIncludes(mobileReleaseHandoff, "real execution closed", "mobile release handoff keeps live execution closed");
assertPattern(mobileReleaseHandoff, /Do not|must not/i, "mobile release handoff includes no-secret handling guidance");
checks.push("mobile release handoff captures current dual-platform build and device-test requirements");

for (const profileName of ["development-staging", "preview", "production"]) {
  const profile = easProfiles[profileName];
  assert(Boolean(profile), `EAS ${profileName} profile exists`);
  assert(profile.env?.EXPO_PUBLIC_API_BASE_URL === "https://app.hwallet.vip", `EAS ${profileName} points at staging HTTPS API`);
  assert(profile.env?.EXPO_PUBLIC_AGENT_WALLET_V2_UI === "true", `EAS ${profileName} ships V2 HWallet UI`);
  assert(profile.env?.EXPO_PUBLIC_AGENT_WALLET_PREVIEW !== "true", `EAS ${profileName} does not ship preview-only UI`);
}
checks.push("EAS profiles point installed builds at the HWallet staging API");

assertNoRawSecrets({
  "docs/V2_RELEASE_CHECKLIST.md": releaseChecklist,
  "docs/HWALLET_MOBILE_RELEASE_HANDOFF.md": mobileReleaseHandoff,
  "docs/STAGING_SERVER_DEPLOYMENT.md": stagingDeployment,
  "docs/HWALLET_DEVICE_MULTI_USER_QA.md": deviceQa,
  "docs/HWALLET_EAS_UPDATE_RUNBOOK.md": easRunbook,
  "docs/HWALLET_DEVICE_EVIDENCE.example.json": deviceEvidenceExample,
  "v2/scripts/init-hwallet-device-evidence.mjs": deviceEvidenceInit,
  "v2/scripts/record-hwallet-device-evidence.mjs": deviceEvidenceRecord,
  "v2/scripts/smoke-hwallet-dual-device-evidence.mjs": dualDeviceEvidenceSmoke,
  "v2/scripts/smoke-mobile-release-preflight.mjs": mobileReleasePreflightSmoke,
  "v2/scripts/smoke-mobile-release-handoff.mjs": mobileReleaseHandoffSmoke,
  "v2/scripts/smoke-mobile-store-submission.mjs": mobileStoreSubmissionSmoke,
  "docs/HWALLET_STORE_SUBMISSION_PACKET.md": storeSubmissionPacket,
  "app/privacy/page.tsx": privacyPage,
  "app/support/page.tsx": supportPage,
  "apps/mobile/eas.json": JSON.stringify(easConfig, null, 2)
});
checks.push("HWallet release candidate docs avoid raw secret material");

console.log(JSON.stringify({
  ok: true,
  checks,
  releaseCandidate: {
    stagingApi: "https://app.hwallet.vip",
    requiresPrivyAuth: true,
    requiresTwoUserDeviceSmoke: true,
    liveExecutionClosed: true
  }
}, null, 2));

function sectionFrom(text, marker) {
  const start = text.indexOf(marker);
  assert(start !== -1, `${marker} section exists`);
  const nextHeading = text.indexOf("\n## ", start + marker.length);
  return nextHeading === -1 ? text.slice(start) : text.slice(start, nextHeading);
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), label);
}

function assertPattern(text, pattern, label) {
  assert(pattern.test(text), label);
}

function assertOrder(text, first, second, label) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  assert(firstIndex !== -1 && secondIndex !== -1 && firstIndex < secondIndex, label);
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
        throw new Error(`HWallet release candidate smoke failed: ${file} must not contain raw secret material`);
      }
    }
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(`HWallet release candidate smoke failed: ${label}`);
  checks.push(label);
}
