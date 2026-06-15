import { readFile } from "node:fs/promises";

await loadLocalEnv();

const mode = process.env.MOBILE_STAGING_READINESS === "true"
  ? "staging"
  : process.env.MOBILE_DEVICE_READINESS === "true"
    ? "device"
    : "local";

const checks = [];
const warnings = [];

const mobilePackage = await readJson("apps/mobile/package.json");
const appConfig = await readJson("apps/mobile/app.json");
const easConfig = await readJson("apps/mobile/eas.json");

const expoConfig = appConfig.expo || {};
const easProjectId = expoConfig.extra?.eas?.projectId;
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "";
const parsedApiBaseUrl = parseUrl(apiBaseUrl);
const apiBaseKind = classifyApiBaseUrl(parsedApiBaseUrl);
const privyAppConfigured = Boolean(process.env.EXPO_PUBLIC_PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID);
const privyClientConfigured = Boolean(process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID);

check(Boolean(mobilePackage.dependencies?.expo), "Expo dependency is configured");
check(String(mobilePackage.dependencies?.expo || "").includes("56."), "Expo SDK 56 dependency is pinned");
check(Boolean(mobilePackage.dependencies?.["expo-updates"]), "Expo Updates dependency is configured");
check(Boolean(mobilePackage.devDependencies?.["eas-cli"] || mobilePackage.dependencies?.["eas-cli"]), "EAS CLI package is configured");
check(scriptTargetsChannel(mobilePackage.scripts?.["update:preview"], "preview"), "EAS preview update script is configured");
check(scriptTargetsChannel(mobilePackage.scripts?.["update:production"], "production"), "EAS production update script is configured");
check(expoConfig.orientation === "portrait", "mobile app is locked to portrait orientation");
check(Boolean(expoConfig.scheme), "mobile deep-link scheme is configured");
check(Boolean(expoConfig.ios?.bundleIdentifier), "iOS bundle identifier is configured");
check(Boolean(expoConfig.android?.package), "Android package name is configured");
check(isExpoUpdatesUrl(expoConfig.updates?.url, easProjectId), "EAS Update URL is configured");
check(expoConfig.runtimeVersion?.policy === "appVersion", "EAS Update runtime version uses app version policy");
check(Boolean(easConfig.build?.development), "EAS development profile exists");
check(Boolean(easConfig.build?.["development-staging"]), "EAS staging development profile exists");
check(Boolean(easConfig.build?.preview), "EAS preview profile exists");
check(Boolean(easConfig.build?.production), "EAS production profile exists");
check(easConfig.build?.development?.channel === "development", "EAS development update channel is configured");
check(easConfig.build?.["development-staging"]?.channel === "development-staging", "EAS staging development update channel is configured");
check(easConfig.build?.preview?.channel === "preview", "EAS preview update channel is configured");
check(easConfig.build?.production?.channel === "production", "EAS production update channel is configured");
check(Boolean(easConfig.build?.development?.env?.EXPO_PUBLIC_API_BASE_URL), "EAS development API base URL is configured");
check(Boolean(easConfig.build?.["development-staging"]?.env?.EXPO_PUBLIC_API_BASE_URL), "EAS staging development API base URL is configured");
check(Boolean(easConfig.build?.preview?.env?.EXPO_PUBLIC_API_BASE_URL), "EAS preview API base URL is configured");
check(Boolean(easConfig.build?.production?.env?.EXPO_PUBLIC_API_BASE_URL), "EAS production API base URL is configured");
check(easConfig.build?.["development-staging"]?.env?.EXPO_PUBLIC_AGENT_WALLET_V2_UI === "true", "EAS staging development uses V2 mobile UI");
check(easConfig.build?.preview?.env?.EXPO_PUBLIC_AGENT_WALLET_V2_UI === "true", "EAS preview uses V2 mobile UI");
check(easConfig.build?.preview?.env?.EXPO_PUBLIC_AGENT_WALLET_PREVIEW === "true", "EAS preview uses human visual preview UI");
check(easConfig.build?.production?.env?.EXPO_PUBLIC_AGENT_WALLET_V2_UI === "true", "EAS production uses V2 mobile UI");
check(process.env.AGENT_WALLET_REAL_EXECUTION !== "true", "Agent real execution switch is closed");
check(process.env.ONCHAINOS_LIVE_MODE !== "true", "Onchain OS live mode is closed");
check(process.env.POLYMARKET_LIVE_MODE !== "true", "prediction trading live mode is closed");
check(process.env.POLYMARKET_TRADING_API_ENABLED !== "true", "public trading API execution is closed");

if (!apiBaseUrl) {
  warnings.push("EXPO_PUBLIC_API_BASE_URL is not set; Expo falls back to localhost for local development.");
} else {
  check(Boolean(parsedApiBaseUrl), "mobile API base URL is a valid URL");
}

if (!privyAppConfigured) warnings.push("Privy public app id is not configured for native login.");
if (!privyClientConfigured) warnings.push("Privy mobile client id is not configured for native login.");
if (isPlaceholderEasProject(easProjectId)) warnings.push("EAS project id is still a placeholder; run eas init before store builds.");
if (usesExampleApi(easConfig.build?.preview?.env?.EXPO_PUBLIC_API_BASE_URL)) warnings.push("EAS preview API URL still points to the example domain.");
if (usesExampleApi(easConfig.build?.production?.env?.EXPO_PUBLIC_API_BASE_URL)) warnings.push("EAS production API URL still points to the example domain.");
if (usesExampleApi(easConfig.build?.["development-staging"]?.env?.EXPO_PUBLIC_API_BASE_URL)) {
  warnings.push("EAS staging development API URL still points to the example domain.");
}

if (mode === "device") {
  check(Boolean(apiBaseUrl), "physical-device API base URL is configured");
  check(Boolean(parsedApiBaseUrl), "physical-device API base URL is valid");
  check(apiBaseKind !== "localhost", "physical-device API base URL is not localhost");
  check(privyAppConfigured, "Privy public app id is configured for native login");
  check(privyClientConfigured, "Privy mobile client id is configured for native login");
} else if (mode === "staging") {
  check(Boolean(apiBaseUrl), "staging mobile API base URL is configured");
  check(Boolean(parsedApiBaseUrl), "staging mobile API base URL is valid");
  check(parsedApiBaseUrl.protocol === "https:", "staging mobile API base URL uses HTTPS");
  check(apiBaseKind === "https", "staging mobile API base URL is public HTTPS");
  check(privyAppConfigured, "Privy public app id is configured for native login");
  check(privyClientConfigured, "Privy mobile client id is configured for native login");
  check(!isPlaceholderEasProject(easProjectId), "EAS project id is initialized");
  check(isHttpsPublicApi(easConfig.build?.["development-staging"]?.env?.EXPO_PUBLIC_API_BASE_URL), "EAS staging development API URL is public HTTPS");
  check(!usesExampleApi(easConfig.build?.preview?.env?.EXPO_PUBLIC_API_BASE_URL), "EAS preview API URL is not the example domain");
  check(!usesExampleApi(easConfig.build?.production?.env?.EXPO_PUBLIC_API_BASE_URL), "EAS production API URL is not the example domain");
}

console.log(JSON.stringify({
  ok: true,
  mode,
  checks,
  warnings,
  mobile: {
    expoSdk: mobilePackage.dependencies?.expo || null,
    schemeConfigured: Boolean(expoConfig.scheme),
    iosBundleConfigured: Boolean(expoConfig.ios?.bundleIdentifier),
    androidPackageConfigured: Boolean(expoConfig.android?.package),
    easProjectConfigured: !isPlaceholderEasProject(easProjectId)
  },
  env: {
    apiBaseConfigured: Boolean(apiBaseUrl),
    apiBaseKind,
    privyAppConfigured,
    privyClientConfigured
  },
  gates: {
    canBroadcastTransactions: false,
    onchainLiveMode: process.env.ONCHAINOS_LIVE_MODE === "true",
    predictionTradingLiveMode: process.env.POLYMARKET_LIVE_MODE === "true",
    realExecution: process.env.AGENT_WALLET_REAL_EXECUTION === "true"
  }
}, null, 2));

function check(condition, label) {
  if (!condition) throw new Error(`Mobile build env smoke failed: ${label}`);
  checks.push(label);
}

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
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

function isExpoUpdatesUrl(value, projectId) {
  if (!value || isPlaceholderEasProject(projectId)) return false;
  return value === `https://u.expo.dev/${projectId}`;
}

function scriptTargetsChannel(value, channel) {
  return typeof value === "string"
    && value.includes("eas update")
    && value.includes(`--channel ${channel}`)
    && value.includes("--environment");
}

function usesExampleApi(value) {
  return !value || /api\.example\.com/i.test(value);
}

function isHttpsPublicApi(value) {
  const url = parseUrl(value || "");
  return url?.protocol === "https:" && classifyApiBaseUrl(url) === "https";
}

async function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const raw = await readFile(file, "utf8").catch(() => "");
    if (!raw) continue;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
