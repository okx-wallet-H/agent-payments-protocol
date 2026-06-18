import { readFile } from "node:fs/promises";

const screen = await readFile("apps/mobile/src/V2AgentWalletScreen.tsx", "utf8");
const preview = await readFile("apps/mobile/src/V2AgentWalletPreview.tsx", "utf8");

const checks = [];

assertIncludes(screen, "KeyboardAvoidingView", "real mobile login protects input from keyboard overlap");
assertIncludes(screen, "contentContainerStyle={styles.loginScrollContent}", "real mobile login scrolls when keyboard is open");
assertIncludes(screen, "<Text style={styles.loginTitle}>欢迎回来</Text>", "real mobile login uses user-facing welcome title");
assertIncludes(screen, "getLoginStatusText(state.status)", "real mobile login maps SDK status to friendly copy");
assertNotIncludes(screen, "<Text style={styles.loginState}>{state.status}</Text>", "real mobile login does not show raw SDK status");
assertIncludes(screen, "disabled={!canSendLoginCode}", "send-code button is disabled until email is present");
assertIncludes(screen, "disabled={!canSubmitLoginCode}", "enter button is disabled until email and code are present");
checks.push("real mobile login is polished, keyboard-safe, and hides SDK internals");

assertIncludes(preview, "contentContainerStyle={styles.previewLogin}", "web preview login uses the same scrollable shell");
assertIncludes(preview, "<Text style={styles.previewLoginTitle}>欢迎回来</Text>", "web preview login matches the real login title");
assertIncludes(preview, "<Text style={styles.previewLoginCardTitle}>邮箱登录</Text>", "web preview login keeps the same card structure");
assertIncludes(preview, "disabled={!canEnter}", "web preview login keeps disabled state before email input");
checks.push("web preview login mirrors the real mobile entry");

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
