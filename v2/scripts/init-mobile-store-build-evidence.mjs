import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = "docs/HWALLET_MOBILE_STORE_BUILD_EVIDENCE.example.json";
const outputPath = process.env.HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE || ".tmp/hwallet-mobile-store-build-evidence.json";
const force = process.env.HWALLET_MOBILE_STORE_BUILD_EVIDENCE_INIT_FORCE === "true";
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const mobileApp = JSON.parse(await readFile("apps/mobile/app.json", "utf8")).expo || {};

if (!force && await exists(outputPath)) {
  assertGitIgnored(outputPath);
  console.log(JSON.stringify({
    ok: true,
    created: false,
    outputPath,
    note: "Existing ignored mobile store build evidence file left untouched.",
    nextSteps: nextSteps(outputPath)
  }, null, 2));
  process.exit(0);
}

const initialized = {
  ...source,
  environment: {
    ...source.environment,
    appVersion: mobileApp.version || "fill-app-version",
    iosBuildNumber: mobileApp.ios?.buildNumber || "fill-ios-build-number",
    androidVersionCode: mobileApp.android?.versionCode || "fill-android-version-code",
    apiBaseUrl: "https://app.hwallet.vip",
    buildChannel: "preview",
    publicAppName: mobileApp.name || "海豚社区",
    internalWalletModule: "HWallet",
    iconSource: "owner-approved-haitun-logo"
  },
  tester: {
    label: "fill-release-operator-label",
    recordedAt: new Date().toISOString()
  },
  builds: {
    ios: resetBuild(source.builds.ios),
    android: resetBuild(source.builds.android)
  },
  checks: Object.fromEntries(Object.keys(source.checks).map((key) => [key, false])),
  confirmations: Object.fromEntries(Object.keys(source.confirmations).map((key) => [key, false])),
  artifacts: [
    {
      label: "fill-ios-eas-build-page-redacted",
      redacted: true
    },
    {
      label: "fill-android-eas-build-page-redacted",
      redacted: true
    }
  ],
  notes:
    "Fill this ignored local file after iOS and Android EAS builds are complete. " +
    "Keep only build ids, build URLs, redacted artifact labels, and release observations. " +
    "Do not paste Apple credentials, Google Play keys, access tokens, private keys, API keys, verification codes, or database URLs."
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(initialized, null, 2)}\n`, "utf8");

assertGitIgnored(outputPath);

console.log(JSON.stringify({
  ok: true,
  created: true,
  outputPath,
  nextSteps: nextSteps(outputPath)
}, null, 2));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function resetBuild(build) {
  return {
    ...build,
    buildId: "fill-eas-build-id",
    buildUrl: "https://expo.dev/accounts/hongchen888/projects/agent-wallet-xlayer-mvp/builds/fill-eas-build-id",
    status: "fill-status",
    installOrSubmit: "fill-install-or-submit-status"
  };
}

function assertGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  if (ignoreCheck.status !== 0) {
    throw new Error(`${path} is not ignored by git. Add it to .gitignore before using real build evidence.`);
  }
}

function nextSteps(path) {
  return [
    "Run iOS and Android EAS preview or production builds.",
    `Fill ${path} with the two EAS build ids/URLs and redacted artifact labels.`,
    `HWALLET_MOBILE_STORE_BUILD_EVIDENCE_FILE=${path} HWALLET_MOBILE_STORE_BUILD_EVIDENCE_REQUIRED=true npm run smoke:mobile-store-build-evidence`
  ];
}
