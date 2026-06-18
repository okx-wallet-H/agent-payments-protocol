import { readFile } from "node:fs/promises";

const screen = await readFile("apps/mobile/src/V2AgentWalletScreen.tsx", "utf8");
const preview = await readFile("apps/mobile/src/V2AgentWalletPreview.tsx", "utf8");
const app = await readFile("apps/mobile/App.tsx", "utf8");

const checks = [];

assertIncludes(screen, "KeyboardAvoidingView", "real mobile login protects input from keyboard overlap");
assertIncludes(screen, "contentContainerStyle={styles.loginScrollContent}", "real mobile login scrolls when keyboard is open");
assertIncludes(screen, 'const appIcon = require("../assets/icon.png")', "real mobile login uses the app icon as a brand asset");
assertIncludes(screen, "<Text style={styles.loginTitle}>海豚，开门</Text>", "real mobile login uses a short product-first title");
assertIncludes(screen, "<Text style={styles.loginSubtitle}>你的 Agent 已就位。</Text>", "real mobile login keeps copy concise");
assertIncludes(screen, "getLoginStatusText(state.status)", "real mobile login maps SDK status to friendly copy");
assertNotIncludes(screen, "<Text style={styles.loginState}>{state.status}</Text>", "real mobile login does not show raw SDK status");
assertIncludes(screen, "disabled={!canSendLoginCode}", "send-code button is disabled until email is present");
assertIncludes(screen, "disabled={!canSubmitLoginCode}", "enter button is disabled until email and code are present");
checks.push("real mobile login is brand-led, keyboard-safe, and hides SDK internals");

assertIncludes(preview, "contentContainerStyle={styles.previewLogin}", "web preview login uses the same scrollable shell");
assertIncludes(preview, 'const appIcon = require("../assets/icon.png")', "web preview login uses the same app icon");
assertIncludes(preview, "<Text style={styles.previewLoginTitle}>海豚，开门</Text>", "web preview login matches the real login title");
assertIncludes(preview, "<Text style={styles.previewLoginCardTitle}>邮箱进入</Text>", "web preview login keeps the same card structure");
assertIncludes(preview, 'placeholder="6 位验证码"', "web preview login shows the verification-code field");
assertIncludes(preview, "<Text style={styles.previewLoginSecondaryButtonText}>发送验证码</Text>", "web preview login shows the send-code button");
assertIncludes(preview, "disabled={!canEnter}", "web preview login keeps disabled state before email input");
checks.push("web preview login mirrors the real mobile entry");

assertIncludes(app, "function MobileWebFrame", "mobile web preview has a dedicated phone-width frame");
assertIncludes(app, 'if (Platform.OS !== "web") return <>{children}</>;', "mobile web frame does not affect native builds");
assertIncludes(app, "maxWidth: 430", "web preview is capped to a phone-sized canvas");
checks.push("web preview stays responsive and phone-sized on desktop browsers");

console.log(JSON.stringify({ ok: true, checks }, null, 2));

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), label);
}

function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), label);
}

function assert(condition, label) {
  if (!condition) throw new Error(`Mobile login UI smoke failed: ${label}`);
}
