import { spawnSync } from "node:child_process";

const stagingApi =
  process.env.HWALLET_STAGING_API_BASE_URL ||
  process.env.STAGING_API_BASE_URL ||
  "https://app.hwallet.vip";
const strict = process.env.HWALLET_STAGING_HANDOFF_STRICT === "true";
const evidenceFile = process.env.HWALLET_DEVICE_EVIDENCE_FILE || "";
const requireRealDeviceEvidence = strict || evidenceFile.length > 0;
const hasUserAToken = Boolean(process.env.MOBILE_DEVICE_PRIVY_ACCESS_TOKEN || process.env.PRIVY_ACCESS_TOKEN);
const hasUserBToken = Boolean(process.env.MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN || process.env.OTHER_PRIVY_ACCESS_TOKEN);
const steps = [];

assertValidStagingApi(stagingApi);

if (strict) {
  assert(evidenceFile.length > 0, "strict handoff requires HWALLET_DEVICE_EVIDENCE_FILE");
  assert(hasUserAToken, "strict handoff requires MOBILE_DEVICE_PRIVY_ACCESS_TOKEN");
  assert(hasUserBToken, "strict handoff requires MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN");
}

runStep("static HWallet release candidate gate", "npm", ["run", "smoke:hwallet-release-candidate"]);
runStep("staging server readiness", "npm", ["run", "smoke:staging-server"], {
  STAGING_API_BASE_URL: stagingApi
});
runStep("staging storage summary", "npm", ["run", "smoke:staging-storage-summary"], {
  STAGING_API_BASE_URL: stagingApi
});
runStep("staging auth surface", "npm", ["run", "smoke:staging-auth-surface"], {
  STAGING_API_BASE_URL: stagingApi
});
runStep("mobile staging build env", "npm", ["run", "smoke:mobile-build-env"], {
  MOBILE_STAGING_READINESS: "true",
  EXPO_PUBLIC_API_BASE_URL: stagingApi
});
runStep("device-facing HWallet API smoke", "npm", ["run", "smoke:mobile-device-hwallet:live"], {
  MOBILE_DEVICE_API_BASE_URL: stagingApi
});
runStep("redacted device evidence smoke", "npm", ["run", "smoke:hwallet-device-evidence"], {
  ...(evidenceFile ? { HWALLET_DEVICE_EVIDENCE_FILE: evidenceFile } : {}),
  ...(requireRealDeviceEvidence ? { HWALLET_DEVICE_EVIDENCE_REQUIRED: "true" } : {})
});

console.log(JSON.stringify({
  ok: true,
  mode: strict ? "strict" : "standard",
  stagingApi,
  steps,
  summary: {
    authRequired: true,
    twoUserDeviceSmokeRequiredForStrict: true,
    deviceEvidenceRequiredForStrict: true,
    suppliedDeviceEvidenceMustBeReal: true,
    liveExecutionClosed: true
  }
}, null, 2));

function runStep(label, command, args, env = {}) {
  steps.push(label);
  console.log(`\n[hwallet-staging-handoff] ${label}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env
    },
    encoding: "utf8"
  });

  if (result.stdout) process.stdout.write(redact(result.stdout));
  if (result.stderr) process.stderr.write(redact(result.stderr));
  if (result.status !== 0) {
    throw new Error(`HWallet staging handoff failed at step: ${label}`);
  }
}

function assertValidStagingApi(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("HWallet staging handoff failed: staging API URL is invalid");
  }
  assert(url.protocol === "https:" || url.hostname.startsWith("10.") || url.hostname.startsWith("192.168."), "staging API is HTTPS or local LAN");
  if (strict) assert(url.protocol === "https:", "strict handoff requires HTTPS staging API");
}

function redact(text) {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/MOBILE_DEVICE_PRIVY_ACCESS_TOKEN=([^ \n]+)/g, "MOBILE_DEVICE_PRIVY_ACCESS_TOKEN=[redacted]")
    .replace(/MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN=([^ \n]+)/g, "MOBILE_DEVICE_OTHER_PRIVY_ACCESS_TOKEN=[redacted]")
    .replace(/PRIVY_ACCESS_TOKEN=([^ \n]+)/g, "PRIVY_ACCESS_TOKEN=[redacted]")
    .replace(/OTHER_PRIVY_ACCESS_TOKEN=([^ \n]+)/g, "OTHER_PRIVY_ACCESS_TOKEN=[redacted]")
    .replace(/gho_[A-Za-z0-9_]+/g, "gho_[redacted]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "sk-[redacted]")
    .replace(/privy_[A-Za-z0-9_-]{20,}/g, "privy_[redacted]")
    .replace(/postgres(?:ql)?:\/\/(?!\.\.\.|[^:\s]+:<password>|[^:\s]+:\.\.\.)[^@\s]+@/gi, "postgres://[redacted]@");
}

function assert(condition, label) {
  if (!condition) throw new Error(`HWallet staging handoff failed: ${label}`);
}
