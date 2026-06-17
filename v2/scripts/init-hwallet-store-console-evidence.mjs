import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const sourcePath = "docs/HWALLET_STORE_CONSOLE_EVIDENCE.example.json";
const outputPath =
  process.env.HWALLET_STORE_CONSOLE_EVIDENCE_FILE ||
  ".tmp/hwallet-store-console-evidence.json";
const force = process.env.HWALLET_STORE_CONSOLE_EVIDENCE_INIT_FORCE === "true";
const source = JSON.parse(await readFile(sourcePath, "utf8"));
const mobileApp = JSON.parse(await readFile("apps/mobile/app.json", "utf8")).expo || {};

if (!force && await exists(outputPath)) {
  assertGitIgnored(outputPath);
  console.log(JSON.stringify({
    ok: true,
    created: false,
    outputPath,
    note: "Existing ignored store console evidence file left untouched.",
    nextSteps: nextSteps(outputPath)
  }, null, 2));
  process.exit(0);
}

const initialized = {
  ...source,
  environment: {
    ...source.environment,
    appVersion: mobileApp.version || source.environment.appVersion,
    iosBundleIdentifier: mobileApp.ios?.bundleIdentifier || source.environment.iosBundleIdentifier,
    androidPackage: mobileApp.android?.package || source.environment.androidPackage,
    apiBaseUrl: "https://app.hwallet.vip",
    releaseTrack: "internal"
  },
  operator: {
    label: "fill-release-operator-label",
    recordedAt: new Date().toISOString()
  },
  ios: resetIos(source.ios, mobileApp),
  android: resetAndroid(source.android, mobileApp),
  checks: Object.fromEntries(Object.keys(source.checks).map((key) => [key, false])),
  confirmations: Object.fromEntries(Object.keys(source.confirmations).map((key) => [key, false])),
  artifacts: [
    {
      label: "fill-ios-testflight-redacted",
      redacted: true
    },
    {
      label: "fill-android-internal-testing-redacted",
      redacted: true
    }
  ],
  notes:
    "Fill this ignored local file only after App Store Connect and Google Play Console actions are done. " +
    "Keep redacted page labels, build ids, status observations, and owner confirmations only. " +
    "Do not paste Apple credentials, Google Play service-account JSON, access tokens, private keys, API keys, database URLs, verification codes, or unredacted personal data."
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

function resetIos(ios, mobileApp) {
  return {
    ...ios,
    status: "pending",
    buildId: "fill-ios-eas-build-id",
    buildNumber: mobileApp.ios?.buildNumber || "fill-ios-build-number",
    appRecordLabel: "fill-app-store-connect-app-redacted",
    testflight: Object.fromEntries(Object.keys(ios.testflight).map((key) => [key, false])),
    metadata: Object.fromEntries(Object.keys(ios.metadata).map((key) => [key, false]))
  };
}

function resetAndroid(android, mobileApp) {
  return {
    ...android,
    status: "pending",
    buildId: "fill-android-eas-build-id",
    versionCode: mobileApp.android?.versionCode || "fill-android-version-code",
    appRecordLabel: "fill-google-play-app-redacted",
    internalTesting: Object.fromEntries(Object.keys(android.internalTesting).map((key) => [key, false])),
    metadata: Object.fromEntries(Object.keys(android.metadata).map((key) => [key, false]))
  };
}

function assertGitIgnored(path) {
  const ignoreCheck = spawnSync("git", ["check-ignore", "-q", path], {
    cwd: process.cwd(),
    stdio: "ignore"
  });

  if (ignoreCheck.status !== 0) {
    throw new Error(`${path} is not ignored by git. Add it to .gitignore before using real store console evidence.`);
  }
}

function nextSteps(path) {
  return [
    "Complete App Store Connect and Google Play Console internal testing setup.",
    `Record redacted console observations in ${path}.`,
    `HWALLET_STORE_CONSOLE_EVIDENCE_FILE=${path} HWALLET_STORE_CONSOLE_EVIDENCE_REQUIRED=true npm run smoke:hwallet-store-console-evidence`
  ];
}
